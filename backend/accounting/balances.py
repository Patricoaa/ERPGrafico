"""Saldos contabilizados por cuenta, materializados (ADR-0115).

`Account.posted_debit_total`, `posted_credit_total` y `posted_items_count` reflejan los
ítems de asientos en estados que afectan saldo (`JournalEntry.balance_affecting_statuses`).
Se recalculan con una agregación por cuenta cuando cambia el estado de un asiento o
cuando se modifica un ítem de un asiento que ya afecta saldo.

Supuesto: los ítems de un asiento que afecta saldo no cambian sin pasar por estas señales
(la edición de asientos publicados está bloqueada por la política de edición, ADR-0091).
Quien use `bulk_create` sobre un asiento ya publicado debe llamar a `refresh_accounts_of_entry`.

Una instancia de `Account` ya cargada no ve publicaciones posteriores: las validaciones que
mueven dinero leen el saldo guardado (`TreasuryAccount.fresh_balance`).
"""

from decimal import Decimal

from django.db.models import Count, DecimalField, IntegerField, OuterRef, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from django.db.models.signals import post_delete, post_init, post_save
from django.dispatch import receiver

from .models import Account, JournalEntry, JournalItem


def _affecting_statuses():
    return JournalEntry.balance_affecting_statuses()


def _posted_total(field: str):
    """Subquery: suma de `field` de los ítems contabilizados de la cuenta externa (OuterRef)."""
    items = (
        JournalItem.objects.filter(account_id=OuterRef("pk"), entry__status__in=_affecting_statuses())
        .order_by()
        .values("account_id")
        .annotate(total=Sum(field))
        .values("total")
    )
    return Coalesce(Subquery(items), Value(Decimal("0")), output_field=DecimalField(max_digits=20, decimal_places=0))


def _posted_items_count():
    items = (
        JournalItem.objects.filter(account_id=OuterRef("pk"), entry__status__in=_affecting_statuses())
        .order_by()
        .values("account_id")
        .annotate(total=Count("id"))
        .values("total")
    )
    return Coalesce(Subquery(items), Value(0), output_field=IntegerField())


def _refresh(queryset) -> None:
    """Una sola sentencia UPDATE por operación, sea cual sea el número de cuentas."""
    queryset.update(
        posted_debit_total=_posted_total("debit"),
        posted_credit_total=_posted_total("credit"),
        posted_items_count=_posted_items_count(),
    )


def refresh_account_totals(account_ids) -> None:
    """Recalcula los saldos materializados de las cuentas dadas."""
    ids = [account_id for account_id in account_ids if account_id is not None]
    if ids:
        _refresh(Account.objects.filter(pk__in=ids))


def refresh_accounts_of_entry(entry_id) -> None:
    """Recalcula las cuentas que aparecen en los ítems de un asiento (sin cargarlas en Python)."""
    _refresh(Account.objects.filter(pk__in=JournalItem.objects.filter(entry_id=entry_id).values("account_id")))


@receiver(post_init, sender=JournalEntry)
def _remember_loaded_status(sender, instance, **kwargs):
    # Status as loaded: lets post_save detect a transition without an extra query.
    instance._loaded_status = instance.status


@receiver(post_save, sender=JournalEntry)
def _refresh_when_entry_affects_balances(sender, instance, **kwargs):
    affecting = set(_affecting_statuses())
    was_affecting = getattr(instance, "_loaded_status", None) in affecting
    is_affecting = instance.status in affecting
    if was_affecting or is_affecting:
        refresh_accounts_of_entry(instance.pk)
    instance._loaded_status = instance.status


def _refresh_item_if_entry_affects(item) -> None:
    if JournalEntry.objects.filter(pk=item.entry_id, status__in=_affecting_statuses()).exists():
        refresh_account_totals([item.account_id])


@receiver(post_save, sender=JournalItem)
def _refresh_on_item_save(sender, instance, **kwargs):
    _refresh_item_if_entry_affects(instance)


@receiver(post_delete, sender=JournalItem)
def _refresh_on_item_delete(sender, instance, **kwargs):
    _refresh_item_if_entry_affects(instance)
