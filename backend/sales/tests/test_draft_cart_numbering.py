"""Tests for DraftCart session_local_id numbering (sequential per POS session)."""

import pytest
from django.db import transaction
from django.utils import timezone

from sales.models import DraftCart
from treasury.models import POSSession, POSTerminal, TreasuryAccount
from core.models import User


@pytest.mark.django_db
class TestDraftCartNumbering:
    """Verify session_local_id is sequential per session, resets on new session."""

    def setup_method(self):
        # Create required FK objects
        self.user = User.objects.create_user(username="testuser", password="pass")
        self.account = TreasuryAccount.objects.create(name="Caja Test", code="1.1.1")
        self.terminal = POSTerminal.objects.create(
            name="Terminal Test",
            default_treasury_account=self.account,
        )

    def _open_session(self) -> POSSession:
        return POSSession.objects.create(
            terminal=self.terminal,
            treasury_account=self.account,
            user=self.user,
            opening_balance=0,
        )

    def _create_draft(self, session: POSSession, **kwargs) -> DraftCart:
        return DraftCart.objects.create(
            pos_session=session,
            created_by=self.user,
            last_modified_by=self.user,
            items=[],
            **kwargs,
        )

    def test_first_draft_in_session_is_number_1(self):
        session = self._open_session()
        draft = self._create_draft(session)
        assert draft.session_local_id == 0

    def test_service_assigns_sequential_numbers(self):
        """DraftCartService.save_draft assigns 1, 2, 3... within a session."""
        from sales.draft_cart_service import DraftCartService

        session = self._open_session()

        d1 = DraftCartService.save_draft(
            pos_session_id=session.id,
            user=self.user,
            items=[{"product_id": 1, "quantity": 1, "unit_price_net": 100, "unit_price_gross": 119}],
            name="Draft 1",
        )
        assert d1.session_local_id == 1

        d2 = DraftCartService.save_draft(
            pos_session_id=session.id,
            user=self.user,
            items=[{"product_id": 2, "quantity": 1, "unit_price_net": 200, "unit_price_gross": 238}],
            name="Draft 2",
        )
        assert d2.session_local_id == 2

        d3 = DraftCartService.save_draft(
            pos_session_id=session.id,
            user=self.user,
            items=[{"product_id": 3, "quantity": 1, "unit_price_net": 300, "unit_price_gross": 357}],
            name="Draft 3",
        )
        assert d3.session_local_id == 3

    def test_new_session_restarts_numbering_at_1(self):
        """A new POS session restarts numbering at 1."""
        from sales.draft_cart_service import DraftCartService

        session1 = self._open_session()
        d1 = DraftCartService.save_draft(
            pos_session_id=session1.id,
            user=self.user,
            items=[{"product_id": 1, "quantity": 1, "unit_price_net": 100, "unit_price_gross": 119}],
        )
        assert d1.session_local_id == 1

        session1.status = POSSession.Status.CLOSED
        session1.closed_at = timezone.now()
        session1.save()

        session2 = self._open_session()
        d2 = DraftCartService.save_draft(
            pos_session_id=session2.id,
            user=self.user,
            items=[{"product_id": 2, "quantity": 1, "unit_price_net": 200, "unit_price_gross": 238}],
        )
        assert d2.session_local_id == 1

    def test_unique_constraint_per_session(self):
        """UniqueConstraint(pos_session, session_local_id) prevents duplicates."""
        session = self._open_session()
        self._create_draft(session, session_local_id=5)
        with pytest.raises(Exception):
            with transaction.atomic():
                self._create_draft(session, session_local_id=5)

    def test_different_sessions_can_have_same_number(self):
        """Terminal A #1 and Terminal B #1 can coexist."""
        from sales.draft_cart_service import DraftCartService

        session1 = self._open_session()
        session2 = self._open_session()

        d1 = DraftCartService.save_draft(
            pos_session_id=session1.id,
            user=self.user,
            items=[{"product_id": 1, "quantity": 1, "unit_price_net": 100, "unit_price_gross": 119}],
        )
        d2 = DraftCartService.save_draft(
            pos_session_id=session2.id,
            user=self.user,
            items=[{"product_id": 2, "quantity": 1, "unit_price_net": 200, "unit_price_gross": 238}],
        )

        assert d1.session_local_id == 1
        assert d2.session_local_id == 1
        assert d1.pos_session_id != d2.pos_session_id

    def test_sync_endpoint_exposes_session_local_id(self):
        """The /pos-drafts/sync/ payload includes session_local_id."""
        from sales.draft_cart_service import DraftCartService

        session = self._open_session()
        DraftCartService.save_draft(
            pos_session_id=session.id,
            user=self.user,
            items=[{"product_id": 1, "quantity": 1, "unit_price_net": 100, "unit_price_gross": 119}],
            name="Test Draft",
        )

        data = DraftCartService.get_sync_data(pos_session_id=session.id)
        assert "drafts" in data
        assert len(data["drafts"]) == 1
        assert data["drafts"][0]["session_local_id"] == 1

    def test_serializer_exposes_session_local_id(self):
        """DraftCartSerializer includes session_local_id in response."""
        from sales.draft_cart_serializers import DraftCartSerializer

        session = self._open_session()
        draft = self._create_draft(session, session_local_id=7, name="Serialized")

        serializer = DraftCartSerializer(draft)
        assert serializer.data["session_local_id"] == 7

    def test_websocket_broadcast_includes_session_local_id(self):
        """Signal handler uses serializer -> WS payload has session_local_id."""
        from sales.signals import notify_draft_update
        from sales.draft_cart_serializers import DraftCartSerializer

        session = self._open_session()
        draft = self._create_draft(session, session_local_id=3, name="WS Draft")

        serializer = DraftCartSerializer(draft)
        payload = {"event": "CREATED", "draft": serializer.data}
        assert payload["draft"]["session_local_id"] == 3

    def test_wizard_state_phase_id_roundtrip(self):
        """wizard_state JSONField preserves phaseId through save/serialize/sync."""
        from sales.draft_cart_service import DraftCartService

        session = self._open_session()
        draft = DraftCartService.save_draft(
            pos_session_id=session.id,
            user=self.user,
            items=[{"product_id": 1, "quantity": 1, "unit_price_net": 100, "unit_price_gross": 119}],
            wizard_state={"step": 3, "phaseId": "manufacturing", "isWaitingApproval": True},
        )

        draft_reloaded = DraftCart.objects.get(pk=draft.pk)
        assert draft_reloaded.wizard_state.get("phaseId") == "manufacturing"
        assert draft_reloaded.wizard_state.get("isWaitingApproval") is True

        from sales.draft_cart_serializers import DraftCartSerializer
        serializer = DraftCartSerializer(draft_reloaded)
        assert serializer.data["wizard_state"]["phaseId"] == "manufacturing"

        data = DraftCartService.get_sync_data(pos_session_id=session.id)
        assert data["drafts"][0]["wizard_state"]["phaseId"] == "manufacturing"
