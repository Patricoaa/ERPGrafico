"""Regresión: los receivers de broadcast WS de DraftCart deben estar conectados.

Un lint (F401) eliminó `import sales.signals` de SalesConfig.ready() y los
borradores del POS dejaron de actualizarse en vivo. No importamos
`sales.signals` aquí a propósito: el test debe depender solo del registro
hecho por la app.
"""

from datetime import timedelta
from unittest.mock import patch

import pytest
from django.db.models.signals import post_delete, post_save
from django.utils import timezone

from core.models import User
from sales.draft_cart_service import LOCK_TIMEOUT_SECONDS, DraftCartService
from sales.models import DraftCart
from treasury.models import POSSession, POSTerminal, TreasuryAccount


def _receiver_names(signal):
    sync, async_ = signal._live_receivers(DraftCart)
    return {getattr(r, "__name__", "") for r in [*sync, *async_]}


def test_draftcart_post_save_receiver_registered():
    assert "notify_draft_update" in _receiver_names(post_save)


def test_draftcart_post_delete_receiver_registered():
    assert "notify_draft_delete" in _receiver_names(post_delete)


# ── Los cleanups masivos también deben emitir broadcast WS ───────────────


@pytest.mark.django_db
class TestCleanupsBroadcast:
    def setup_method(self):
        self.user = User.objects.create_user(username="cleanupws", password="pass")
        account = TreasuryAccount.objects.create(name="Caja WS", code="1.1.91")
        terminal = POSTerminal.objects.create(name="Terminal WS", default_treasury_account=account)
        self.session = POSSession.objects.create(
            terminal=terminal, treasury_account=account, user=self.user, opening_balance=0
        )

    def _draft(self, n, **kw):
        return DraftCart.objects.create(
            pos_session=self.session, created_by=self.user, items=[], session_local_id=n, **kw
        )

    def test_cleanup_stale_locks_broadcasts_unlock(self):
        old = timezone.now() - timedelta(seconds=LOCK_TIMEOUT_SECONDS + 10)
        draft = self._draft(1, locked_by=self.user, locked_at=old, lock_session_key="k")
        with patch("sales.signals.async_to_sync") as a2s:
            assert DraftCartService.cleanup_stale_locks() == 1
        assert a2s.called
        draft.refresh_from_db()
        assert draft.locked_by is None and draft.lock_session_key == ""

    def test_cleanup_stale_pending_approvals_broadcasts(self):
        draft = self._draft(2, has_pending_approval=True)
        with patch("sales.signals.async_to_sync") as a2s:
            assert DraftCartService.cleanup_stale_pending_approvals() == 1
        assert a2s.called
        draft.refresh_from_db()
        assert draft.has_pending_approval is False
