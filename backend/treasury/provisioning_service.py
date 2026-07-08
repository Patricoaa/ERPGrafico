"""
provisioning_service.py — Auto-provisión de cuentas de tesorería + métodos de pago.

Separa las dos capas del dominio bancario para reducir la fricción de configuración:

  - Capa 1 (ubicación / dónde está el dinero): ``TreasuryAccount``
    (``CASH`` / ``CHECKING`` / ``CREDIT_CARD``).
  - Capa 2 (tender / cómo se paga): ``PaymentMethod`` creado automáticamente al
    dar de alta la cuenta, en vez de obligar al usuario a crearlo a mano y
    re-elegir la cuenta cada vez.

El asistente de alta (frontend) recolecta el tipo + los tenders y delega aquí.
Patrón de referencia: ``core/management/commands/setup_demo_data.py`` (cuenta → métodos).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from django.db import transaction

from .models import PaymentMethod, TreasuryAccount

if TYPE_CHECKING:  # pragma: no cover
    from django.contrib.auth.models import AbstractUser


class TreasuryProvisioningService:
    """Crea una cuenta de tesorería junto con sus formas de pago lógicas."""

    # Tenders válidos por tipo de cuenta (Capa 1 → Capa 2). El asistente sólo
    # ofrece estos; CASH y CREDIT_CARD tienen un tender fijo (no elegible).
    DEFAULT_METHODS_BY_TYPE: dict[str, list[str]] = {
        TreasuryAccount.Type.CASH: [PaymentMethod.Type.CASH],
        TreasuryAccount.Type.CHECKING: [
            PaymentMethod.Type.TRANSFER,
            PaymentMethod.Type.DEBIT_CARD,
            PaymentMethod.Type.CHECK,
        ],
        TreasuryAccount.Type.CREDIT_CARD: [PaymentMethod.Type.CREDIT_CARD],
    }

    # Etiqueta legible por tender para nombrar el método auto-creado.
    _METHOD_LABELS: dict[str, str] = {
        PaymentMethod.Type.CASH: "Efectivo",
        PaymentMethod.Type.TRANSFER: "Transferencia",
        PaymentMethod.Type.DEBIT_CARD: "Tarjeta de Débito",
        PaymentMethod.Type.CHECK: "Cheque",
        PaymentMethod.Type.CREDIT_CARD: "Tarjeta de Crédito",
    }

    # ── Public API ───────────────────────────────────────────────────────────

    @classmethod
    def default_tenders_for(cls, account_type: str) -> list[str]:
        """Tenders ofrecibles para un tipo de cuenta (para poblar el asistente)."""
        return list(cls.DEFAULT_METHODS_BY_TYPE.get(account_type, []))

    @classmethod
    def provision_from_payload(
        cls, payload: dict, *, created_by: "AbstractUser | None" = None
    ) -> tuple[TreasuryAccount, list[PaymentMethod]]:
        """Parsea el payload del asistente y delega en :meth:`provision`."""
        account_data = {
            "name": payload.get("name", ""),
            "code": payload.get("code") or None,
            "currency": payload.get("currency") or "CLP",
            "account_id": payload.get("account"),
            "account_type": payload.get("account_type"),
            "bank_id": payload.get("bank") or None,
            "account_number": payload.get("account_number") or None,
            "credit_limit": payload.get("credit_limit") or None,
            "default_bank_format": payload.get("default_bank_format") or None,
        }
        return cls.provision(
            account_data=account_data,
            tenders=payload.get("tenders") or None,
            usage=payload.get("usage", "both"),
            created_by=created_by,
        )

    @classmethod
    @transaction.atomic
    def provision(
        cls,
        *,
        account_data: dict,
        tenders: list[str] | None = None,
        usage: str = "both",
        created_by: "AbstractUser | None" = None,
    ) -> tuple[TreasuryAccount, list[PaymentMethod]]:
        """
        Crea una ``TreasuryAccount`` y sus ``PaymentMethod`` en una transacción atómica.

        Args:
            account_data: campos de TreasuryAccount con claves de modelo
                (``name``, ``account_id``, ``account_type``, ``currency``,
                ``bank_id``, ``account_number``, ``code``, ``default_bank_format``).
            tenders: lista de ``PaymentMethod.Type`` a provisionar. Se intersecta
                siempre con los permitidos para el tipo (defensivo). Si es None o
                queda vacía, se usan todos los del tipo.
            usage: ``'sales'`` | ``'purchases'`` | ``'both'`` — base para
                ``allow_for_sales``/``allow_for_purchases``.
            created_by: usuario (auditoría; reservado para uso futuro).

        Returns:
            ``(account, methods)``: la cuenta creada y la lista de métodos.

        Raises:
            ValidationError: si la cuenta o algún método no pasa validación
                (rollback total por ``transaction.atomic``).
        """
        account_type = account_data.get("account_type")
        allowed = cls.DEFAULT_METHODS_BY_TYPE.get(account_type, [])

        if tenders is None:
            resolved = list(allowed)
        else:
            resolved = [t for t in tenders if t in allowed]
            if not resolved:  # CASH / CREDIT_CARD tienen tender fijo
                resolved = list(allowed)

        account_data = {**account_data, **cls._allows_from_tenders(resolved)}
        account = TreasuryAccount(**account_data)
        account.save()  # clean() se ejecuta dentro de save()

        methods = [cls._create_method(account, tender, usage) for tender in resolved]
        return account, methods

    # ── Private helpers ──────────────────────────────────────────────────────

    @classmethod
    def _create_method(cls, account: TreasuryAccount, tender: str, usage: str) -> PaymentMethod:
        allow_sales, allow_purchases = cls._usage_flags(tender, usage)
        method = PaymentMethod(
            name=f"{cls._METHOD_LABELS.get(tender, tender)} — {account.name}",
            method_type=tender,
            treasury_account=account,
            allow_for_sales=allow_sales,
            allow_for_purchases=allow_purchases,
        )
        method.save()  # clean() aplica defaults por tipo (p. ej. débito → solo compras)
        return method

    @staticmethod
    def _usage_flags(tender: str, usage: str) -> tuple[bool, bool]:
        # Débito/crédito de empresa → sólo compras (alineado con PaymentMethod.clean()).
        if tender in (PaymentMethod.Type.DEBIT_CARD, PaymentMethod.Type.CREDIT_CARD):
            return False, True
        return usage in ("sales", "both"), usage in ("purchases", "both")

    @staticmethod
    def _allows_from_tenders(tenders: list[str]) -> dict[str, bool]:
        """Deriva los flags ``allows_*`` de la cuenta desde el set de tenders."""
        t = set(tenders)
        card_tenders = {
            PaymentMethod.Type.DEBIT_CARD,
            PaymentMethod.Type.CREDIT_CARD,
            PaymentMethod.Type.CARD_TERMINAL,
        }
        return {
            "allows_cash": PaymentMethod.Type.CASH in t,
            "allows_card": bool(t & card_tenders),
            "allows_transfer": PaymentMethod.Type.TRANSFER in t,
            "allows_check": PaymentMethod.Type.CHECK in t,
        }
