"""Tests for DraftCart.has_pending_approval protection logic."""

import pytest
from django.utils import timezone

from core.models import User
from sales.draft_cart_service import DraftCartService
from sales.models import DraftCart
from treasury.models import POSSession, POSTerminal, TreasuryAccount


@pytest.mark.django_db
class TestDraftCartPendingApprovalProtection:
    """has_pending_approval=True drafts survive all service-level deletion paths."""

    def setup_method(self):
        self.user = User.objects.create_user(username="testpending", password="pass")
        self.account = TreasuryAccount.objects.create(name="Caja Pending Test", code="1.1.90")
        self.terminal = POSTerminal.objects.create(
            name="Terminal Pending",
            default_treasury_account=self.account,
        )
        self.session = POSSession.objects.create(
            terminal=self.terminal,
            treasury_account=self.account,
            user=self.user,
            opening_balance=0,
        )
        self._counter = 0

    def _draft(self, **kwargs) -> DraftCart:
        self._counter += 1
        return DraftCart.objects.create(
            pos_session=self.session,
            created_by=self.user,
            items=[],
            session_local_id=self._counter,
            **kwargs,
        )

    # --- cleanup_on_session_close ---

    def test_cleanup_on_session_close_skips_pending(self):
        draft_pending = self._draft(has_pending_approval=True)
        draft_normal = self._draft(has_pending_approval=False)

        deleted = DraftCartService.cleanup_on_session_close(self.session.id)

        assert deleted == 1
        assert DraftCart.objects.filter(id=draft_pending.id).exists()
        assert not DraftCart.objects.filter(id=draft_normal.id).exists()

    def test_cleanup_on_session_close_deletes_all_normal_drafts(self):
        for _ in range(3):
            self._draft(has_pending_approval=False)

        deleted = DraftCartService.cleanup_on_session_close(self.session.id)

        assert deleted == 3

    # --- cleanup_old_drafts ---

    def test_cleanup_old_drafts_skips_pending(self):
        from workflow.models import Task

        draft_pending = self._draft(has_pending_approval=True)
        draft_old = self._draft(has_pending_approval=False)

        # Active task keeps draft_pending alive through cleanup_stale_pending_approvals
        Task.objects.create(
            title="Aprobación activa",
            task_type="CREDIT_POS_REQUEST",
            status=Task.Status.PENDING,
            category=Task.Category.APPROVAL,
            created_by=self.user,
            data={"draft_id": draft_pending.id},
        )

        # Backdate both drafts to 2 days ago
        DraftCart.objects.filter(id__in=[draft_pending.id, draft_old.id]).update(
            updated_at=timezone.now() - timezone.timedelta(days=2)
        )

        deleted = DraftCartService.cleanup_old_drafts(days=1)

        assert deleted == 1
        assert DraftCart.objects.filter(id=draft_pending.id).exists()
        assert not DraftCart.objects.filter(id=draft_old.id).exists()

    def test_cleanup_old_drafts_skips_recent_drafts(self):
        """Recent drafts (not old enough) are never deleted regardless of flag."""
        self._draft(has_pending_approval=False)

        deleted = DraftCartService.cleanup_old_drafts(days=1)

        assert deleted == 0

    # --- delete_draft ---

    def test_delete_draft_refuses_pending(self):
        draft = self._draft(has_pending_approval=True)

        result = DraftCartService.delete_draft(draft.id, self.session.id)

        assert result is False
        assert DraftCart.objects.filter(id=draft.id).exists()

    def test_delete_draft_allows_normal(self):
        draft = self._draft(has_pending_approval=False)

        result = DraftCartService.delete_draft(draft.id, self.session.id)

        assert result is True
        assert not DraftCart.objects.filter(id=draft.id).exists()

    # --- load_draft cross-session ---

    def test_load_draft_cross_session_allowed_for_pending(self):
        """A pending-approval draft can be loaded from any session."""
        draft = self._draft(has_pending_approval=True)

        loaded = DraftCartService.load_draft(draft.id, pos_session_id=99999)

        assert loaded is not None
        assert loaded.id == draft.id

    def test_load_draft_cross_session_blocked_for_normal(self):
        """A normal draft cannot be loaded from a different session."""
        draft = self._draft(has_pending_approval=False)

        loaded = DraftCartService.load_draft(draft.id, pos_session_id=99999)

        assert loaded is None

    def test_load_draft_same_session_always_works(self):
        """Same-session load always works regardless of flag."""
        draft_pending = self._draft(has_pending_approval=True)
        draft_normal = self._draft(has_pending_approval=False)

        assert DraftCartService.load_draft(draft_pending.id, self.session.id) is not None
        assert DraftCartService.load_draft(draft_normal.id, self.session.id) is not None

    # --- save_draft modification guard ---

    def test_save_draft_refuses_modification_when_pending(self):
        """Modifying a pending-approval draft raises ValidationError."""
        from django.core.exceptions import ValidationError as DjangoValidationError
        from rest_framework.exceptions import ValidationError as DRFValidationError

        draft = self._draft(has_pending_approval=True)

        with pytest.raises((DRFValidationError, DjangoValidationError)):
            DraftCartService.save_draft(
                pos_session_id=self.session.id,
                user=self.user,
                items=[{"product": 1, "quantity": 5, "unit_price_gross": "100.00"}],
                customer_id=None,
                name="Intento de modificación",
                notes="",
                wizard_state=None,
                total_discount_amount=0,
                draft_id=draft.id,
                session_key="",
            )

    def test_save_draft_allows_new_draft_always(self):
        """Creating a new draft (no draft_id) is always allowed."""
        draft = DraftCartService.save_draft(
            pos_session_id=self.session.id,
            user=self.user,
            items=[],
            customer_id=None,
            name="Nuevo borrador",
            notes="",
            wizard_state=None,
            total_discount_amount=0,
            draft_id=None,
            session_key="",
        )

        assert draft is not None
        assert draft.has_pending_approval is False
