import uuid as uuid_lib
from decimal import Decimal

from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

# from sales.models import SaleOrder
# from purchasing.models import PurchaseOrder
from simple_history.models import HistoricalRecords

from accounting.models import Account, AccountType
from core.models import TimeStampedModel
from core.storages import PrivateMediaStorage
from core.utils import get_current_date
from core.validators import validate_file_extension, validate_file_size


def get_default_date():
    """Compatibility wrapper for migrations."""
    return get_current_date()


class ReconciliationMatch(models.Model):
    """Agrupador para conciliaciones N:M"""

    treasury_account = models.ForeignKey(
        "TreasuryAccount",
        on_delete=models.PROTECT,
        related_name="reconciliation_matches",
        verbose_name=_("Cuenta de Tesorería"),
    )

    # Estado del match
    is_confirmed = models.BooleanField(_("Confirmado"), default=False)
    confirmed_at = models.DateTimeField(_("Confirmado el"), null=True, blank=True)
    confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="confirmed_matches",
        verbose_name=_("Confirmado Por"),
    )

    # Auditoría
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_matches",
        verbose_name=_("Creado Por"),
    )

    notes = models.TextField(_("Notas"), blank=True)

    # Tracking for transfers generated during reconciliation (e.g. cross-account match)
    transfer_journal_entries = models.ManyToManyField(
        "accounting.JournalEntry",
        related_name="reconciliation_matches_transfers",
        blank=True,
        verbose_name=_("Asientos de Transferencia"),
    )

    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Grupo de Conciliación")
        verbose_name_plural = _("Grupos de Conciliación")
        ordering = ["-created_at"]

    def __str__(self):
        return f"Match #{self.id} ({self.status_display})"

    @property
    def status_display(self):
        return "Confirmado" if self.is_confirmed else "Borrador"


class TreasuryMovement(models.Model):
    class Type(models.TextChoices):
        # Unified Types
        INBOUND = "INBOUND", _("Entrante (Cobro/Venta)")
        OUTBOUND = "OUTBOUND", _("Saliente (Pago/Gasto)")
        TRANSFER = "TRANSFER", _("Traspaso Interno")
        ADJUSTMENT = "ADJUSTMENT", _("Ajuste")
        CREDIT_LINE_DRAW = "CREDIT_LINE_DRAW", _("Disposición Línea de Crédito")
        CREDIT_LINE_REPAY = "CREDIT_LINE_REPAY", _("Abono Línea de Crédito")

    class Method(models.TextChoices):
        CASH = "CASH", _("Efectivo")
        CARD = "CARD", _("Tarjeta (Manual)")
        DEBIT_CARD = "DEBIT_CARD", _("Tarjeta Débito Empresa")
        CREDIT_CARD = "CREDIT_CARD", _("Tarjeta Crédito Empresa")
        CARD_TERMINAL = "CARD_TERMINAL", _("Tarjeta (Terminal de cobro)")
        TRANSFER = "TRANSFER", _("Transferencia")
        CHECK = "CHECK", _("Cheque")
        CREDIT = "CREDIT", _("Crédito")
        WRITE_OFF = "WRITE_OFF", _("Castigo de Deuda")
        CREDIT_BALANCE = "CREDIT_BALANCE", _("Saldo a Favor")
        OTHER = "OTHER", _("Otro")

    class JustifyReason(models.TextChoices):
        COUNTING_ERROR = "COUNTING_ERROR", _("Error de Conteo")
        THEFT = "THEFT", _("Robo/Faltante")
        ROUNDING = "ROUNDING", _("Redondeo")
        TIP = "TIP", _("Propina")
        CASHBACK = "CASHBACK", _("Vuelto Incorrecto")
        SYSTEM_ERROR = "SYSTEM_ERROR", _("Error del Sistema")
        TRANSFER = "TRANSFER", _("Traspaso de Efectivo")
        PARTNER_WITHDRAWAL = "PARTNER_WITHDRAWAL", _("Retiro de Socio")
        CAPITAL_CONTRIBUTION = "CAPITAL_CONTRIBUTION", _("Aporte de Capital (Socio)")
        OTHER_IN = "OTHER_IN", _("Otro Ingreso")
        OTHER_OUT = "OTHER_OUT", _("Otro Egreso")
        OPENING_ADJUSTMENT = "OPENING_ADJUSTMENT", _("Ajuste de Apertura")
        RETIREMENT = "RETIREMENT", _("Retiro de Cierre")
        UNKNOWN = "UNKNOWN", _("Desconocido")

    movement_type = models.CharField(_("Tipo"), max_length=20, choices=Type.choices)
    payment_method = models.CharField(
        _("Método de Pago"), max_length=20, choices=Method.choices, default=Method.CASH
    )

    # Unified Source/Destination for Treasury Accounts
    # If None, it implies "External" (e.g. Customer/Supplier)
    from_account = models.ForeignKey(
        "TreasuryAccount",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="movements_from",
        verbose_name=_("Desde Cuenta (Origen)"),
    )
    to_account = models.ForeignKey(
        "TreasuryAccount",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="movements_to",
        verbose_name=_("Hacia Cuenta (Destino)"),
    )
    payment_method_new = models.ForeignKey(
        "PaymentMethod",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="movements",
        verbose_name=_("Método de Pago (Nuevo)"),
    )
    terminal_device = models.ForeignKey(
        "PaymentTerminalDevice",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="movements",
        verbose_name=_("Dispositivo de Terminal"),
        help_text=_("Hardware usado para el cobro (si corresponde)"),
    )

    # Legacy/Convenience access to the "Main" financial account involved (Snapshot)
    # Usually matches from_account.account (if OUTBOUND) or to_account.account (if INBOUND)
    account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        related_name="treasury_movements",
        null=True,
        blank=True,
        verbose_name=_("Cuenta Contable (Snapshot)"),
    )

    amount = models.DecimalField(_("Monto"), max_digits=12, decimal_places=2)
    date = models.DateField(
        _("Fecha"), default=get_current_date
    )  # Changed from auto_now_add to allow manual date setting
    reference = models.CharField(_("Referencia"), max_length=100, blank=True)
    notes = models.TextField(_("Notas"), blank=True)  # Added from CashMovement

    # Transfer details
    transaction_number = models.CharField(
        _("N° de Transacción"), max_length=100, blank=True, null=True
    )
    is_pending_registration = models.BooleanField(
        _("Transacción Pendiente de Registro"), default=False
    )

    # Unified contact field
    contact = models.ForeignKey(
        "contacts.Contact",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="treasury_movements",
    )

    # Allocation (GFK)
    allocated_content_type = models.ForeignKey(
        ContentType, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    allocated_object_id = models.PositiveIntegerField(null=True, blank=True)
    allocated_to = GenericForeignKey("allocated_content_type", "allocated_object_id")

    # Legacy Allocation fields
    invoice = models.ForeignKey(
        "billing.Invoice", on_delete=models.SET_NULL, null=True, blank=True, related_name="payments"
    )
    sale_order = models.ForeignKey(
        "sales.SaleOrder", on_delete=models.SET_NULL, null=True, blank=True, related_name="payments"
    )
    purchase_order = models.ForeignKey(
        "purchasing.PurchaseOrder",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payments",
    )

    class PayrollPaymentType(models.TextChoices):
        SALARY = "SALARY", _("Sueldo")
        PREVIRED = "PREVIRED", _("Previred")
        ADVANCE = "ADVANCE", _("Anticipo")

    payroll = models.ForeignKey(
        "hr.Payroll",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="treasury_movements",
    )
    payroll_payment_type = models.CharField(
        _("Tipo de Pago RRHH"),
        max_length=20,
        blank=True,
        null=True,
        choices=PayrollPaymentType.choices,
    )

    # Link to Accounting
    journal_entry = models.OneToOneField(
        "accounting.JournalEntry",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="treasury_movement",
    )

    # Bank Reconciliation
    bank_statement_line = models.ForeignKey(
        "BankStatementLine",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="matched_movements",
        verbose_name=_("Línea de Cartola Bancaria"),
    )
    reconciliation_match = models.ForeignKey(
        "ReconciliationMatch",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="movements",
        verbose_name=_("Grupo de Conciliación"),
    )
    is_reconciled = models.BooleanField(_("Reconciliado"), default=False)
    reconciled_at = models.DateTimeField(_("Fecha de Reconciliación"), null=True, blank=True)
    reconciled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reconciled_movements",
        verbose_name=_("Reconciliado Por"),
    )

    # Credit Line (for CREDIT_LINE_DRAW / CREDIT_LINE_REPAY movements)
    credit_line = models.ForeignKey(
        "CreditLine",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="movements",
        verbose_name=_("Línea de Crédito"),
    )

    # POS Session
    pos_session = models.ForeignKey(
        "POSSession",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="movements",
        verbose_name=_("Sesión de Caja"),
    )

    # Justification - from CashMovement
    justify_reason = models.CharField(
        _("Justificación"),
        max_length=50,
        choices=JustifyReason.choices,
        blank=True,
        null=True,
        help_text=_("Código de justificación para movimientos manuales"),
    )

    terminal_provider = models.ForeignKey(
        "PaymentTerminalProvider",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="movements",
        verbose_name=_("Proveedor Terminal"),
    )

    # Terminal batch linkage (for terminal payments)
    terminal_batch = models.ForeignKey(
        "TerminalBatch",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payments",
        verbose_name=_("Lote Terminal"),
        help_text=_("Lote al que pertenece este pago (si es terminal)"),
    )

    # Card purchase installments (Onda 2, ADR-0043): agrupa N
    # movimientos como cuotas de una misma compra en tarjeta. Un
    # grupo `CardPurchaseGroup` representa la compra; cada cuota
    # (1..N) puede ser OUTBOUND (principal) o ADJUSTMENT (interés).
    card_purchase_group = models.ForeignKey(
        "CardPurchaseGroup",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="movements",
        verbose_name=_("Grupo de Compra en Cuotas"),
        help_text=_(
            "Si el movimiento es una cuota de una compra con tarjeta, "
            "FK al grupo. Permite listar y conciliar todas las cuotas "
            "de una misma compra."
        ),
    )
    installment_number = models.PositiveSmallIntegerField(
        _("Número de Cuota"),
        null=True,
        blank=True,
        help_text=_("Posición de la cuota dentro del grupo (1..N)."),
    )
    is_installment_interest = models.BooleanField(
        _("Interés de Cuota"),
        default=False,
        help_text=_(
            "True si este movimiento es un ADJUSTMENT que imputa el "
            "interés explícito de una cuota (no el interés punitorio "
            "del emisor)."
        ),
    )
    # Onda 3 (ADR-0044): FK al statement de tarjeta al que pertenece
    # este movimiento como pago. Permite N pagos parciales — cada
    # pago es un TreasuryMovement que apunta al statement. La FK
    # inversa en `CreditCardStatement.payment_movements` lista
    # todos los pagos del statement.
    from_card_statement = models.ForeignKey(
        "CreditCardStatement",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payment_movements",
        verbose_name=_("Statement de Tarjeta Pagado"),
        help_text=_(
            "Si este movimiento es un pago (parcial o total) de un "
            "statement de tarjeta, FK al statement. Permite listar "
            "todos los pagos de un statement via payment_movements.all()."
        ),
    )
    # ── Billing flag (Onda 4) ────────────────────────────────────────────
    # Marca si este cargo ya fue facturado en un CreditCardStatement.
    # Solo aplica a movimientos OUTBOUND/ADJUSTMENT en cuentas CREDIT_CARD.
    # Cuando se crea un statement, se marca True y se suma al billed_amount.
    is_billed = models.BooleanField(
        _("Facturado"),
        default=False,
        db_index=True,
        help_text=_(
            "True si este cargo ya fue incluido en un CreditCardStatement. "
            "Movimientos no facturados aparecen en la vista de 'Cargos Pendientes'."
        ),
    )
    billed_in_statement = models.ForeignKey(
        "CreditCardStatement",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="billed_charges",
        verbose_name=_("Facturado en Statement"),
        help_text=_(
            "FK al CreditCardStatement en el que se facturó este cargo. "
            "Permite listar todos los movimientos que componen un statement."
        ),
    )

    class MovementStatus(models.TextChoices):
        DRAFT = "DRAFT", _("Borrador")
        POSTED = "POSTED", _("Contabilizado")
        CANCELLED = "CANCELLED", _("Anulado")

    status = models.CharField(
        _("Estado"),
        max_length=20,
        choices=MovementStatus.choices,
        default=MovementStatus.DRAFT,
        help_text=_("Estado del movimiento: Borrador, Contabilizado o Anulado."),
    )

    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_movements",
        verbose_name=_("Creado Por"),
    )

    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Movimiento de Tesorería")
        verbose_name_plural = _("Movimientos de Tesorería")
        ordering = ["-date", "-id"]
        indexes = [
            models.Index(fields=["from_account", "date"]),
            models.Index(fields=["to_account", "date"]),
            models.Index(fields=["is_reconciled"]),
            models.Index(fields=["transaction_number"]),
            models.Index(fields=["reference"]),
            # S2.4: Índices compuestos para queries de matching batch (B10)
            models.Index(
                fields=["from_account", "date", "is_reconciled"],
                name="idx_movement_from_date_recon",
            ),
            models.Index(
                fields=["to_account", "date", "is_reconciled"], name="idx_movement_to_date_recon"
            ),
        ]

    def __str__(self):
        return self.display_id

    @property
    def display_id(self):
        from core.prefix_registry import EntityPrefix
        return f"{EntityPrefix.TREASURY_MOVEMENT}-{self.id}"

    @property
    def treasury_account(self):
        """Backwards compatibility / Convenience: Main account"""
        if self.movement_type == self.Type.INBOUND:
            return self.to_account
        elif self.movement_type == self.Type.OUTBOUND:
            return self.from_account
        elif self.movement_type == self.Type.TRANSFER:
            # Ambiguous, return from_account by default or None
            return self.from_account
        return None

    def save(self, *args, **kwargs):
        # Validate Accounting Period is not closed
        is_new = self.pk is None
        from tax.models import AccountingPeriod

        try:
            period = AccountingPeriod.objects.filter(
                year=self.date.year, month=self.date.month
            ).first()

            if period and period.status == AccountingPeriod.Status.CLOSED:
                # If modifying existing, we might allow cancellation (though treasury is usually final)
                # But for now, strictly follow the rule: No movements in closed periods.
                if is_new:
                    raise ValidationError(
                        _(
                            "No se puede registrar un movimiento de tesorería en un periodo contable cerrado (%(period)s)."
                        )
                        % {"period": str(period)}
                    )
                else:
                    # In treasury, we rarely modify movements, but if we do, check original
                    # If the period is closed, we block any modification to avoid financial drift.
                    raise ValidationError(
                        _(
                            "No se puede modificar un movimiento de tesorería en un periodo contable cerrado."
                        )
                    )
        except ValidationError:
            raise
        except Exception:
            # Fallback if period query fails (e.g. missing period record)
            # Usually we don't want to block if periods haven't been initialized
            pass

        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        super().delete(*args, **kwargs)


class CardPurchaseGroup(models.Model):
    """
    Grupo de cuotas para una compra con tarjeta de crédito en N
    cuotas (Onda 2, ADR-0043).

    Representa la compra lógica y agrupa los `TreasuryMovement` que
    son cuotas de esa compra. Cada cuota puede ser:

    - 1 `OUTBOUND` por el principal de la cuota (deuda sube).
    - 1 `ADJUSTMENT` por el interés explícito de la cuota, si
      `monthly_rate > 0` (gasto financiero sube, deuda sube).

    El schedule se calcula con la fórmula francesa (cuota fija,
    interés decreciente, principal creciente). El redondeo se
    aplica a 2 decimales por cuota; el residuo se asigna a la
    última cuota para garantizar que la suma de principals
    coincida exactamente con `total_amount`.

    `client_reference` (opcional, unique) permite idempotencia
    ante doble POST desde un cliente. La unicidad es a nivel de
    grupo, no de movimiento: el `reference` de cada cuota
    (`CP-<uuid>-i<N>`) puede repetirse entre los N miembros del
    grupo, pero el `client_reference` del grupo es único.

    La factura o asiento contable de cada cuota sigue la misma
    lógica que un `OUTBOUND` normal (D=proveedor o gasto,
    H=pasivo tarjeta). El interés, si existe, se imputa en un
    ADJUSTMENT aparte (D=gasto_interés, H=pasivo tarjeta).
    """

    uuid = models.UUIDField(
        _("UUID"),
        default=uuid_lib.uuid4,
        editable=False,
        unique=True,
        help_text=_("Identificador externo del grupo (idempotencia)."),
    )
    card_account = models.ForeignKey(
        "TreasuryAccount",
        on_delete=models.PROTECT,
        related_name="card_purchase_groups",
        verbose_name=_("Tarjeta"),
    )
    partner = models.ForeignKey(
        "contacts.Contact",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="card_purchase_groups",
        verbose_name=_("Proveedor"),
    )
    total_amount = models.DecimalField(
        _("Monto Total"),
        max_digits=18,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    installments = models.PositiveSmallIntegerField(
        _("Cantidad de Cuotas"),
        validators=[MinValueValidator(1)],
    )
    monthly_rate = models.DecimalField(
        _("Tasa Mensual (0–1)"),
        max_digits=8,
        decimal_places=6,
        default=Decimal("0"),
        validators=[MinValueValidator(Decimal("0"))],
        help_text=_(
            "Tasa de interés explícita por cuota (ej. 0.015 = 1.5% "
            "mensual). 0 = cuotas sin interés."
        ),
    )
    principal_per_installment = models.DecimalField(
        _("Principal por Cuota (sin residuo)"),
        max_digits=18,
        decimal_places=2,
        help_text=_(
            "Snapshot del cálculo: `total_amount / installments` "
            "redondeado a 2 decimales. La última cuota absorbe el "
            "residuo."
        ),
    )
    first_installment_date = models.DateField(
        _("Fecha Primera Cuota"),
    )
    client_reference = models.CharField(
        _("Referencia Cliente"),
        max_length=128,
        blank=True,
        help_text=_(
            "ID externo opcional para idempotencia. Si llega un "
            "segundo POST con la misma `client_reference`, retorna "
            "el grupo existente sin duplicar cuotas."
        ),
    )
    notes = models.CharField(_("Notas"), max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="card_purchase_groups",
        verbose_name=_("Creado Por"),
    )

    class Meta:
        verbose_name = _("Grupo de Compra en Cuotas")
        verbose_name_plural = _("Grupos de Compra en Cuotas")
        ordering = ["-first_installment_date", "-id"]
        indexes = [
            models.Index(fields=["card_account", "first_installment_date"]),
            models.Index(fields=["partner", "first_installment_date"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["client_reference"],
                condition=~models.Q(client_reference=""),
                name="uniq_card_purchase_client_ref",
            ),
            models.CheckConstraint(
                condition=models.Q(installments__gte=1) & models.Q(installments__lte=36),
                name="ck_card_purchase_installments_range",
            ),
            models.CheckConstraint(
                condition=models.Q(monthly_rate__gte=0) & models.Q(monthly_rate__lt=1),
                name="ck_card_purchase_monthly_rate_range",
            ),
        ]

    def __str__(self):
        from core.prefix_registry import EntityPrefix
        return f"{EntityPrefix.CARD_PURCHASE_GROUP}-{self.uuid}"

    @property
    def display_id(self):
        from core.prefix_registry import EntityPrefix
        return f"{EntityPrefix.CARD_PURCHASE_GROUP}-{self.id}"

    @property
    def total_interest(self) -> Decimal:
        """Suma de los ADJUSTMENT de interés del grupo (cached al
        momento del cálculo; no recalcula histórico)."""
        agg = self.movements.filter(
            is_installment_interest=True,
        ).aggregate(total=models.Sum("amount"))
        return agg["total"] or Decimal("0")

    @property
    def total_payable(self) -> Decimal:
        """Total a pagar: principal + interés."""
        return self.total_amount + self.total_interest


class CardPurchaseInstallment(models.Model):
    """
    Cuota del cronograma de una compra con TC en N cuotas (ADR-0046).

    A diferencia del modelo anterior (ADR-0043), las cuotas **no** son
    `TreasuryMovement` ni generan asiento: el uso de la tarjeta se
    contabiliza una sola vez como un `OUTBOUND` por el total (pasivo
    completo en la fecha de compra). Esta tabla es solo el cronograma:
    define cuánto principal se factura en cada statement mensual.

    Estado por cuota:
    - `is_billed` / `billed_in_statement`: la cuota ya entró en el
      `billed_amount` de un statement (cuando `due_date <= cut_off_date`).
    El pago se hace a nivel statement (`pay_statement`), no por cuota.
    """

    card_purchase_group = models.ForeignKey(
        "CardPurchaseGroup",
        on_delete=models.CASCADE,
        related_name="schedule",
        verbose_name=_("Grupo de Compra"),
    )
    number = models.PositiveSmallIntegerField(
        _("Número de Cuota"),
        validators=[MinValueValidator(1)],
        help_text=_("Posición de la cuota dentro del grupo (1..N)."),
    )
    due_date = models.DateField(
        _("Fecha de Vencimiento"),
        help_text=_("Mes en que la cuota se factura en el statement."),
    )
    principal_amount = models.DecimalField(
        _("Principal de la Cuota"),
        max_digits=18,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    is_billed = models.BooleanField(
        _("Facturada"),
        default=False,
        db_index=True,
        help_text=_(
            "True si la cuota ya fue incluida en el billed_amount de un CreditCardStatement."
        ),
    )
    billed_in_statement = models.ForeignKey(
        "CreditCardStatement",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="installment_charges",
        verbose_name=_("Facturada en Statement"),
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("Cuota de Compra TC")
        verbose_name_plural = _("Cuotas de Compra TC")
        ordering = ["card_purchase_group", "number"]
        constraints = [
            models.UniqueConstraint(
                fields=["card_purchase_group", "number"],
                name="uniq_card_purchase_installment_number",
            ),
        ]
        indexes = [
            models.Index(fields=["is_billed", "due_date"]),
        ]

    def __str__(self):
        from core.prefix_registry import EntityPrefix
        return f"{EntityPrefix.CARD_PURCHASE_INSTALLMENT}-{self.card_purchase_group_id}-{self.number}"

    @property
    def display_id(self):
        from core.prefix_registry import EntityPrefix
        return f"{EntityPrefix.CARD_PURCHASE_INSTALLMENT}-{self.id}"


class CardPendingCharge(models.Model):
    """
    Cargo pendiente de facturar en una tarjeta de crédito (comisiones,
    impuestos, seguros, etc.). A diferencia de TreasuryMovement, este
    modelo NO representa un evento de tesorería real: el único movimiento
    en el ciclo de vida de la tarjeta es el TRANSFER al pagar el statement.

    Reemplaza el uso de TreasuryMovement ADJUSTMENT para cargos no
    facturados (ADR-0046 D-3 bis).
    """

    class ChargeType(models.TextChoices):
        COMMISSION = "COMMISSION", _("Comisión")
        TAX = "TAX", _("Impuesto")
        FEE = "FEE", _("Cargo")
        INSURANCE = "INSURANCE", _("Seguro")
        INTEREST = "INTEREST", _("Interés")
        OTHER = "OTHER", _("Otro")

    card_account = models.ForeignKey(
        "TreasuryAccount",
        on_delete=models.PROTECT,
        related_name="pending_charges",
        limit_choices_to={"account_type": "CREDIT_CARD"},
        verbose_name=_("Cuenta Tarjeta de Crédito"),
    )
    amount = models.DecimalField(
        _("Monto"),
        max_digits=14,
        decimal_places=2,
    )
    charge_type = models.CharField(
        _("Tipo de Cargo"),
        max_length=20,
        choices=ChargeType.choices,
        default=ChargeType.OTHER,
    )
    description = models.TextField(_("Descripción"), blank=True)
    date = models.DateField(_("Fecha"))

    # Billing tracking
    is_billed = models.BooleanField(_("Facturado"), default=False)
    billed_in_statement = models.ForeignKey(
        "CreditCardStatement",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pending_charges",
        verbose_name=_("Facturado en Statement"),
    )
    journal_entry = models.OneToOneField(
        "accounting.JournalEntry",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="card_pending_charge",
        verbose_name=_("Asiento Contable"),
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name=_("Creado Por"),
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("Cargo Pendiente de Tarjeta")
        verbose_name_plural = _("Cargos Pendientes de Tarjeta")
        ordering = ["-date", "-id"]
        indexes = [
            models.Index(fields=["card_account", "is_billed"]),
            models.Index(fields=["card_account", "date"]),
        ]

    def __str__(self):
        from core.prefix_registry import EntityPrefix
        return f"{EntityPrefix.CARD_PENDING_CHARGE}-{self.id} - {self.get_charge_type_display()} ${self.amount}"


class TreasuryAccountManager(models.Manager):
    """Custom manager with query helpers for filtering by payment methods."""

    def with_payment_methods(self):
        """
        Retorna solo cuentas que tengan al menos un método de pago habilitado.
        Útil para flujos generales (HUB, Compras) donde se filtran todas las cuentas.

        Returns:
            QuerySet: Cuentas con al menos un método habilitado
        """
        return self.filter(
            models.Q(allows_cash=True) | models.Q(allows_card=True) | models.Q(allows_transfer=True)
        )

    def for_payment_method(self, payment_method):
        """
        Retorna cuentas compatibles con un método específico.

        Args:
            payment_method (str): Método de pago ('CASH', 'CARD', 'TRANSFER')

        Returns:
            QuerySet: Cuentas que soportan el método especificado
        """
        lookup = {
            "CASH": "allows_cash",
            "CARD": "allows_card",
            "TRANSFER": "allows_transfer",
        }
        filter_key = lookup.get(payment_method)
        if not filter_key:
            return self.none()

        return self.filter(**{filter_key: True})


class TreasuryAccount(models.Model):
    class Type(models.TextChoices):
        CHECKING = "CHECKING", _("Cuenta Bancaria (Corriente/Vista)")
        CREDIT_CARD = "CREDIT_CARD", _("Tarjeta de Crédito (Cta. Propia)")
        LOAN = "LOAN", _("Préstamo Bancario (Pasivo)")
        CASH = "CASH", _("Caja Física (Efectivo)")
        BRIDGE = "BRIDGE", _("Puente")
        CHECK_PORTFOLIO = "CHECK_PORTFOLIO", _("Cheques en Cartera")
        ISSUED_CHECKS = "ISSUED_CHECKS", _("Cheques Girados por Pagar")

    # Types que NO son efectivo/banco directo — usan prefijos contables distintos
    # y son gestionados por el sistema (no editables vía wizard).
    _NON_CASH_EQUIVALENT_TYPES = frozenset({"BRIDGE", "CHECK_PORTFOLIO", "ISSUED_CHECKS"})

    name = models.CharField(_("Nombre"), max_length=100)
    code = models.CharField(_("Código"), max_length=20, blank=True, null=True)
    currency = models.CharField(_("Moneda"), max_length=3, default="CLP")

    # Linked financial account: Asset (Bank/Cash/Bridge) o Liability (tarjeta de crédito propia).
    account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        limit_choices_to={"account_type__in": [AccountType.ASSET, AccountType.LIABILITY]},
        related_name="treasury_accounts",
        verbose_name=_("Cuenta Contable"),
        null=True,
        blank=True,
    )

    account_type = models.CharField(
        _("Tipo"),
        max_length=20,  # Increased from 10 to accommodate new types
        choices=Type.choices,
        default=Type.CASH,
    )
    bank = models.ForeignKey(
        "Bank",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="treasury_accounts",
        verbose_name=_("Banco"),
    )
    account_number = models.CharField(
        _("N° de Cuenta Bancaria"),
        max_length=50,
        blank=True,
        null=True,
        help_text=_("Número de cuenta bancaria (solo para cuentas corrientes)"),
    )
    card_number = models.CharField(
        _("Número de Tarjeta"),
        max_length=50,
        blank=True,
        null=True,
        help_text=_("Número de la tarjeta de crédito (solo para tarjetas de crédito)"),
    )
    credit_limit = models.DecimalField(
        _("Cupo Total"),
        max_digits=18,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=_("Límite de crédito total otorgado por el banco para esta tarjeta."),
    )
    default_bank_format = models.CharField(
        _("Formato Bancario por Defecto"),
        max_length=50,
        blank=True,
        null=True,
        help_text=_("Formato sugerido para esta cuenta al importar cartolas (ej: BANCO_CHILE_CSV)"),
    )
    allows_cash = models.BooleanField(_("Permite Efectivo"), default=False)
    allows_card = models.BooleanField(_("Permite Tarjeta"), default=False)
    allows_transfer = models.BooleanField(_("Permite Traspaso"), default=False)
    allows_check = models.BooleanField(_("Permite Cheque"), default=False)
    is_active = models.BooleanField(
        _("Activa"),
        default=True,
        db_index=True,
        help_text=_(
            "Desactivar para archivar la cuenta (cerrada); los movimientos históricos la siguen referenciando."
        ),
    )

    # Custom manager
    objects = TreasuryAccountManager()

    class Meta:
        verbose_name = _("Cuenta de Tesorería")
        verbose_name_plural = _("Cuentas de Tesorería")
        ordering = ["-id"]

    def __str__(self):
        return f"{self.name} ({self.currency})"

    def clean(self):
        """
        Validation Logic:
        1. Ensure Cash accounts have a unique accounting account.
        2. Validate account_number only for BANK type accounts.
        3. CHECKING accounts require bank and account_number.
        4. Credit/Debit cards require bank.
        5. CASH accounts cannot have bank.
        """
        from django.core.exceptions import ValidationError

        if self.account_id:
            # 1. Leaf account validation
            if not self.account.is_selectable:
                raise ValidationError(
                    {
                        "account": _(
                            "La cuenta contable debe ser una cuenta auxiliar (hoja) sin subcuentas."
                        )
                    }
                )

            # 2. Account nature validation by treasury type:
            #    - CREDIT_CARD: tarjeta propia = PASIVO (deuda rotativa), no efectivo.
            #    - cash-equivalent (CASH/CHECKING/legacy): 'Efectivo y Equivalentes' (1.1.01).
            #    - BRIDGE: otros activos de clearing/AR (sin check de prefijo).
            if self.account_type == self.Type.CREDIT_CARD:
                if self.account.account_type != AccountType.LIABILITY:
                    raise ValidationError(
                        {
                            "account": _(
                                "La tarjeta de crédito propia debe vincularse a una cuenta de PASIVO (deuda), no a Efectivo."
                            )
                        }
                    )
            elif self.account_type == self.Type.LOAN:
                if self.account.account_type != AccountType.LIABILITY:
                    raise ValidationError(
                        {
                            "account": _(
                                "La cuenta de Préstamo Bancario debe vincularse a una cuenta de PASIVO (deuda por pagar), no a Efectivo."
                            )
                        }
                    )
            elif self.account_type == self.Type.CHECK_PORTFOLIO:
                if self.account.account_type != AccountType.ASSET:
                    raise ValidationError(
                        {
                            "account": _(
                                "La cuenta de Cheques en Cartera debe ser una cuenta de ACTIVO (documentos por cobrar)."
                            )
                        }
                    )
            elif self.account_type not in self._NON_CASH_EQUIVALENT_TYPES:
                if not Account.get_cash_pool_accounts().filter(pk=self.account.pk).exists():
                    raise ValidationError(
                        {
                            "account": _(
                                "La cuenta contable debe pertenecer al grupo de 'Efectivo y Equivalentes'."
                            )
                        }
                    )

            # 3. Duplicate usage validation (already exists but refined)
            duplicates = TreasuryAccount.objects.filter(account=self.account).exclude(id=self.id)
            if duplicates.exists():
                dup_names = ", ".join([t.name for t in duplicates])
                raise ValidationError(
                    {
                        "account": _(
                            f"La cuenta contable '{self.account.code}' ya está en uso por: {dup_names}. "
                            "Cada cuenta de tesorería debe tener una cuenta contable exclusiva."
                        )
                    }
                )

        # Validate CHECKING accounts
        if self.account_type == self.Type.CHECKING:
            if not self.bank:
                raise ValidationError(
                    {"bank": _("Las cuentas corrientes requieren un banco asociado")}
                )
            if not self.account_number:
                raise ValidationError(
                    {"account_number": _("Las cuentas corrientes requieren número de cuenta")}
                )

        # Validate Credit cards
        if self.account_type == self.Type.CREDIT_CARD:
            if not self.bank:
                raise ValidationError({"bank": _("Las tarjetas requieren un banco asociado")})
            if not self.card_number:
                raise ValidationError(
                    {"card_number": _("Las tarjetas de crédito requieren número de tarjeta")}
                )

        # Validate CASH accounts
        if self.account_type == self.Type.CASH and self.bank:
            raise ValidationError(
                {"bank": _("Las cajas de efectivo no deben tener banco asociado")}
            )

        # Validate account_number only for bank-related accounts
        if self.account_number and self.account_type not in [
            self.Type.CHECKING,
            self.Type.CREDIT_CARD,
        ]:
            raise ValidationError(
                {
                    "account_number": _(
                        "Solo las cuentas bancarias y tarjetas pueden tener número de cuenta"
                    )
                }
            )

        # Validate card_number only for CREDIT_CARD
        if self.card_number and self.account_type != self.Type.CREDIT_CARD:
            raise ValidationError(
                {"card_number": _("El número de tarjeta solo aplica para tarjetas de crédito")}
            )

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    @property
    def current_balance(self):
        """
        Returns the accounting balance of the linked account.
        If no account is linked, returns 0.
        """
        if self.account:
            return self.account.balance
        return 0

    @property
    def available_liquidity(self) -> Decimal:
        """
        Liquidez disponible: saldo contable + crédito disponible de la línea.
        Representa la capacidad total de realizar pagos (fondos propios + financiación).
        """
        balance = self.current_balance
        cl = getattr(self, "credit_line", None)
        if cl and cl.status == CreditLine.Status.ACTIVE:
            return balance + cl.available_amount
        return balance

    @property
    def available_credit(self) -> Decimal | None:
        """
        Cupo disponible de la tarjeta: credit_limit - deuda actual.
        Considera saldo contable + cargos pendientes no facturados
        + cuotas del cronograma no facturadas.
        Retorna None si no es CREDIT_CARD o no tiene credit_limit.
        """
        if self.account_type != self.Type.CREDIT_CARD or self.credit_limit is None:
            return None

        current_debt = abs(self.current_balance) if self.current_balance else Decimal("0")

        unbilled_charges = CardPendingCharge.objects.filter(
            card_account=self, is_billed=False
        ).aggregate(total=models.Sum("amount"))["total"] or Decimal("0")
        unbilled_installments = CardPurchaseInstallment.objects.filter(
            card_purchase_group__card_account=self, is_billed=False
        ).aggregate(total=models.Sum("principal_amount"))["total"] or Decimal("0")

        used = current_debt + unbilled_charges + unbilled_installments
        return max(self.credit_limit - used, Decimal("0"))

    history = HistoricalRecords()


class POSTerminal(models.Model):
    """
    Represents a physical POS terminal (point of sale hardware/software).
    Terminals can use multiple treasury accounts for payment processing.
    """

    name = models.CharField(
        _("Nombre del Terminal"),
        max_length=100,
        help_text=_("Ej: 'Caja 1', 'Mostrador Principal', 'Terminal Móvil'"),
    )
    code = models.CharField(
        _("Código"), max_length=20, unique=True, help_text=_("Identificador único del terminal")
    )
    location = models.CharField(
        _("Ubicación"), max_length=200, blank=True, help_text=_("Ubicación física del terminal")
    )
    is_active = models.BooleanField(_("Activo"), default=True)

    # ManyToMany: Cuentas de tesorería permitidas para este terminal
    allowed_payment_methods = models.ManyToManyField(
        "PaymentMethod",
        related_name="pos_terminals",
        verbose_name=_("Métodos de Pago Permitidos"),
        help_text=_("Métodos de pago específicos permitidos en este terminal"),
        blank=True,
    )

    # ManyToMany: Cuentas de tesorería permitidas para este terminal (Legacy/Optional)
    allowed_treasury_accounts = models.ManyToManyField(
        "TreasuryAccount",
        related_name="pos_terminals",
        verbose_name=_("Cuentas de Tesorería (Legacy)"),
        help_text=_("DEPRECATED: Use allowed_payment_methods instead"),
        blank=True,
    )

    # Cuenta predeterminada (para sugerencias en UI)
    default_treasury_account = models.ForeignKey(
        "TreasuryAccount",
        on_delete=models.PROTECT,
        related_name="default_for_terminals",
        null=True,
        blank=True,
        verbose_name=_("Cuenta de Tesorería por Defecto"),
        help_text=_("Cuenta predeterminada al iniciar sesión"),
    )

    payment_terminal_device = models.ForeignKey(
        "PaymentTerminalDevice",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pos_terminals",
        verbose_name=_("Dispositivo de Terminal"),
        help_text=_("Dispositivo físico vinculado a esta caja para cobros integrados"),
    )

    # Hardware information (optional)
    serial_number = models.CharField(_("Número de Serie"), max_length=100, blank=True)
    ip_address = models.GenericIPAddressField(_("Dirección IP"), null=True, blank=True)

    @property
    def payment_terminal_device_name(self):
        return self.payment_terminal_device.name if self.payment_terminal_device else None

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Terminal POS")
        verbose_name_plural = _("Terminales POS")
        ordering = ["code"]

    def __str__(self):
        return f"{self.name} ({self.code})"

    @property
    def allowed_payment_method_types(self):
        """
        Tipos de métodos de pago permitidos en este terminal.
        Sustituye DEBIT_CARD y CREDIT_CARD por 'CARD' para agrupar en la UI.
        """
        types = set()
        for mt in self.allowed_payment_methods.values_list("method_type", flat=True):
            if mt in ["DEBIT_CARD", "CREDIT_CARD"]:
                types.add("CARD")
            else:
                types.add(mt)
        return sorted(list(types))

    def get_accounts_for_method(self, payment_method):
        """
        Retorna cuentas de tesorería permitidas que soporten el método dado.

        Args:
            payment_method (str): Método de pago ('CASH', 'CARD', 'TRANSFER')

        Returns:
            QuerySet[TreasuryAccount]: Cuentas compatibles con el método
        """
        # Mapping from generic payment buttons to specific backend types
        method_types = {
            "CASH": ["CASH"],
            "CARD": ["DEBIT_CARD", "CREDIT_CARD"],
            "CARD_TERMINAL": ["CARD_TERMINAL"],
            "TRANSFER": ["TRANSFER"],
            "CHECK": ["CHECK"],
        }.get(payment_method, [payment_method])

        # Get accounts and their IDs from allowed payment methods
        account_ids = self.allowed_payment_methods.filter(
            method_type__in=method_types, is_active=True
        ).values_list("treasury_account_id", flat=True)

        return TreasuryAccount.objects.filter(id__in=account_ids)


class BankStatement(models.Model):
    """Cartola bancaria importada"""

    class Status(models.TextChoices):
        DRAFT = "DRAFT", _("Borrador")
        CONFIRMED = "CONFIRMED", _("Confirmado")
        CANCELLED = "CANCELLED", _("Cancelado")

    State = Status  # Alias for backward compatibility

    treasury_account = models.ForeignKey(
        "TreasuryAccount",
        on_delete=models.PROTECT,
        related_name="bank_statements",
        verbose_name=_("Cuenta de Tesorería"),
    )
    statement_date = models.DateField(_("Fecha de la Cartola"))
    period_start = models.DateField(
        _("Inicio del Periodo"),
        null=True,
        help_text=_("Fecha de la transacción más antigua incluida"),
    )
    period_end = models.DateField(
        _("Fin del Periodo"),
        null=True,
        help_text=_("Fecha de la transacción más reciente incluida"),
    )
    opening_balance = models.DecimalField(_("Balance de Apertura"), max_digits=20, decimal_places=2)
    closing_balance = models.DecimalField(_("Balance de Cierre"), max_digits=20, decimal_places=2)
    file = models.FileField(
        _("Archivo"),
        upload_to="bank_statements/",
        storage=PrivateMediaStorage(),
        null=True,
        blank=True,
        validators=[validate_file_size, validate_file_extension],
    )
    imported_at = models.DateTimeField(_("Importado el"), auto_now_add=True)
    imported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="imported_statements",
        verbose_name=_("Importado Por"),
    )
    status = models.CharField(
        _("Estado"), max_length=20, choices=Status.choices, default=Status.DRAFT
    )

    @property
    def state(self):
        return self.status

    # Metadatos
    bank_format = models.CharField(
        _("Formato Bancario"),
        max_length=50,
        default="GENERIC_CSV",
        help_text=_("Formato usado para parsear el archivo (ej: BANCO_CHILE_CSV, GENERIC_CSV)"),
    )
    total_lines = models.IntegerField(_("Total de Líneas"), default=0)

    @property
    def reconciled_lines(self):
        return self.lines.filter(reconciliation_status="RECONCILED").count()

    file_hash = models.CharField(
        _("Hash del Archivo"),
        max_length=64,
        unique=True,
        null=True,
        blank=True,
        help_text=_("Hash SHA-256 para evitar duplicidad de archivos"),
    )

    notes = models.TextField(_("Notas"), blank=True)

    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Cartola Bancaria")
        verbose_name_plural = _("Cartolas Bancarias")
        ordering = ["-statement_date", "-id"]
        indexes = [
            models.Index(fields=["statement_date", "treasury_account"]),
        ]

    def __str__(self):
        return f"{self.treasury_account.name} - {self.statement_date}"

    @property
    def display_id(self):
        from core.prefix_registry import EntityPrefix
        return f"{EntityPrefix.BANK_STATEMENT}-{self.id}"

    @property
    def reconciliation_progress(self):
        """Retorna porcentaje de reconciliación"""
        if self.total_lines == 0:
            return 0
        return round((self.reconciled_lines / self.total_lines) * 100, 1)


class BankStatementLine(models.Model):
    """Línea individual de la cartola bancaria"""

    class ReconciliationStatus(models.TextChoices):
        UNRECONCILED = "UNRECONCILED", _("No Reconciliado")
        MATCHED = "MATCHED", _("Matched (Pendiente Confirmar)")
        RECONCILED = "RECONCILED", _("Reconciliado")
        DISPUTED = "DISPUTED", _("En Disputa")
        EXCLUDED = "EXCLUDED", _("Excluido")

    ReconciliationState = ReconciliationStatus  # Alias

    statement = models.ForeignKey(
        "BankStatement", on_delete=models.CASCADE, related_name="lines", verbose_name=_("Cartola")
    )
    line_number = models.IntegerField(_("N° de Línea"))

    # Datos bancarios
    transaction_date = models.DateField(_("Fecha de Transacción"))
    value_date = models.DateField(_("Fecha Valor"), null=True, blank=True)
    description = models.TextField(_("Descripción"))
    reference = models.CharField(_("Referencia"), max_length=200, blank=True)
    transaction_id = models.CharField(
        _("ID de Transacción"),
        max_length=100,
        blank=True,
        help_text=_("ID único del banco para esta transacción"),
    )

    # Montos
    debit = models.DecimalField(_("Cargo"), max_digits=20, decimal_places=2, default=0)
    credit = models.DecimalField(_("Abono"), max_digits=20, decimal_places=2, default=0)
    balance = models.DecimalField(_("Balance Resultante"), max_digits=20, decimal_places=2)

    # Conciliación
    reconciliation_status = models.CharField(
        _("Estado de Reconciliación"),
        max_length=20,
        choices=ReconciliationStatus.choices,
        default=ReconciliationStatus.UNRECONCILED,
    )

    @property
    def reconciliation_state(self):
        return self.reconciliation_status

    reconciliation_match = models.ForeignKey(
        "ReconciliationMatch",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lines",
        verbose_name=_("Grupo de Conciliación"),
    )
    reconciled_at = models.DateTimeField(_("Reconciliado el"), null=True, blank=True)
    reconciled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reconciled_lines",
        verbose_name=_("Reconciliado Por"),
    )

    # Diferencias (para fase 2)
    difference_amount = models.DecimalField(
        _("Diferencia"), max_digits=20, decimal_places=2, default=0
    )
    difference_reason = models.CharField(
        _("Razón de Diferencia"),
        max_length=50,
        blank=True,
        help_text=_("COMMISSION, INTEREST, ERROR, etc."),
    )
    difference_journal_entry = models.ForeignKey(
        "accounting.JournalEntry",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reconciliation_adjustments",
        verbose_name=_("Asiento de Ajuste"),
    )

    # Advertencias de importación
    has_warning = models.BooleanField(_("Tiene Advertencia"), default=False)
    warning_message = models.TextField(_("Mensaje de Advertencia"), blank=True, null=True)

    # Notas
    notes = models.TextField(_("Notas"), blank=True)

    # Exclusión
    class ExclusionReason(models.TextChoices):
        DUPLICATE = "DUPLICATE", _("Transacción Duplicada")
        INTERNAL = "INTERNAL", _("Traspaso Interno no Conciliable")
        ADJUSTMENT = "ADJUSTMENT", _("Ajuste de Saldo")
        ERROR = "ERROR", _("Error de Importación / Datos Corruptos")
        OTHER = "OTHER", _("Otro (Especificar en notas)")

    exclusion_reason = models.CharField(
        _("Razón de Exclusión"),
        max_length=50,
        choices=ExclusionReason.choices,
        blank=True,
        null=True,
    )
    exclusion_notes = models.TextField(_("Notas de Exclusión"), blank=True, null=True)

    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Línea de Cartola")
        verbose_name_plural = _("Líneas de Cartola")
        ordering = ["statement", "line_number"]
        unique_together = [["statement", "line_number"]]
        indexes = [
            models.Index(fields=["reconciliation_status"]),
            models.Index(fields=["transaction_date"]),
            models.Index(fields=["statement", "reconciliation_status"]),
            models.Index(fields=["transaction_id"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["statement", "transaction_id"],
                condition=~models.Q(transaction_id=""),
                name="uniq_stmt_txnid",
            )
        ]

    def __str__(self):
        return f"{self.statement.display_id} - Línea {self.line_number}"

    @property
    def amount(self):
        """Retorna el monto neto (credit - debit)"""
        return self.credit - self.debit


class ReconciliationSettings(TimeStampedModel):
    """Configuración global de conciliación por cuenta de tesorería.
    NOTE: created_at / updated_at heredados de TimeStampedModel (T-14).
    Tenía updated_at manual — ahora heredado; se añade created_at.
    """

    treasury_account = models.OneToOneField(
        "TreasuryAccount",
        on_delete=models.CASCADE,
        related_name="reconciliation_settings",
        verbose_name=_("Cuenta de Tesorería"),
        null=True,
        blank=True,
    )

    # Pesos de scoring (Importancia)
    amount_weight = models.IntegerField(_("Peso del Monto"), default=40)
    date_weight = models.IntegerField(_("Peso de la Fecha"), default=30)
    reference_weight = models.IntegerField(_("Peso de la Referencia"), default=20)
    contact_weight = models.IntegerField(_("Peso del Contacto"), default=10)

    # Umbrales
    confidence_threshold = models.IntegerField(
        _("Umbral de Confianza"),
        default=90,
        help_text=_("Puntaje mínimo para sugerir o auto-conciliar (0-100)"),
    )

    # Filtros
    date_range_days = models.IntegerField(
        _("Rango de Búsqueda (Días)"),
        default=30,
        help_text=_("Días hacia atrás/adelante para buscar candidatos"),
    )

    auto_confirm = models.BooleanField(
        _("Auto-confirmar"),
        default=False,
        help_text=_("Si es True, el sistema concilia automáticamente sobre el umbral de confianza"),
    )

    # updated_at heredado de TimeStampedModel; campo manual eliminado (T-14).
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Inteligencia de Conciliación")
        verbose_name_plural = _("Inteligencia de Conciliación")

    class FormMeta:
        exclude_fields = []  # Sin campos sensibles — pesos de scoring y umbrales numéricos.

    @classmethod
    def get_for_account(cls, account=None):
        """
        Obtiene la configuración de inteligencia global.
        (Configuración unificada para todas las cuentas).
        """
        settings = cls.objects.filter(treasury_account__isnull=True).first()

        if not settings:
            # Fallback a valores default si no hay nada en DB
            return cls(
                amount_weight=40,
                date_weight=30,
                reference_weight=20,
                contact_weight=10,
                confidence_threshold=90,
                date_range_days=30,
            )
        return settings

    def __str__(self):
        return "Inteligencia de Conciliación Global"


class Bank(models.Model):
    """Bancos institucionales"""

    name = models.CharField(_("Nombre"), max_length=100)
    code = models.CharField(_("Código"), max_length=20, blank=True, null=True)
    swift_code = models.CharField(
        _("Código SWIFT/BIC"),
        max_length=11,
        blank=True,
        null=True,
        help_text=_("Código internacional para transferencias"),
    )
    is_active = models.BooleanField(_("Activo"), default=True)

    # Ejecutivos de cuenta
    account_executives = models.ManyToManyField(
        "contacts.Contact",
        blank=True,
        related_name="managed_banks",
        verbose_name=_("Ejecutivos de Cuenta"),
        help_text=_("Contactos que son ejecutivos de este banco"),
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Banco")
        verbose_name_plural = _("Bancos")
        ordering = ["name"]

    def __str__(self):
        return self.name


class PaymentTerminalProvider(models.Model):
    """
    Proveedor de terminal de cobro (Transbank, TUU, etc.).
    Encapsula la configuración contable, comisiones y gateway.
    """

    class ProviderType(models.TextChoices):
        TRANSBANK = "TRANSBANK", _("Transbank")
        TUU = "TUU", _("TUU / Haulmer")
        MERCADOPAGO = "MERCADOPAGO", _("MercadoPago")
        FINTOC = "FINTOC", _("Fintoc")
        FLOW = "FLOW", _("Flow")
        MANUAL = "MANUAL", _("Manual en Máquina (Genérico)")

    name = models.CharField(_("Nombre"), max_length=100)
    provider_type = models.CharField(
        _("Tipo de Proveedor"),
        max_length=20,
        choices=ProviderType.choices,
        default=ProviderType.MANUAL,
    )
    supplier = models.ForeignKey(
        "contacts.Contact",
        on_delete=models.PROTECT,
        related_name="terminal_providers",
        verbose_name=_("Proveedor (Contacto)"),
    )
    is_active = models.BooleanField(_("Activo"), default=True)
    notes = models.TextField(_("Notas"), blank=True)

    # Configuración Contable
    receivable_account = models.ForeignKey(
        "accounting.Account",
        on_delete=models.PROTECT,
        related_name="terminal_provider_receivable",
        verbose_name=_("Cuenta Por Cobrar Terminal"),
    )
    commission_expense_account = models.ForeignKey(
        "accounting.Account",
        on_delete=models.PROTECT,
        related_name="terminal_provider_commission",
        verbose_name=_("Cuenta Gasto Comisión"),
    )
    commission_iva_account = models.ForeignKey(
        "accounting.Account",
        on_delete=models.PROTECT,
        related_name="terminal_provider_iva",
        verbose_name=_("Cuenta IVA Comisión"),
    )
    commission_product = models.ForeignKey(
        "inventory.Product",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="terminal_commission_providers",
        verbose_name=_("Producto Servicio Comisión"),
    )
    bank_treasury_account = models.ForeignKey(
        "TreasuryAccount",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="terminal_providers",
        verbose_name=_("Cuenta Destino Liquidación"),
    )
    default_deposit_account = models.ForeignKey(
        "TreasuryAccount",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
        verbose_name=_("Cuenta de Tesorería por Defecto (Depósito)"),
    )

    gateway_config = models.JSONField(_("Configuración de Gateway"), default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Proveedor de Terminal")
        verbose_name_plural = _("Proveedores de Terminal")
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.get_provider_type_display()})"

    # Clave para el secreto cifrado dentro de gateway_config
    _API_KEY_FIELD = "api_key_encrypted"

    def get_api_key(self) -> str:
        """Retorna la API key en claro. Vacío si no hay credencial configurada."""
        from core.crypto import decrypt_secret

        token = (self.gateway_config or {}).get(self._API_KEY_FIELD, "")
        return decrypt_secret(token) if token else ""

    def set_api_key(self, plaintext: str) -> None:
        """Cifra y persiste la API key en gateway_config. Llamar save() aparte."""
        from core.crypto import encrypt_secret

        cfg = dict(self.gateway_config or {})
        if plaintext:
            cfg[self._API_KEY_FIELD] = encrypt_secret(plaintext)
        else:
            cfg.pop(self._API_KEY_FIELD, None)
        self.gateway_config = cfg

    def clean(self):
        from django.core.exceptions import ValidationError

        if (
            self.default_deposit_account
            and self.default_deposit_account.account_type
            in TreasuryAccount._NON_CASH_EQUIVALENT_TYPES
        ):
            raise ValidationError(
                {
                    "default_deposit_account": _(
                        "La cuenta de tesorería por defecto no puede ser de tipo puente (BRIDGE). "
                        "Seleccione una cuenta bancaria (CHECKING) o de caja (CASH)."
                    )
                }
            )


class PaymentTerminalDevice(models.Model):
    """
    Representa el hardware/dispositivo físico de cobro (la 'maquinita').
    Distingue la máquina de transbank/TUU separada del POS del ERP.
    """

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", _("Activo")
        INACTIVE = "INACTIVE", _("Inactivo")
        MAINTENANCE = "MAINTENANCE", _("En Mantención")

    name = models.CharField(
        _("Nombre / Alias"), max_length=100, help_text=_("Ej: Terminal Barra 1")
    )
    provider = models.ForeignKey(
        PaymentTerminalProvider,
        on_delete=models.CASCADE,
        related_name="devices",
        verbose_name=_("Proveedor"),
    )
    serial_number = models.CharField(
        _("Número de Serie Interno / ID Dispositivo"),
        max_length=100,
        help_text=_("ID único que el proveedor asigna a este dispositivo físico (ej: TU1245)"),
    )
    status = models.CharField(
        _("Estado"), max_length=20, choices=Status.choices, default=Status.ACTIVE
    )
    notes = models.TextField(_("Notas"), blank=True)

    supported_payment_methods = models.JSONField(
        _("Métodos Soportados"),
        default=list,
        blank=True,
        help_text=_("Lista de códigos soportados. 1: Crédito, 2: Débito. Ej: [1, 2]"),
    )
    device_config = models.JSONField(_("Configuración del Dispositivo"), default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Dispositivo de Terminal")
        verbose_name_plural = _("Dispositivos de Terminal")
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.serial_number})"


class PaymentMethod(models.Model):
    """Métodos de pago específicos asociados a una cuenta de tesorería"""

    class Type(models.TextChoices):
        CASH = "CASH", _("Efectivo Directo")
        CARD = "CARD", _("Tarjeta (Manual)")
        DEBIT_CARD = "DEBIT_CARD", _("Tarjeta Débito Empresa")
        CREDIT_CARD = "CREDIT_CARD", _("Tarjeta Crédito Empresa")
        CARD_TERMINAL = "CARD_TERMINAL", _("Tarjeta (Terminal de cobro)")
        TRANSFER = "TRANSFER", _("Transferencia Bancaria")
        CHECK = "CHECK", _("Cheque")

    name = models.CharField(_("Nombre"), max_length=100)
    method_type = models.CharField(_("Tipo de Método"), max_length=20, choices=Type.choices)
    treasury_account = models.ForeignKey(
        "TreasuryAccount",
        on_delete=models.CASCADE,
        related_name="payment_methods",
        verbose_name=_("Cuenta de Tesorería Visible"),
        help_text=_(
            "Cuenta mostrada al operador. Para contabilidad usar effective_settlement_account."
        ),
    )
    settlement_account = models.ForeignKey(
        "TreasuryAccount",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="payment_methods_as_settlement",
        verbose_name=_("Cuenta de Liquidación"),
        help_text=_(
            "Cuenta destino contable real. Para CARD_TERMINAL: cuenta puente del proveedor."
        ),
    )
    is_active = models.BooleanField(_("Activo"), default=True)
    linked_terminal_device = models.ForeignKey(
        "PaymentTerminalDevice",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="card_terminal_methods",
        verbose_name=_("Dispositivo Terminal Vinculado"),
        help_text=_("Solo para CARD_TERMINAL — el device TUU que automatiza este método."),
    )
    allow_for_sales = models.BooleanField(_("Permitir en Ventas"), default=True)
    allow_for_purchases = models.BooleanField(_("Permitir en Compras"), default=True)

    # Optional settings per method
    requires_reference = models.BooleanField(_("Requiere Referencia"), default=False)
    notes = models.TextField(_("Notas"), blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Método de Pago")
        verbose_name_plural = _("Métodos de Pago")
        ordering = ["name"]

    # Mapeo de compatibilidad tipo cuenta ↔ método de pago
    TYPE_COMPATIBILITY = {
        Type.CASH: [TreasuryAccount.Type.CASH],
        # DEBIT_CARD / CREDIT_CARD / CARD_TERMINAL como métodos de pago se
        # vinculan a CHECKING (cuenta corriente) o CREDIT_CARD (línea propia).
        # DEBIT_CARD y CHECKBOOK como tipos de cuenta están eliminados (ADR-0031):
        # ver `converge_treasury_accounts` y docs/50-audit/bancos/fase-1-operativo.md.
        Type.DEBIT_CARD: [TreasuryAccount.Type.CREDIT_CARD, TreasuryAccount.Type.CHECKING],
        Type.CREDIT_CARD: [TreasuryAccount.Type.CREDIT_CARD, TreasuryAccount.Type.CHECKING],
        Type.CARD_TERMINAL: [TreasuryAccount.Type.CREDIT_CARD, TreasuryAccount.Type.CHECKING],
        Type.TRANSFER: [TreasuryAccount.Type.CHECKING],
        # CHECK para compras: vinculado a CHECKING (cheque propio girado).
        # CHECK para ventas: vinculado a CHECK_PORTFOLIO (cheque recibido en cartera).
        Type.CHECK: [TreasuryAccount.Type.CHECKING, TreasuryAccount.Type.CHECK_PORTFOLIO],
    }

    def __str__(self):
        return f"{self.name} ({self.treasury_account.name})"

    @property
    def is_integrated(self):
        """True si el método tiene integración remota con un terminal físico."""
        return (
            self.method_type == self.Type.CARD_TERMINAL
            and self.linked_terminal_device_id is not None
        )

    @property
    def effective_settlement_account(self):
        """
        Cuenta destino real del cobro.
        Precedencia: settlement_account explícito → provider.bank_treasury_account (CARD_TERMINAL) → treasury_account.
        """
        if self.settlement_account_id:
            return self.settlement_account
        if self.is_integrated and self.linked_terminal_device.provider.bank_treasury_account_id:
            return self.linked_terminal_device.provider.bank_treasury_account
        return self.treasury_account

    def clean(self):
        """Validar compatibilidad entre método y tipo de cuenta"""
        from django.core.exceptions import ValidationError

        super().clean()

        # DEBIT_CARD / CREDIT_CARD → solo compras
        if self.method_type in (self.Type.DEBIT_CARD, self.Type.CREDIT_CARD):
            self.allow_for_sales = False

        # CHECK vinculado a CHECKING → solo compras (cheque propio girado a proveedor).
        # CHECK vinculado a CHECK_PORTFOLIO → solo ventas (cheque recibido de cliente).
        if self.method_type == self.Type.CHECK and self.treasury_account_id:
            acct_type = self.treasury_account.account_type
            if acct_type == TreasuryAccount.Type.CHECKING:
                self.allow_for_sales = False
            elif acct_type == TreasuryAccount.Type.CHECK_PORTFOLIO:
                self.allow_for_purchases = False

        # CARD_TERMINAL → solo ventas, requiere device vinculado
        if self.method_type == self.Type.CARD_TERMINAL:
            self.allow_for_purchases = False
            if not self.linked_terminal_device_id:
                raise ValidationError(
                    {
                        "linked_terminal_device": _(
                            "CARD_TERMINAL requiere un dispositivo terminal vinculado."
                        )
                    }
                )

            # Auto-asignar y bloquear settlement_account desde provider.bank_treasury_account.
            # El operador no puede sobrescribir esta cuenta — la define el proveedor.
            provider_bridge = self.linked_terminal_device.provider.bank_treasury_account
            if provider_bridge is None:
                raise ValidationError(
                    {
                        "linked_terminal_device": _(
                            "El proveedor del dispositivo no tiene cuenta destino de liquidación configurada. "
                            "Configure 'Cuenta Destino Liquidación' en el Proveedor de Terminal antes de crear este método."
                        )
                    }
                )
            if self.settlement_account_id and self.settlement_account_id != provider_bridge.pk:
                raise ValidationError(
                    {
                        "settlement_account": _(
                            "La cuenta de liquidación de métodos CARD_TERMINAL está gestionada por el sistema "
                            "y se asigna automáticamente desde el proveedor del dispositivo. "
                            f"Cuenta asignada: {provider_bridge.name}."
                        )
                    }
                )
            # Forzar siempre la cuenta del proveedor (auto-sync)
            self.settlement_account = provider_bridge

        if not self.treasury_account_id:
            return

        # CARD_TERMINAL: cuenta resuelta arriba, no aplicar TYPE_COMPATIBILITY.
        if self.method_type == self.Type.CARD_TERMINAL:
            return

        allowed_account_types = self.TYPE_COMPATIBILITY.get(self.method_type, [])
        if (
            allowed_account_types
            and self.treasury_account.account_type not in allowed_account_types
        ):
            account_type_display = dict(TreasuryAccount.Type.choices).get(
                self.treasury_account.account_type, self.treasury_account.account_type
            )
            method_type_display = dict(self.Type.choices).get(self.method_type, self.method_type)

            raise ValidationError(
                {
                    "treasury_account": _(
                        f"El método '{method_type_display}' no es compatible "
                        f"con cuentas de tipo '{account_type_display}'. "
                        f"Tipos permitidos: {', '.join(allowed_account_types)}"
                    )
                }
            )

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)


class TerminalBatch(models.Model):
    """
    Lote diario de ventas con terminal que se liquida en conjunto.
    Representa la información que el terminal entrega 1-2 días después.
    """

    class Status(models.TextChoices):
        PENDING = "PENDING", _("Pendiente Liquidación")
        SETTLED = "SETTLED", _("Liquidado")
        RECONCILED = "RECONCILED", _("Reconciliado")
        INVOICED = "INVOICED", _("Facturado")

    # Identificación
    provider = models.ForeignKey(
        "PaymentTerminalProvider",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="batches",
        verbose_name=_("Proveedor de Terminal"),
    )

    payment_method = models.ForeignKey(
        "PaymentMethod",
        on_delete=models.PROTECT,
        related_name="batches",
        verbose_name=_("Método de Pago (Terminal)"),
    )

    # Fechas
    sales_date = models.DateField(
        _("Fecha de Ventas (Desde)"),
        help_text=_("Día en que se realizaron las ventas (o inicio del rango)"),
    )
    sales_date_end = models.DateField(
        _("Fecha de Ventas (Hasta)"),
        null=True,
        blank=True,
        help_text=_("Fin del rango de ventas (si abarca varios días)"),
    )
    settlement_date = models.DateField(
        _("Fecha de Liquidación"), help_text=_("Día en que el terminal informó la comisión")
    )
    deposit_date = models.DateField(
        _("Fecha de Depósito"),
        null=True,
        blank=True,
        help_text=_("Día en que llegó el dinero al banco"),
    )

    # Montos (informados por el terminal)
    gross_amount = models.DecimalField(
        _("Monto Bruto"), max_digits=12, decimal_places=2, help_text=_("Total de ventas del día")
    )

    commission_base = models.DecimalField(
        _("Comisión Neta"), max_digits=12, decimal_places=2, help_text=_("Comisión sin IVA")
    )

    commission_tax = models.DecimalField(
        _("IVA Comisión"), max_digits=12, decimal_places=2, help_text=_("IVA sobre la comisión")
    )

    commission_total = models.DecimalField(
        _("Comisión Total"), max_digits=12, decimal_places=2, help_text=_("Comisión + IVA")
    )

    net_amount = models.DecimalField(
        _("Monto Neto Depositado"),
        max_digits=12,
        decimal_places=2,
        help_text=_("Monto que llegó al banco"),
    )

    # Referencia del terminal
    terminal_reference = models.CharField(
        _("Referencia Terminal"),
        max_length=100,
        blank=True,
        help_text=_("Número de lote o referencia del terminal"),
    )

    # Estado
    status = models.CharField(
        _("Estado"), max_length=20, choices=Status.choices, default=Status.PENDING
    )

    # Asiento contable de ajuste (Etapa 2)
    settlement_journal_entry = models.ForeignKey(
        "accounting.JournalEntry",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="terminal_batch_settlements",
        verbose_name=_("Asiento de Liquidación"),
    )

    # Conciliación bancaria
    bank_statement_line = models.ForeignKey(
        "BankStatementLine",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="terminal_batches",
        verbose_name=_("Línea de Cartola"),
    )

    reconciliation_match = models.ForeignKey(
        "ReconciliationMatch",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="terminal_batches",
        verbose_name=_("Grupo de Conciliación"),
    )

    # Movimiento de liquidación (creado automáticamente al liquidar)
    settlement_movement = models.OneToOneField(
        "TreasuryMovement",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="settlement_batch",
        verbose_name=_("Movimiento de Liquidación"),
        help_text=_("Movimiento INBOUND creado automáticamente al liquidar el lote"),
    )

    # Facturación
    supplier_invoice = models.ForeignKey(
        "billing.Invoice",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="terminal_batches",
        verbose_name=_("Factura Proveedor"),
    )

    # Auditoría
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_terminal_batches",
    )

    notes = models.TextField(_("Notas"), blank=True)

    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Lote Terminal")
        verbose_name_plural = _("Lotes Terminal")
        ordering = ["-sales_date", "-id"]
        unique_together = [["provider", "sales_date", "terminal_reference"]]
        indexes = [
            models.Index(fields=["provider", "sales_date"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.provider.name} - {self.sales_date} (${self.gross_amount})"

    @property
    def payment_count(self):
        """Número de pagos individuales en este lote"""
        return self.payments.count()

    @property
    def display_id(self):
        from core.prefix_registry import EntityPrefix
        return f"{EntityPrefix.TERMINAL_BATCH}-{self.id}"

    def clean(self):
        """Validar que net_amount = gross_amount - commission_total"""
        from decimal import Decimal

        from django.core.exceptions import ValidationError

        super().clean()

        expected_net = self.gross_amount - self.commission_total
        if abs(self.net_amount - expected_net) > Decimal("0.01"):
            raise ValidationError(
                {
                    "net_amount": _(
                        f"El monto neto debe ser bruto - comisión. "
                        f"Esperado: ${expected_net}, Recibido: ${self.net_amount}"
                    )
                }
            )

    def save(self, *args, **kwargs):
        # Auto-calculate commission_total if not set
        if not self.commission_total:
            self.commission_total = self.commission_base + self.commission_tax

        self.clean()
        super().save(*args, **kwargs)


class POSSession(models.Model):
    """
    Represents a cashier's session (shift) in the POS.
    Each session has an opening and closing time, with cash control.
    """

    class Status(models.TextChoices):
        OPEN = "OPEN", _("Abierta")
        CLOSED = "CLOSED", _("Cerrada")

    # New: Terminal reference (replaces direct treasury_account)
    terminal = models.ForeignKey(
        "POSTerminal",
        on_delete=models.PROTECT,
        null=True,  # Allow null during migration
        blank=True,
        related_name="sessions",
        verbose_name=_("Terminal POS"),
        help_text=_("Terminal donde se realizó esta sesión"),
    )

    # Legacy: Keep for retrocompatibility during migration
    treasury_account = models.ForeignKey(
        "TreasuryAccount",
        on_delete=models.PROTECT,
        null=True,  # Now nullable
        blank=True,
        related_name="pos_sessions",
        verbose_name=_("Caja (Legacy)"),
        help_text=_("DEPRECATED: Use terminal.default_treasury_account"),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="pos_sessions",
        verbose_name=_("Cajero"),
    )

    status = models.CharField(
        _("Estado"), max_length=10, choices=Status.choices, default=Status.OPEN
    )

    # Opening
    opened_at = models.DateTimeField(_("Abierta el"), auto_now_add=True)
    opening_balance = models.DecimalField(
        _("Fondo de Caja Inicial"),
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text=_("Monto de efectivo declarado al abrir la caja"),
    )

    # Closing
    closed_at = models.DateTimeField(_("Cerrada el"), null=True, blank=True)
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="closed_pos_sessions",
        verbose_name=_("Cerrada Por"),
    )

    # Totals (calculated at close)
    total_cash_sales = models.DecimalField(
        _("Total Ventas Efectivo"), max_digits=12, decimal_places=2, default=0
    )
    total_card_sales = models.DecimalField(
        _("Total Ventas Tarjeta"), max_digits=12, decimal_places=2, default=0
    )
    total_transfer_sales = models.DecimalField(
        _("Total Ventas Transferencia"), max_digits=12, decimal_places=2, default=0
    )
    total_credit_sales = models.DecimalField(
        _("Total Ventas Crédito"), max_digits=12, decimal_places=2, default=0
    )
    total_check_sales = models.DecimalField(
        _("Total Ventas Cheque"), max_digits=12, decimal_places=2, default=0
    )

    total_other_cash_inflow = models.DecimalField(
        _("Otros Ingresos Efectivo"), max_digits=12, decimal_places=2, default=0
    )
    total_other_cash_outflow = models.DecimalField(
        _("Egresos Efectivo"), max_digits=12, decimal_places=2, default=0
    )

    notes = models.TextField(_("Notas"), blank=True)

    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Sesión de Caja")
        verbose_name_plural = _("Sesiones de Caja")
        ordering = ["-opened_at"]

    def __str__(self):
        return f"Sesión #{self.id} - {self.user.get_full_name() or self.user.username} ({self.get_status_display()})"

    @property
    def expected_cash(self):
        """Calculate expected cash: opening balance + cash sales + other inflows - outflows"""
        return (
            self.opening_balance
            + self.total_cash_sales
            + self.total_other_cash_inflow
            - self.total_other_cash_outflow
        )


class POSSessionAudit(models.Model):
    """
    Records the cash counting (arqueo) when closing a POS session.
    """

    session = models.OneToOneField(
        POSSession, on_delete=models.CASCADE, related_name="audit", verbose_name=_("Sesión")
    )

    expected_amount = models.DecimalField(
        _("Monto Esperado"),
        max_digits=12,
        decimal_places=2,
        help_text=_("Monto calculado por el sistema (fondo + ventas efectivo)"),
    )
    actual_amount = models.DecimalField(
        _("Monto Contado"),
        max_digits=12,
        decimal_places=2,
        help_text=_("Monto físico contado por el cajero"),
    )
    difference = models.DecimalField(
        _("Diferencia"),
        max_digits=12,
        decimal_places=2,
        help_text=_("Diferencia: actual - esperado (+ sobrante, - faltante)"),
    )

    # Accounting adjustment for difference
    journal_entry = models.OneToOneField(
        "accounting.JournalEntry",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pos_session_audit",
        verbose_name=_("Asiento de Ajuste"),
    )

    notes = models.TextField(_("Notas del Arqueo"), blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("Arqueo de Caja")
        verbose_name_plural = _("Arqueos de Caja")

    def __str__(self):
        return f"Arqueo Sesión #{self.session.id} - Diff: {self.difference}"


# ---------------------------------------------------------------------------
# S5.1 — Split Allocation (Gap B13)
# ---------------------------------------------------------------------------


class PaymentAllocation(models.Model):
    """
    Distribución de un movimiento de tesorería entre múltiples documentos.
    Permite split: 1 pago → N facturas/órdenes/líneas de cartola.

    Constraint de suma (permisivo):
        sum(allocations.amount) puede ser menor al movement.amount mientras
        la allocation esté en construcción. AllocationService.validate_sum()
        se invoca explícitamente al confirmar la conciliación.

    Exactamente 1 FK destino debe estar definida por registro (validado en clean()).
    """

    from decimal import Decimal as _Decimal

    treasury_movement = models.ForeignKey(
        "TreasuryMovement",
        on_delete=models.CASCADE,
        related_name="allocations",
        verbose_name=_("Movimiento de Tesorería"),
    )

    # — Destino (exactamente 1 debe ser non-null) —
    invoice = models.ForeignKey(
        "billing.Invoice",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payment_allocations",
        verbose_name=_("Factura"),
    )
    sale_order = models.ForeignKey(
        "sales.SaleOrder",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payment_allocations",
        verbose_name=_("Orden de Venta"),
    )
    purchase_order = models.ForeignKey(
        "purchasing.PurchaseOrder",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payment_allocations",
        verbose_name=_("Orden de Compra"),
    )
    bank_statement_line = models.ForeignKey(
        "BankStatementLine",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payment_allocations",
        verbose_name=_("Línea de Cartola"),
    )

    amount = models.DecimalField(
        _("Monto Asignado"),
        max_digits=14,
        decimal_places=2,
        validators=[MinValueValidator(_Decimal("0.01"))],
    )
    notes = models.TextField(_("Notas"), blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_allocations",
        verbose_name=_("Creado Por"),
    )

    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Distribución de Pago")
        verbose_name_plural = _("Distribuciones de Pago")
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["treasury_movement"], name="idx_palloc_movement"),
            models.Index(fields=["invoice"], name="idx_palloc_invoice"),
        ]

    def __str__(self) -> str:
        return f"Alloc #{self.id} — {self.treasury_movement_id} → ${self.amount}"

    def clean(self) -> None:
        """Valida que exactamente 1 FK destino esté definida."""
        targets = [
            self.invoice_id,
            self.sale_order_id,
            self.purchase_order_id,
            self.bank_statement_line_id,
        ]
        defined = sum(1 for t in targets if t is not None)
        if defined == 0:
            raise ValidationError(
                _(
                    "Debe especificar al menos un documento destino "
                    "(factura, orden de venta, orden de compra o línea de cartola)."
                )
            )
        if defined > 1:
            raise ValidationError(_("Solo puede asignar a un documento por fila de distribución."))

    def save(self, *args, **kwargs) -> None:
        self.clean()
        super().save(*args, **kwargs)


# ---------------------------------------------------------------------------
# Cheques recibidos de terceros — Cartera de cheques con cuenta puente
# ---------------------------------------------------------------------------


class Check(models.Model):
    """
    Cheque de tercero recibido (cliente u otro proveedor).
    Vive en la cuenta puente "Cheques en Cartera" hasta depositarse/cobrarse.

    Flujo de estados:
      IN_PORTFOLIO → DEPOSITED → CLEARED
                   → BOUNCED   (desde DEPOSITED: protesto)
      IN_PORTFOLIO → VOIDED    (anulación antes de depositar)
      ISSUED       → CLEARED   (cobrado por el proveedor)
                   → VOIDED    (anulación del cheque girado)

    El endoso (`ENDORSED`) se removió en ADR-0039: ya no se permite endosar
    un cheque de tercero a un proveedor. Ver `CheckService` y
    `docs/20-contracts/state-map.md` para el state machine vigente.
    """

    class Direction(models.TextChoices):
        RECEIVED = "RECEIVED", _("Recibido")
        ISSUED = "ISSUED", _("Girado")

    class Status(models.TextChoices):
        IN_PORTFOLIO = "IN_PORTFOLIO", _("En Cartera")
        DEPOSITED = "DEPOSITED", _("Depositado (En Tránsito)")
        CLEARED = "CLEARED", _("Cobrado / Liquidado")
        BOUNCED = "BOUNCED", _("Protestado / Rechazado")
        VOIDED = "VOIDED", _("Anulado")
        ISSUED = "ISSUED", _("Girado (Pendiente de Cobro)")

    # ── Identificación ────────────────────────────────────────────────────
    direction = models.CharField(
        _("Dirección"), max_length=10, choices=Direction.choices, default=Direction.RECEIVED
    )
    status = models.CharField(
        _("Estado"), max_length=15, choices=Status.choices, default=Status.IN_PORTFOLIO
    )

    # ── Datos del cheque ─────────────────────────────────────────────────
    bank = models.ForeignKey(
        "Bank", on_delete=models.PROTECT, related_name="checks", verbose_name=_("Banco Emisor")
    )
    check_number = models.CharField(_("N° de Cheque"), max_length=50)
    amount = models.DecimalField(
        _("Monto"), max_digits=14, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))]
    )
    issue_date = models.DateField(_("Fecha de Emisión"))
    due_date = models.DateField(
        _("Fecha de Cobro / Vencimiento"),
        help_text=_("Para cheques a fecha: día a partir del cual es cobrable."),
    )
    counterparty = models.ForeignKey(
        "contacts.Contact",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="checks_received",
        verbose_name=_("Girador / Emisor"),
    )
    drawer_name = models.CharField(
        _("Nombre Girador"),
        max_length=150,
        blank=True,
        help_text=_("Nombre libre si el girador no es un contacto del sistema."),
    )

    # ── Cuentas / Movimientos ────────────────────────────────────────────
    portfolio_account = models.ForeignKey(
        "TreasuryAccount",
        on_delete=models.PROTECT,
        related_name="checks_in_portfolio",
        verbose_name=_("Cuenta Cheques en Cartera"),
    )
    deposit_account = models.ForeignKey(
        "TreasuryAccount",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="checks_deposited",
        verbose_name=_("Cuenta Bancaria de Depósito"),
    )
    receipt_movement = models.OneToOneField(
        "TreasuryMovement",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="check_receipt",
        verbose_name=_("Movimiento de Recepción"),
    )
    settlement_movement = models.OneToOneField(
        "TreasuryMovement",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="check_settlement",
        verbose_name=_("Movimiento de Depósito / Liquidación"),
    )

    # ── Documentos relacionados ──────────────────────────────────────────
    invoice = models.ForeignKey(
        "billing.Invoice",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="check_payments",
        verbose_name=_("Factura"),
    )
    sale_order = models.ForeignKey(
        "sales.SaleOrder",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="check_payments",
        verbose_name=_("Orden de Venta"),
    )

    # ── Cheques propios girados (direction=ISSUED) ──────────────────────
    checkbook = models.ForeignKey(
        "Checkbook",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="checks",
        verbose_name=_("Chequera"),
        help_text=_("Talonario del que se tomó el folio (solo cheques propios)."),
    )
    payment_account = models.ForeignKey(
        "TreasuryAccount",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="checks_drawn_from",
        verbose_name=_("Cuenta de Cobro (Banco)"),
        help_text=_("Para cheques propios: cuenta bancaria desde la que se giró."),
    )
    issued_check_account = models.ForeignKey(
        "TreasuryAccount",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="checks_issued_liability",
        verbose_name=_("Cuenta 'Cheques Girados' (Pasivo)"),
        help_text=_("Cuenta puente LIABILITY para cheques propios girados."),
    )

    # ── Auditoría ────────────────────────────────────────────────────────
    notes = models.TextField(_("Notas"), blank=True)
    deposited_at = models.DateTimeField(_("Depositado el"), null=True, blank=True)
    cleared_at = models.DateTimeField(_("Cobrado el"), null=True, blank=True)
    bounced_at = models.DateTimeField(_("Protestado el"), null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="checks_created",
        verbose_name=_("Creado Por"),
    )
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Cheque")
        verbose_name_plural = _("Cheques")
        ordering = ["due_date", "-id"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["due_date"]),
            models.Index(fields=["counterparty", "status"]),
        ]

    def __str__(self) -> str:
        return self.display_id

    @property
    def display_id(self) -> str:
        from core.prefix_registry import EntityPrefix
        return f"{EntityPrefix.CHECK}-{self.id}"

    @property
    def is_overdue(self) -> bool:
        from core.utils import get_current_date

        return self.status == self.Status.IN_PORTFOLIO and self.due_date < get_current_date()


class CreditLine(models.Model):
    """
    Línea de Crédito (sobregiro) asociada a una cuenta corriente bancaria.

    Una línea de crédito es una facilidad financiera que permite disponer de
    fondos hasta un límite preaprobado cuando el saldo disponible de la cuenta
    bancaria resulta insuficiente. El saldo de la cuenta representa fondos
    propios depositados, mientras que la línea representa capacidad de
    endeudamiento.

    `used_amount` se calcula como la suma de movimientos CREDIT_LINE_DRAW
    menos CREDIT_LINE_REPAY asociados a esta línea.
    `available_amount = credit_limit - used_amount`.
    """

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", _("Vigente")
        EXPIRED = "EXPIRED", _("Vencida")
        CANCELED = "CANCELED", _("Cancelada")
        SUSPENDED = "SUSPENDED", _("Suspendida")

    # ── Relaciones ───────────────────────────────────────────────────────────
    treasury_account = models.OneToOneField(
        "TreasuryAccount",
        on_delete=models.PROTECT,
        related_name="credit_line",
        verbose_name=_("Cuenta Bancaria"),
        limit_choices_to={"account_type": TreasuryAccount.Type.CHECKING},
    )
    code = models.CharField(
        _("Código"),
        max_length=60,
        blank=True,
        help_text=_("Identificador de la línea en el banco (opcional)."),
    )

    # ── Configuración ────────────────────────────────────────────────────────
    currency = models.CharField(
        _("Moneda"),
        max_length=3,
        default="CLP",
    )
    credit_limit = models.DecimalField(
        _("Límite de Crédito"),
        max_digits=18,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
        help_text=_("Monto máximo autorizado por el banco para esta línea de crédito."),
    )

    # ── Términos financieros ─────────────────────────────────────────────────
    interest_rate = models.DecimalField(
        _("Tasa de Interés"),
        max_digits=8,
        decimal_places=4,
        default=Decimal("0"),
        validators=[MinValueValidator(Decimal("0"))],
        help_text=_("Tasa de referencia en % (ej. 1.2000 = 1.2%). Ver rate_basis."),
    )

    class RateBasis(models.TextChoices):
        MONTHLY = "MONTHLY", _("Mensual")
        ANNUAL = "ANNUAL", _("Anual")

    rate_basis = models.CharField(
        _("Base de Tasa"),
        max_length=10,
        choices=RateBasis.choices,
        blank=True,
        help_text=_("Mensual/Anual para la tasa de referencia."),
    )
    spread = models.DecimalField(
        _("Spread"),
        max_digits=8,
        decimal_places=4,
        default=Decimal("0"),
        validators=[MinValueValidator(Decimal("0"))],
        help_text=_("Spread sobre tasa base (puntos porcentuales)."),
    )
    commitment_fee = models.DecimalField(
        _("Comisión por No Utilizado"),
        max_digits=8,
        decimal_places=4,
        default=Decimal("0"),
        validators=[MinValueValidator(Decimal("0"))],
        help_text=_("Comisión anual % sobre el saldo no dispuesto (commitment fee)."),
    )

    # ── Vigencia ─────────────────────────────────────────────────────────────
    valid_from = models.DateField(
        _("Vigencia Desde"),
    )
    valid_until = models.DateField(
        _("Vigencia Hasta"),
        null=True,
        blank=True,
        help_text=_("Fecha de vencimiento de la línea. Si es null, no expira."),
    )
    auto_renewal = models.BooleanField(
        _("Renovación Automática"),
        default=False,
    )
    renewal_term_months = models.PositiveIntegerField(
        _("Plazo de Renovación (meses)"),
        null=True,
        blank=True,
        validators=[MinValueValidator(1)],
        help_text=_("Si la renovación es automática, plazo en meses de la renovación."),
    )

    # ── Garantías / Notas ────────────────────────────────────────────────────
    collateral_notes = models.TextField(
        _("Garantías"),
        blank=True,
        help_text=_("Descripción de garantías asociadas a la línea."),
    )
    notes = models.TextField(_("Notas"), blank=True)

    # ── Estado ───────────────────────────────────────────────────────────────
    status = models.CharField(
        _("Estado"),
        max_length=12,
        choices=Status.choices,
        default=Status.ACTIVE,
    )

    # ── Auditoría ────────────────────────────────────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="credit_lines_created",
        verbose_name=_("Creado Por"),
    )

    class Meta:
        verbose_name = _("Línea de Crédito")
        verbose_name_plural = _("Líneas de Crédito")
        ordering = ["-valid_from", "-id"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["treasury_account", "status"]),
            models.Index(fields=["currency"]),
        ]

    def __str__(self) -> str:
        return self.display_id

    @property
    def display_id(self) -> str:
        from core.prefix_registry import EntityPrefix
        code_part = self.code or str(self.id)
        return f"{EntityPrefix.CREDIT_LINE}-{code_part}"

    @property
    def used_amount(self) -> Decimal:
        """
        Monto total dispuesto de la línea = suma de CREDIT_LINE_DRAW
        menos CREDIT_LINE_REPAY.
        """
        from django.db.models import Sum

        draws = self.movements.filter(
            movement_type=TreasuryMovement.Type.CREDIT_LINE_DRAW,
        ).aggregate(total=Sum("amount"))["total"] or Decimal("0")
        repays = self.movements.filter(
            movement_type=TreasuryMovement.Type.CREDIT_LINE_REPAY,
        ).aggregate(total=Sum("amount"))["total"] or Decimal("0")
        return draws - repays

    @property
    def available_amount(self) -> Decimal:
        """Cupo disponible = límite - dispuesto."""
        return max(self.credit_limit - self.used_amount, Decimal("0"))

    @property
    def utilization_rate(self) -> Decimal | None:
        """Porcentaje de utilización (0-100). None si no hay límite."""
        if not self.credit_limit:
            return None
        return (self.used_amount / self.credit_limit) * Decimal("100")

    def clean(self):
        errors: dict[str, list[str]] = {}
        if self.valid_from and self.valid_until and self.valid_until < self.valid_from:
            errors.setdefault("valid_until", []).append(
                _("La fecha de vencimiento no puede ser anterior a la fecha de inicio.")
            )
        if self.auto_renewal and not self.renewal_term_months:
            errors.setdefault("renewal_term_months", []).append(
                _("Si la renovación es automática, debe indicar el plazo en meses.")
            )
        if errors:
            raise ValidationError(errors)


class BankLoan(models.Model):
    """
    Crédito / préstamo bancario (CLP o UF).

    Modela la deuda como pasivo (`liability_account` con `AccountType.LIABILITY`).
    Al desembolsar, la cuenta destino del banco se incrementa (INBOUND) y la
    cuenta pasivo refleja la deuda. Al pagar una cuota, se debita la
    `liability_account` (amortización de capital) y se asientan los gastos de
    interés/seguro en cuentas de gasto configuradas en `AccountingSettings`.

    Ver `docs/50-audit/bancos/fase-2-creditos-bancarios.md` (F2.2).
    """

    class Status(models.TextChoices):
        DRAFT = "DRAFT", _("Borrador")
        ACTIVE = "ACTIVE", _("Vigente")
        PAID = "PAID", _("Pagado")
        REFINANCED = "REFINANCED", _("Refinanciado")
        DEFAULTED = "DEFAULTED", _("En Mora / Incobrable")

    class Currency(models.TextChoices):
        CLP = "CLP", _("Pesos Chilenos (CLP)")
        UF = "UF", _("Unidad de Fomento (UF)")

    class AmortizationSystem(models.TextChoices):
        FRENCH = "FRENCH", _("Francés (cuota fija)")
        LINEAR = "LINEAR", _("Lineal (capital fijo)")

    class RateBasis(models.TextChoices):
        MONTHLY = "MONTHLY", _("Mensual")
        ANNUAL = "ANNUAL", _("Anual")

    lender = models.ForeignKey(
        "Bank",
        on_delete=models.PROTECT,
        related_name="loans",
        verbose_name=_("Banco Acreedor"),
    )
    loan_number = models.CharField(
        _("N° de Operación / Crédito"),
        max_length=60,
        blank=True,
        help_text=_("Identificador del crédito en el banco (opcional)."),
    )
    currency = models.CharField(
        _("Moneda"),
        max_length=3,
        choices=Currency.choices,
        default=Currency.CLP,
    )
    principal = models.DecimalField(
        _("Capital (monto original)"),
        max_digits=18,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
        help_text=_("Monto original del crédito en la moneda elegida."),
    )
    interest_rate = models.DecimalField(
        _("Tasa de Interés"),
        max_digits=8,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0"))],
        help_text=_("Tasa en % (ej. 1.2000 = 1.2%). Ver `rate_basis` para periodicidad."),
    )
    rate_basis = models.CharField(
        _("Base de Tasa"),
        max_length=10,
        choices=RateBasis.choices,
        default=RateBasis.MONTHLY,
        help_text=_("Mensual: % directo por cuota. Anual: se divide por 12 al calcular la cuota."),
    )
    amortization_system = models.CharField(
        _("Sistema de Amortización"),
        max_length=10,
        choices=AmortizationSystem.choices,
        default=AmortizationSystem.FRENCH,
    )
    term_months = models.PositiveIntegerField(
        _("Plazo (meses)"),
        validators=[MinValueValidator(1)],
    )
    start_date = models.DateField(_("Fecha de Inicio"))
    first_due_date = models.DateField(_("Primer Vencimiento"))
    insurance_monthly = models.DecimalField(
        _("Seguro Mensual (opcional)"),
        max_digits=18,
        decimal_places=2,
        default=Decimal("0"),
        help_text=_("Seguro desgravamen/cesantía mensual. Sumado a cada cuota."),
    )
    opening_fee = models.DecimalField(
        _("Comisión de Apertura"),
        max_digits=18,
        decimal_places=2,
        default=Decimal("0"),
        validators=[MinValueValidator(Decimal("0"))],
        help_text=_("Comisión cobrada al desembolso (gasto). En la moneda del crédito."),
    )
    stamp_tax = models.DecimalField(
        _("Impuesto de Timbres y Estampillas"),
        max_digits=18,
        decimal_places=2,
        default=Decimal("0"),
        validators=[MinValueValidator(Decimal("0"))],
        help_text=_("ITE cobrado al desembolso (gasto). En la moneda del crédito."),
    )
    penalty_rate = models.DecimalField(
        _("Tasa de Mora (mensual %)"),
        max_digits=8,
        decimal_places=4,
        default=Decimal("0"),
        validators=[MinValueValidator(Decimal("0"))],
        help_text=_(
            "Tasa de interés penal mensual sobre la cuota vencida (ej. 1.5 = 1.5%/mes). 0 = sin mora."
        ),
    )

    disbursement_account = models.ForeignKey(
        "TreasuryAccount",
        on_delete=models.PROTECT,
        related_name="loans_disbursed",
        verbose_name=_("Cuenta de Desembolso (Banco)"),
        help_text=_("Cuenta de tesorería tipo CHECKING/CASH donde se recibe el dinero."),
    )
    liability_account = models.ForeignKey(
        "TreasuryAccount",
        on_delete=models.PROTECT,
        related_name="loans_as_liability",
        verbose_name=_("Cuenta Pasivo (Préstamo por Pagar)"),
        help_text=_("Cuenta de tesorería tipo LIABILITY que materializa la deuda."),
    )

    status = models.CharField(
        _("Estado"),
        max_length=15,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    notes = models.TextField(_("Notas"), blank=True)
    collateral_notes = models.CharField(
        _("Garantías (notas)"),
        max_length=255,
        blank=True,
        help_text=_("Descripción libre de garantías. Modelo dedicado queda fuera del MVP."),
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="loans_created",
        verbose_name=_("Creado Por"),
    )
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Crédito Bancario")
        verbose_name_plural = _("Créditos Bancarios")
        ordering = ["-start_date", "-id"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["lender", "status"]),
            models.Index(fields=["currency"]),
        ]

    def __str__(self) -> str:
        return self.display_id

    @property
    def display_id(self) -> str:
        from core.prefix_registry import EntityPrefix
        return f"{EntityPrefix.BANK_LOAN}-{self.id}"

    @property
    def outstanding_balance(self) -> Decimal:
        """
        Saldo insoluto de capital = outstanding_balance del primer
        pending/overdue installment. Retorna 0 si el préstamo está pagado.
        """
        first_pending = (
            self.installments.filter(
                status__in=[LoanInstallment.Status.PENDING, LoanInstallment.Status.OVERDUE],
            )
            .order_by("number")
            .first()
        )
        if first_pending:
            return first_pending.outstanding_balance
        return Decimal("0")

    def clean(self):
        """
        Validaciones:
        1. `liability_account` debe ser tipo LOAN (ADR-0041).
        2. `disbursement_account` no puede ser de tipo pasivo ni puente.
        3. `first_due_date` no puede ser anterior a `start_date`.
        """
        if self.liability_account_id:
            if self.liability_account.account_type != TreasuryAccount.Type.LOAN:
                raise ValidationError(
                    {
                        "liability_account": _(
                            "La cuenta pasivo del crédito debe ser una cuenta de tesorería tipo "
                            "Préstamo Bancario (LOAN) vinculada a una cuenta contable de PASIVO "
                            "(ADR-0041). Cuenta actual: %(type)s."
                        )
                        % {"type": self.liability_account.get_account_type_display()}
                    }
                )

        if self.disbursement_account_id and self.disbursement_account.account_type in (
            TreasuryAccount.Type.CREDIT_CARD,
            TreasuryAccount.Type.LOAN,
            TreasuryAccount.Type.CHECK_PORTFOLIO,
        ):
            raise ValidationError(
                {
                    "disbursement_account": _(
                        "La cuenta de desembolso debe ser una cuenta bancaria (CHECKING) o "
                        "caja (CASH); no puede ser de pasivo ni puente."
                    )
                }
            )

        if self.start_date and self.first_due_date and self.first_due_date < self.start_date:
            raise ValidationError(
                {"first_due_date": _("El primer vencimiento no puede ser anterior al inicio.")}
            )


class LoanInstallment(models.Model):
    """
    Cuota de un `BankLoan`. Una fila por mes del calendario de amortización.

    - `currency` heredada del préstamo (`loan.currency`).
    - Para créditos en UF, los montos se guardan en UF y se convierten a CLP
      al momento de pagar (F2.7) usando el valor UF vigente a la fecha de pago.
    - `outstanding_balance` se persiste para acelerar listados/queries de
      morosidad sin tener que recorrer el historial.
    """

    class Status(models.TextChoices):
        PENDING = "PENDING", _("Pendiente")
        PAID = "PAID", _("Pagada")
        OVERDUE = "OVERDUE", _("Vencida")
        PARTIAL = "PARTIAL", _("Pago Parcial")
        CANCELED = "CANCELED", _("Anulada (refinanciación)")

    loan = models.ForeignKey(
        "BankLoan",
        on_delete=models.CASCADE,
        related_name="installments",
        verbose_name=_("Crédito"),
    )
    number = models.PositiveIntegerField(_("N° de Cuota"))
    due_date = models.DateField(_("Vencimiento"))
    principal_amount = models.DecimalField(
        _("Capital"),
        max_digits=18,
        decimal_places=2,
    )
    interest_amount = models.DecimalField(
        _("Interés"),
        max_digits=18,
        decimal_places=2,
    )
    insurance_amount = models.DecimalField(
        _("Seguro"),
        max_digits=18,
        decimal_places=2,
        default=Decimal("0"),
    )
    total_amount = models.DecimalField(
        _("Cuota Total"),
        max_digits=18,
        decimal_places=2,
        help_text=_("principal + interest + insurance (en la moneda del crédito)."),
    )
    outstanding_balance = models.DecimalField(
        _("Saldo Insoluto"),
        max_digits=18,
        decimal_places=2,
        help_text=_("Saldo del crédito después de pagar esta cuota."),
    )
    status = models.CharField(
        _("Estado"),
        max_length=10,
        choices=Status.choices,
        default=Status.PENDING,
    )
    paid_at = models.DateTimeField(_("Pagada el"), null=True, blank=True)
    payment_movement = models.OneToOneField(
        "TreasuryMovement",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="installment_payment",
        verbose_name=_("Movimiento de Pago"),
    )
    # Trazabilidad UF: si el préstamo es UF, se persiste el valor UF usado al pagar.
    uf_value_used = models.DecimalField(
        _("Valor UF al Pago"),
        max_digits=18,
        decimal_places=4,
        null=True,
        blank=True,
    )
    clp_amount_paid = models.DecimalField(
        _("CLP Pagado"),
        max_digits=18,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=_("Monto efectivamente pagado en CLP (para créditos UF)."),
    )
    penalty_paid = models.DecimalField(
        _("Mora Pagada (CLP)"),
        max_digits=18,
        decimal_places=2,
        default=Decimal("0"),
        help_text=_("Interés penal cobrado al pagar esta cuota vencida (en CLP)."),
    )

    notes = models.CharField(_("Notas"), max_length=255, blank=True)
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Cuota de Crédito")
        verbose_name_plural = _("Cuotas de Crédito")
        ordering = ["loan", "number"]
        constraints = [
            models.UniqueConstraint(
                fields=["loan", "number"],
                name="uniq_installment_per_loan",
            ),
        ]
        indexes = [
            models.Index(fields=["loan", "status"]),
            models.Index(fields=["status", "due_date"]),
            models.Index(fields=["due_date"]),
        ]

    def __str__(self) -> str:
        return f"{self.loan.display_id} #{self.number}"

    @property
    def display_id(self) -> str:
        from core.prefix_registry import EntityPrefix
        return f"{EntityPrefix.LOAN_INSTALLMENT}-{self.id}"

    @property
    def is_overdue(self) -> bool:
        from core.utils import get_current_date

        return self.status == self.Status.PENDING and self.due_date < get_current_date()


class CreditCardStatement(models.Model):
    """
    Estado de cuenta mensual de la tarjeta de crédito propia.

    Representa el ciclo de facturación: la tarjeta cierra cada mes
    (`cut_off_date`), informa un total facturado (`billed_amount`) y
    un pago mínimo (`minimum_payment`), y vence (`due_date`).

    - `billed_amount` puede incluir compras + interés + comisiones del
      periodo; en su mayoría se va acumulando automáticamente desde
      `TreasuryMovement` OUTBOUND sobre la `card_account`. Aquí se
      carga de forma manual o al cierre del mes (los movimientos del
      periodo se pueden importar después).
    - Los intereses (`interest_charged`) y comisiones (`fees_charged`)
      se imputan al gasto financiero y suben la deuda (F3.3).
    - El pago (`payment_movement`) es un `TreasuryMovement` TRANSFER
      desde una cuenta bancaria (CHECKING/CASH) hacia la tarjeta
      (LIABILITY): debita el pasivo y acredita el banco (F3.4).

    Ver `docs/50-audit/bancos/fase-3-tarjeta-credito.md` (F3.2–F3.4).
    """

    class Status(models.TextChoices):
        OPEN = "OPEN", _("Abierto")
        PARTIALLY_PAID = "PARTIALLY_PAID", _("Pagado Parcialmente")
        PAID = "PAID", _("Pagado")
        OVERDUE = "OVERDUE", _("Vencido")
        CANCELED = "CANCELED", _("Anulado")

    card_account = models.ForeignKey(
        "TreasuryAccount",
        on_delete=models.PROTECT,
        related_name="card_statements",
        limit_choices_to={"account_type": "CREDIT_CARD"},
        verbose_name=_("Cuenta Tarjeta de Crédito"),
    )
    period_year = models.PositiveIntegerField(_("Año del Período"))
    period_month = models.PositiveIntegerField(_("Mes del Período"))
    cut_off_date = models.DateField(_("Fecha de Cierre"))
    due_date = models.DateField(_("Fecha de Vencimiento"))

    billed_amount = models.DecimalField(
        _("Monto Facturado"),
        max_digits=18,
        decimal_places=2,
        default=Decimal("0"),
        help_text=_("Total facturado por la tarjeta en el período (compras + cargos)."),
    )
    minimum_payment = models.DecimalField(
        _("Pago Mínimo"),
        max_digits=18,
        decimal_places=2,
        default=Decimal("0"),
        help_text=_("Pago mínimo exigido por el banco."),
    )
    interest_charged = models.DecimalField(
        _("Interés del Período"),
        max_digits=18,
        decimal_places=2,
        default=Decimal("0"),
        help_text=_("Intereses cargados en el estado de cuenta (gasto financiero)."),
    )
    fees_charged = models.DecimalField(
        _("Comisiones del Período"),
        max_digits=18,
        decimal_places=2,
        default=Decimal("0"),
        help_text=_("Comisiones y otros cargos del período (gasto financiero)."),
    )

    # Cupo: copia local del `credit_limit` de la tarjeta al momento del
    # statement. No referenciamos `card_account.credit_limit` (que no
    # existe como campo del modelo) para mantener el statement
    # autocontenido.
    credit_limit = models.DecimalField(
        _("Cupo Disponible (Snapshot)"),
        max_digits=18,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=_("Cupo total de la tarjeta al cierre del período."),
    )

    status = models.CharField(
        _("Estado"),
        max_length=14,
        choices=Status.choices,
        default=Status.OPEN,
    )
    paid_at = models.DateTimeField(_("Pagado el"), null=True, blank=True)
    amount_paid = models.DecimalField(
        _("Monto Pagado (acumulado)"),
        max_digits=18,
        decimal_places=2,
        default=Decimal("0"),
        help_text=_(
            "Suma de pagos parciales aplicados a este statement. "
            "Cuando alcanza `outstanding_balance`, el status pasa a PAID."
        ),
    )
    # FK (no OneToOne) para soportar N pagos parciales (Onda 3,
    # ADR-0044). Cada `payment_movement` es un TRANSFER independiente.
    # Para la reversa transaccional se itera
    # `payment_movements.all()`.
    payment_movement = models.ForeignKey(
        "TreasuryMovement",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="card_statement_payments",
        verbose_name=_("Movimiento de Pago"),
    )
    charges_movement = models.OneToOneField(
        "TreasuryMovement",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="card_statement_charges",
        verbose_name=_("Movimiento de Cargos"),
        help_text=_(
            "ADJUSTMENT que imputa interest_charged + fees_charged como "
            "gasto financiero y sube la deuda. Simétrico a payment_movement."
        ),
    )
    payment_account = models.ForeignKey(
        "TreasuryAccount",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="card_statement_payments_made",
        verbose_name=_("Cuenta desde la que se pagó"),
        help_text=_("Cuenta bancaria origen del pago (CHECKING/CASH)."),
    )

    notes = models.TextField(_("Notas"), blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="card_statements_created",
        verbose_name=_("Creado Por"),
    )
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Estado de Cuenta Tarjeta")
        verbose_name_plural = _("Estados de Cuenta Tarjeta")
        ordering = ["-period_year", "-period_month", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["card_account", "period_year", "period_month"],
                name="uniq_card_period",
            ),
            models.CheckConstraint(
                condition=models.Q(period_month__gte=1) & models.Q(period_month__lte=12),
                name="ck_period_month_range",
            ),
        ]
        indexes = [
            models.Index(fields=["card_account", "status"]),
            models.Index(fields=["status", "due_date"]),
        ]

    def __str__(self) -> str:
        return f"{self.display_id} ({self.period_month:02d}/{self.period_year})"

    @property
    def display_id(self) -> str:
        from core.prefix_registry import EntityPrefix
        return f"{EntityPrefix.CREDIT_CARD_STMT}-{self.id}"

    @property
    def is_overdue(self) -> bool:
        from core.utils import get_current_date

        return (
            self.status in (self.Status.ACTIVE, self.Status.DELIVERED)
            and self.due_date
            and self.due_date < get_current_date()
        )

    @property
    def total_to_pay(self) -> Decimal:
        """Total que efectivamente se paga al liquidar (billed + interest + fees)."""
        return (
            (self.billed_amount or Decimal("0"))
            + (self.interest_charged or Decimal("0"))
            + (self.fees_charged or Decimal("0"))
        )

    @property
    def outstanding_balance(self) -> Decimal:
        """
        Saldo impago a la fecha (Onda 3, ADR-0044).
        `total_to_pay - amount_paid`, nunca negativo.
        """
        total = self.total_to_pay
        paid = self.amount_paid or Decimal("0")
        return max(total - paid, Decimal("0"))


class Checkbook(models.Model):
    """
    Talonario de cheques propios vinculado a una cuenta bancaria (CHECKING).
    Controla folios correlativos y previene duplicados.
    """

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", _("Activo")
        CLOSED = "CLOSED", _("Cerrado")
        EXHAUSTED = "EXHAUSTED", _("Agotado")

    bank_account = models.ForeignKey(
        TreasuryAccount,
        on_delete=models.PROTECT,
        related_name="checkbooks",
        verbose_name=_("Cuenta Bancaria"),
        limit_choices_to={"account_type": "CHECKING"},
    )
    bank = models.ForeignKey(
        Bank,
        on_delete=models.PROTECT,
        related_name="checkbooks",
        verbose_name=_("Banco"),
    )
    start_folio = models.PositiveIntegerField(
        _("Primer Folio"), help_text=_("Número de cheque inicial del talonario.")
    )
    end_folio = models.PositiveIntegerField(
        _("Último Folio"), help_text=_("Número de cheque final del talonario.")
    )
    next_folio = models.PositiveIntegerField(
        _("Siguiente Folio"),
        help_text=_("Próximo número a asignar. Se incrementa automáticamente."),
    )
    status = models.CharField(
        _("Estado"),
        max_length=12,
        choices=Status.choices,
        default=Status.ACTIVE,
    )
    notes = models.TextField(_("Notas"), blank=True)

    created_at = models.DateTimeField(_("Creado"), auto_now_add=True)
    updated_at = models.DateTimeField(_("Actualizado"), auto_now=True)

    class Meta:
        verbose_name = _("Chequera")
        verbose_name_plural = _("Chequeras")
        constraints = [
            models.CheckConstraint(
                condition=models.Q(start_folio__lte=models.F("end_folio")),
                name="ck_checkbook_folio_range",
            ),
            models.UniqueConstraint(
                fields=["bank_account", "start_folio"],
                name="uniq_checkbook_start",
            ),
        ]
        ordering = ["bank_account", "start_folio"]

    def __str__(self) -> str:
        return f"Chequera {self.start_folio}–{self.end_folio} ({self.bank.name})"

    def clean(self):
        super().clean()
        if self.start_folio and self.end_folio:
            if self.start_folio > self.end_folio:
                raise ValidationError(
                    {"end_folio": _("El último folio debe ser mayor o igual al primero.")}
                )
        if self.next_folio and self.start_folio and self.end_folio:
            if self.next_folio < self.start_folio or self.next_folio > self.end_folio + 1:
                raise ValidationError(
                    {
                        "next_folio": _(
                            "El siguiente folio debe estar dentro del rango del talonario."
                        )
                    }
                )

    def available_folios(self) -> int:
        """Cantidad de folios disponibles para emitir."""
        if self.status != self.Status.ACTIVE:
            return 0
        return self.end_folio - self.next_folio + 1

    def is_exhausted(self) -> bool:
        return self.next_folio > self.end_folio

    @property
    def display_id(self) -> str:
        from core.prefix_registry import EntityPrefix

        return f"{EntityPrefix.CHECK}-{self.id}"
