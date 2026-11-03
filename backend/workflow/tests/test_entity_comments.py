"""ADR-0111 — comentarios transversales: hilos, menciones, permisos y notificaciones."""

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from rest_framework.test import APIClient

from contacts.models import Contact
from core.models import GroupProfile
from workflow.comments.services import MENTION_TYPE, REPLY_TYPE
from workflow.models import Comment, Notification

User = get_user_model()
URL = "/api/workflow/comments/"


def _user(username, *perms, first_name=""):
    user = User.objects.create_user(username=username, password="x", first_name=first_name)
    for perm in perms:
        app_label, codename = perm.split(".")
        user.user_permissions.add(
            Permission.objects.get(content_type__app_label=app_label, codename=codename)
        )
    return User.objects.get(pk=user.pk)


def _client(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def contact(db):
    return Contact.objects.create(name="Cliente Comentado", tax_id="76333333-3")


@pytest.fixture
def target(contact):
    return f"contacts.contact:{contact.pk}"


@pytest.fixture
def alice(db):
    return _user("alice", "contacts.view_contact", first_name="Alice")


@pytest.fixture
def bob(db):
    return _user("bob", "contacts.view_contact", first_name="Bob")


@pytest.fixture
def outsider(db):
    return _user("outsider", first_name="Outsider")


@pytest.fixture
def team(bob, outsider):
    group = Group.objects.create(name="Diseño")
    GroupProfile.objects.update_or_create(group=group, defaults={"kind": GroupProfile.TEAM})
    group.user_set.add(bob, outsider)
    return group


def _post(client, target, text, parent_id=None):
    payload = {"target": target, "text": text}
    if parent_id:
        payload["parent_id"] = parent_id
    return client.post(URL, payload, format="json")


@pytest.mark.django_db(transaction=True)
class TestEntityComments:
    def test_requires_auth(self, target):
        assert APIClient().get(URL, {"target": target}).status_code == 401

    def test_requires_view_permission_of_target(self, outsider, target):
        client = _client(outsider)
        assert client.get(URL, {"target": target}).status_code == 403
        assert _post(client, target, "hola").status_code == 403

    def test_invalid_target(self, alice):
        client = _client(alice)
        assert client.get(URL, {"target": "nope"}).status_code == 400
        assert client.get(URL, {"target": "contacts.contact:999999"}).status_code == 404

    def test_empty_text_rejected(self, alice, target):
        assert _post(_client(alice), target, "   ").status_code == 400

    def test_create_and_list_threads_one_level(self, alice, bob, target):
        root = _post(_client(alice), target, "raíz").json()
        reply = _post(_client(bob), target, "respuesta", root["id"]).json()
        # Responder a una respuesta cuelga del mismo hilo.
        nested = _post(_client(alice), target, "otra", reply["id"]).json()
        assert nested["parent_id"] == root["id"]

        threads = _client(alice).get(URL, {"target": target}).json()
        assert len(threads) == 1
        assert [r["text"] for r in threads[0]["replies"]] == ["respuesta", "otra"]
        assert threads[0]["can_edit"] is True
        assert threads[0]["replies"][0]["can_edit"] is False

    def test_parent_from_other_entity_rejected(self, alice, target, contact):
        other = Contact.objects.create(name="Otro", tax_id="76444444-4")
        root = _post(_client(alice), f"contacts.contact:{other.pk}", "x").json()
        assert _post(_client(alice), target, "y", root["id"]).status_code == 400

    def test_only_author_edits(self, alice, bob, target):
        comment = _post(_client(alice), target, "original").json()
        url = f"{URL}{comment['id']}/"
        assert _client(bob).patch(url, {"text": "hack"}, format="json").status_code == 403
        resp = _client(alice).patch(url, {"text": "editado"}, format="json")
        assert resp.status_code == 200
        assert resp.json()["text"] == "editado"
        assert resp.json()["edited_at"] is not None

    def test_delete_author_or_moderator(self, alice, bob, target):
        first = _post(_client(alice), target, "uno").json()
        second = _post(_client(alice), target, "dos").json()
        assert _client(bob).delete(f"{URL}{first['id']}/").status_code == 403
        assert _client(alice).delete(f"{URL}{first['id']}/").status_code == 204

        moderator = _user("mod", "contacts.view_contact", "workflow.delete_comment")
        assert _client(moderator).delete(f"{URL}{second['id']}/").status_code == 204
        assert Comment.objects.filter(deleted_at__isnull=False).count() == 2
        assert _client(alice).get(URL, {"target": target}).json() == []

    def test_deleted_root_with_replies_keeps_thread(self, alice, bob, target):
        root = _post(_client(alice), target, "raíz").json()
        _post(_client(bob), target, "respuesta", root["id"])
        _client(alice).delete(f"{URL}{root['id']}/")

        threads = _client(bob).get(URL, {"target": target}).json()
        assert threads[0]["is_deleted"] is True
        assert threads[0]["text"] == ""
        assert len(threads[0]["replies"]) == 1

    def test_mention_notifies_only_users_with_access(self, alice, bob, outsider, team, target):
        resp = _post(_client(alice), target, f"@[u:{bob.pk}] y @[u:{outsider.pk}] mira esto")
        assert resp.status_code == 201
        assert {m["name"] for m in resp.json()["mentions"]} == {"Bob", "Outsider"}

        notes = Notification.objects.filter(notification_type=MENTION_TYPE)
        assert list(notes.values_list("user_id", flat=True)) == [bob.pk]
        note = notes.get()
        assert note.data["label"] == "contacts.contact"
        assert "@Bob" in note.message

    def test_team_mention_expands_to_members_with_access(self, alice, bob, team, target):
        _post(_client(alice), target, f"@[g:{team.pk}] revisen")
        assert set(
            Notification.objects.filter(notification_type=MENTION_TYPE).values_list("user_id", flat=True)
        ) == {bob.pk}

    def test_role_groups_are_not_mentionable(self, alice, target):
        role = Group.objects.create(name="Vendedor")
        GroupProfile.objects.update_or_create(group=role, defaults={"kind": GroupProfile.ROLE})
        assert _post(_client(alice), target, f"@[g:{role.pk}]").status_code == 400

    def test_reply_notifies_thread_participants_not_author(self, alice, bob, target):
        root = _post(_client(alice), target, "raíz").json()
        _post(_client(bob), target, "respuesta", root["id"])
        replies = Notification.objects.filter(notification_type=REPLY_TYPE)
        assert list(replies.values_list("user_id", flat=True)) == [alice.pk]

        _post(_client(alice), target, "gracias", root["id"])
        assert set(replies.values_list("user_id", flat=True)) == {alice.pk, bob.pk}

    def test_edit_notifies_only_new_mentions(self, alice, bob, target):
        carol = _user("carol", "contacts.view_contact", first_name="Carol")
        comment = _post(_client(alice), target, f"@[u:{bob.pk}]").json()
        _client(alice).patch(
            f"{URL}{comment['id']}/", {"text": f"@[u:{bob.pk}] @[u:{carol.pk}]"}, format="json"
        )
        notified = list(
            Notification.objects.filter(notification_type=MENTION_TYPE).values_list("user_id", flat=True)
        )
        assert sorted(notified) == sorted([bob.pk, carol.pk])

    def test_mentionables_flags_access(self, alice, bob, outsider, team, target):
        data = _client(alice).get(f"{URL}mentionables/", {"q": "", "target": target}).json()
        access = {u["username"]: u["has_access"] for u in data["users"]}
        assert access["bob"] is True
        assert access["outsider"] is False
        assert [t["name"] for t in data["teams"]] == ["Diseño"]
        assert data["teams"][0]["member_count"] == 2

    def test_list_has_no_n_plus_one(self, alice, bob, target, django_assert_max_num_queries):
        for i in range(3):
            root = _post(_client(alice), target, f"@[u:{bob.pk}] raíz {i}").json()
            for _ in range(2):
                _post(_client(bob), target, f"@[u:{alice.pk}] r", root["id"])
        client = _client(alice)
        client.get(URL, {"target": target})  # calienta caches de ContentType/permisos
        with django_assert_max_num_queries(10):
            assert len(client.get(URL, {"target": target}).json()) == 3


@pytest.mark.django_db(transaction=True)
def test_changes_broadcast_to_comments_subtopic(alice, target, contact, monkeypatch):
    calls = []
    monkeypatch.setattr(
        "workflow.comments.services.broadcast_comments_changed",
        lambda **kwargs: calls.append(kwargs),
    )
    client = _client(alice)
    comment = _post(client, target, "hola").json()
    client.patch(f"{URL}{comment['id']}/", {"text": "editado"}, format="json")
    client.delete(f"{URL}{comment['id']}/")
    assert calls == [{"label": "contacts.contact", "instance_id": contact.pk}] * 3


def test_frontend_comment_labels_resolve_to_models():
    """features/comments/lib/entityLabels.ts must only map to commentable models."""
    import re
    from pathlib import Path

    from django.conf import settings

    from core.documents.types import DocumentTypeRegistry

    source = Path(settings.BASE_DIR).parent / "frontend/features/comments/lib/entityLabels.ts"
    if not source.exists():
        pytest.skip("frontend no disponible (p. ej. dentro del contenedor backend)")
    labels = re.findall(r':\s*"([a-z_]+\.[a-z_]+)"', source.read_text())
    assert len(labels) > 30
    missing = [label for label in labels if DocumentTypeRegistry.model_for(label) is None]
    assert missing == []


# ─── Adjuntos (ADR-0111) ───────────────────────────────────────────────────────


@pytest.fixture
def media_tmp(settings, tmp_path):
    settings.MEDIA_ROOT = str(tmp_path)
    return tmp_path


def _upload(name, content=b"%PDF-1.4 demo"):
    from django.core.files.uploadedfile import SimpleUploadedFile

    return SimpleUploadedFile(name, content, content_type="application/pdf")


@pytest.mark.django_db(transaction=True)
class TestCommentAttachments:
    def test_upload_with_text_and_download(self, alice, bob, target, media_tmp):
        resp = _client(alice).post(
            URL, {"target": target, "text": "ver plano", "files": [_upload("plano.pdf")]},
            format="multipart",
        )
        assert resp.status_code == 201, resp.content
        [attachment] = resp.json()["attachments"]
        assert attachment["name"] == "plano.pdf"
        assert attachment["size"] > 0

        download = _client(bob).get(f"{URL}{resp.json()['id']}/attachments/{attachment['id']}/")
        assert download.status_code == 200
        assert b"".join(download.streaming_content) == b"%PDF-1.4 demo"
        assert "plano.pdf" in download["Content-Disposition"]

    def test_attachment_only_comment_allowed(self, alice, target, media_tmp):
        resp = _client(alice).post(
            URL, {"target": target, "files": [_upload("a.pdf")]}, format="multipart"
        )
        assert resp.status_code == 201
        assert resp.json()["text"] == ""

    def test_download_requires_view_permission(self, alice, outsider, target, media_tmp):
        resp = _client(alice).post(
            URL, {"target": target, "text": "x", "files": [_upload("a.pdf")]}, format="multipart"
        ).json()
        url = f"{URL}{resp['id']}/attachments/{resp['attachments'][0]['id']}/"
        assert _client(outsider).get(url).status_code in (403, 404)

    def test_rejects_invalid_extension(self, alice, target, media_tmp):
        resp = _client(alice).post(
            URL, {"target": target, "text": "x", "files": [_upload("virus.exe")]}, format="multipart"
        )
        assert resp.status_code == 400
        assert not Comment.objects.exists()

    def test_rejects_too_many_files(self, alice, target, media_tmp):
        files = [_upload(f"f{i}.pdf") for i in range(6)]
        resp = _client(alice).post(URL, {"target": target, "files": files}, format="multipart")
        assert resp.status_code == 400

    def test_list_includes_attachments_without_n_plus_one(
        self, alice, target, media_tmp, django_assert_max_num_queries
    ):
        client = _client(alice)
        for i in range(3):
            client.post(URL, {"target": target, "files": [_upload(f"{i}.pdf")]}, format="multipart")
        client.get(URL, {"target": target})
        with django_assert_max_num_queries(11):
            threads = client.get(URL, {"target": target}).json()
        assert [len(t["attachments"]) for t in threads] == [1, 1, 1]


@pytest.mark.django_db(transaction=True)
def test_notification_title_is_entity_display_id(alice, bob, target, contact):
    from core.documents.refs import display_id_for

    _post(_client(alice), target, f"@[u:{bob.pk}] mira")
    note = Notification.objects.get(notification_type=MENTION_TYPE)
    assert note.title == display_id_for("contacts.contact", contact)
    assert note.message.startswith("Alice te mencionó: ")


# ─── Herencia de permiso: tarea → entidad a la que pertenece (ADR-0111) ────────


@pytest.mark.django_db(transaction=True)
class TestTaskCommentsInheritParentPermission:
    @pytest.fixture
    def approval(self, contact, alice):
        from workflow.models import Task

        return Task.objects.create(
            title="Aprobación de prueba",
            description="",
            task_type="TEST_APPROVAL",
            category=Task.Category.APPROVAL,
            status=Task.Status.PENDING,
            created_by=alice,
            content_object=contact,
        )

    @pytest.fixture
    def task_target(self, approval):
        return f"workflow.task:{approval.pk}"

    def test_parent_viewer_comments_without_task_permission(self, alice, task_target):
        # alice ve el contacto (view_contact) pero no tiene workflow.view_task.
        resp = _client(alice).post(URL, {"target": task_target, "text": "conversación"}, format="json")
        assert resp.status_code == 201
        assert _client(alice).get(URL, {"target": task_target}).status_code == 200

    def test_task_permission_alone_is_not_enough(self, approval, task_target):
        # Tiene workflow.view_task pero no ve la entidad dueña: el permiso heredado manda.
        from workflow.models import Task

        viewer = _user("task_only", "workflow.view_task")
        assert viewer.has_perm(Task.objects.get(pk=approval.pk) and "workflow.view_task")
        assert _client(viewer).get(URL, {"target": task_target}).status_code == 403

    def test_task_without_source_falls_back_to_task_permission(self, alice):
        from workflow.models import Task

        plain = Task.objects.create(
            title="Sin entidad", description="", task_type="TEST_PLAIN",
            status=Task.Status.PENDING, created_by=alice,
        )
        viewer = _user("task_viewer", "workflow.view_task")
        assert _client(viewer).get(URL, {"target": f"workflow.task:{plain.pk}"}).status_code == 200
