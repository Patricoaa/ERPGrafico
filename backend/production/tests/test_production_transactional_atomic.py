import tempfile
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings

from core.models import Attachment
from production.models import WorkOrder
from production.services import WorkOrderService

User = get_user_model()


def _make_file(name: str) -> SimpleUploadedFile:
    return SimpleUploadedFile(name, b"dummy content", content_type="application/pdf")


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
@pytest.mark.django_db(transaction=True)
def test_handle_update_attachments_rollback(work_order_factory):
    """
    Si Attachment.objects.create falla en la 2da llamada, el
    @transaction.atomic revierte TODOS los attachments creados.
    """
    user = User.objects.create_user(username="attachments", password="x")
    wo = work_order_factory()

    attachment_count_before = Attachment.objects.count()

    files = {
        "design_file_0": _make_file("design1.pdf"),
        "design_file_1": _make_file("design2.pdf"),
        "approval_file": _make_file("approval.pdf"),
    }

    original_create = Attachment.objects.create
    call_count = 0

    def _failing_create(**kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 2:
            raise RuntimeError("Disco lleno simulado")
        return original_create(**kwargs)

    with patch.object(Attachment.objects, "create", side_effect=_failing_create):
        with pytest.raises(RuntimeError):
            WorkOrderService.handle_update_attachments(wo, files, user)

    assert Attachment.objects.count() == attachment_count_before, (
        "No debe quedar Attachment huérfano si falla la creación del 2do archivo"
    )
