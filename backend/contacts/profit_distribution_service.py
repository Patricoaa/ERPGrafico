"""
ProfitDistributionService: Business logic for formal profit (or loss) distribution.
Handles resolutions, percentage calculations based on history, and journal entries.
"""

from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from accounting.glosa_builder import GlosaBuilder, Roles
from accounting.models import AccountingSettings, JournalEntry, JournalItem
from contacts.models import Contact

from .partner_models import (
    PartnerTransaction,
    ProfitDistributionLine,
    ProfitDistributionResolution,
)
from .partner_service import PartnerService


class ProfitDistributionService:
    @staticmethod
    def validate_create_data(fiscal_year_id, net_result, resolution_date):
        if fiscal_year_id is None or net_result is None or not resolution_date:
            raise ValidationError(
                "Faltan campos obligatorios (fiscal_year_id, net_result, resolution_date)."
            )

    @staticmethod
    def create_draft_from_request(request):
        data = request.data
        fiscal_year_id = data.get("fiscal_year_id") or data.get("fiscal_year")
        net_result = data.get("net_result")
        resolution_date = data.get("resolution_date")
        ProfitDistributionService.validate_create_data(fiscal_year_id, net_result, resolution_date)
        try:
            net = Decimal(str(net_result))
            fiscal_year = int(fiscal_year_id)
        except (InvalidOperation, ValueError, TypeError):
            raise ValidationError("Año fiscal o resultado neto inválido.")
        return ProfitDistributionService.create_draft_resolution(
            fiscal_year_id=fiscal_year,
            net_result=net,
            resolution_date=resolution_date,
            acta_number=data.get("acta_number", ""),
            notes=data.get("notes", ""),
            created_by=request.user,
        )

    @staticmethod
    def validate_can_delete(resolution: ProfitDistributionResolution):
        if resolution.status == ProfitDistributionResolution.Status.EXECUTED:
            raise ValidationError(
                "No se puede eliminar una resolución que ya ha sido ejecutada contablemente."
            )

    @staticmethod
    @transaction.atomic
    def create_draft_resolution(
        fiscal_year_id: int,
        net_result: Decimal,
        resolution_date,
        acta_number: str = "",
        notes: str = "",
        created_by=None,
    ) -> ProfitDistributionResolution:
        """
        Creates a new distribution resolution in DRAFT status.
        Calculates the exact participation percentage of each partner at `resolution_date`
        and prepares the lines with their corresponding gross amounts.
        """
        from accounting.models import FiscalYear

        try:
            fy_obj = FiscalYear.objects.get(id=fiscal_year_id)
        except FiscalYear.DoesNotExist:
            raise ValidationError(f"El año fiscal con ID {fiscal_year_id} no existe.")

        fiscal_year = fy_obj.year

        if net_result == 0:
            raise ValidationError("El resultado del ejercicio no puede ser cero.")

        # Check if resolution for this fiscal year already exists
        # We check both the integer year and the specific object to be safe
        existing = ProfitDistributionResolution.objects.filter(
            fiscal_year=fiscal_year,
            status__in=[
                ProfitDistributionResolution.Status.DRAFT,
                ProfitDistributionResolution.Status.APPROVED,
                ProfitDistributionResolution.Status.EXECUTED,
            ],
        ).exists()
        if existing:
            raise ValidationError(
                f"Ya existe una resolución activa para el año fiscal {fiscal_year}."
            )

        resolution = ProfitDistributionResolution.objects.create(
            fiscal_year_obj=fy_obj,
            fiscal_year=fiscal_year,
            resolution_date=resolution_date,
            net_result=net_result,
            acta_number=acta_number,
            notes=notes,
            created_by=created_by,
            status=ProfitDistributionResolution.Status.DRAFT,
        )

        ProfitDistributionService._generate_resolution_lines(resolution)

        return resolution

    @staticmethod
    @transaction.atomic
    def recalculate_draft_resolution(
        resolution: ProfitDistributionResolution,
    ) -> ProfitDistributionResolution:
        """
        Refreshes a draft resolution by deleting current lines and
        re-calculating them based on current partner data.
        """
        if resolution.status != ProfitDistributionResolution.Status.DRAFT:
            raise ValidationError("Solo se pueden recalcular resoluciones en estado borrador.")

        # Delete existing lines
        resolution.lines.all().delete()

        # Re-generate lines
        ProfitDistributionService._generate_resolution_lines(resolution)

        # Update timestamp
        resolution.save(update_fields=["updated_at"])

        return resolution

    @staticmethod
    def _generate_resolution_lines(resolution: ProfitDistributionResolution):
        """
        Helper to generate lines for a resolution.
        Accumulates all partner allocations first, then applies a rounding
        adjustment to the largest share so the sum matches net_result exactly.
        """
        partners = Contact.objects.filter(is_partner=True)

        # --- Phase 1: Calculate gross amounts ---
        lines_data = []
        for partner in partners:
            pct = PartnerService.get_equity_percentage_at_date(partner, resolution.resolution_date)
            if pct <= 0:
                continue

            gross_amount = (abs(resolution.net_result) * (pct / Decimal("100"))).quantize(
                Decimal("1"), rounding=ROUND_HALF_UP
            )
            lines_data.append({"partner": partner, "pct": pct, "gross": gross_amount})

        # --- Phase 2: Rounding adjustment ---
        # Ensure sum(gross_amounts) == abs(net_result) to prevent unbalanced entries
        if lines_data:
            total_gross = sum(d["gross"] for d in lines_data)
            diff = abs(resolution.net_result) - total_gross
            if diff != 0:
                # Apply the cent adjustment to the partner with the largest share
                lines_data.sort(key=lambda x: x["gross"], reverse=True)
                lines_data[0]["gross"] += diff

        # --- Phase 3: Create DB records ---
        for item in lines_data:
            partner = item["partner"]
            pct = item["pct"]
            # Restore sign: negative for losses, positive for profits
            gross_amount = item["gross"] if resolution.is_profit else -item["gross"]

            # Handle provisional withdrawal offsets (only on profits)
            offset_amount = Decimal("0")
            if resolution.is_profit:
                outstanding_withdrawals = PartnerService.get_provisional_withdrawals_balance(
                    partner
                )
                if outstanding_withdrawals > 0:
                    offset_amount = min(outstanding_withdrawals, gross_amount)

            net_amount = gross_amount
            if resolution.is_profit:
                net_amount = max(Decimal("0"), gross_amount - offset_amount)

            ProfitDistributionLine.objects.create(
                resolution=resolution,
                partner=partner,
                percentage_at_date=pct,
                gross_amount=gross_amount,
                provisional_withdrawals_offset=offset_amount,
                net_amount=net_amount,
            )

    @staticmethod
    @transaction.atomic
    def update_draft_line_destinations(resolution: ProfitDistributionResolution, lines_data: list):
        """
        Updates the destinations for draft resolution lines.
        lines_data: [{'line_id': int, 'destinations': [{'destination': str, 'amount': float}] }]
        """
        from .partner_models import ProfitDistributionLineDestination

        if resolution.status != ProfitDistributionResolution.Status.DRAFT:
            raise ValidationError("Solo se pueden modificar resoluciones en borrador.")

        for item in lines_data:
            line_id = item.get("line_id")
            dests_list = item.get("destinations", [])
            try:
                line = resolution.lines.get(id=line_id)
                # clear old
                line.destinations.all().delete()

                total_assigned = Decimal("0")
                for d in dests_list:
                    amount = Decimal(str(d.get("amount", 0)))
                    dest_type = d.get("destination")
                    if amount > 0:
                        ProfitDistributionLineDestination.objects.create(
                            line=line, destination=dest_type, amount=amount
                        )
                        total_assigned += amount

                if total_assigned > line.net_amount:
                    raise ValidationError(
                        f"La suma de destinos ({total_assigned}) para {line.partner.name} excede su monto neto ({line.net_amount})."
                    )
            except ProfitDistributionLine.DoesNotExist:
                continue

    @staticmethod
    def build_impact_preview(resolution: ProfitDistributionResolution) -> dict:
        """
        Proyección (sin escribir) de lo que provocará ejecutar la resolución: por socio, el reparto
        por destino, la absorción de retiros provisorios y el cambio de participación (%) que
        resulta de reinvertir / retener / absorber. Replica la regla de ``execute_resolution`` y de
        ``PartnerService._recalculate_and_snapshot_stakes`` (% = patrimonio neto del socio / total).
        """
        from .partner_models import ProfitDistributionLineDestination as Dest

        if resolution.status == ProfitDistributionResolution.Status.EXECUTED:
            raise ValidationError("La resolución ya fue ejecutada: no hay impactos por proyectar.")

        zero = Decimal("0")
        rows = []
        lines = resolution.lines.select_related("partner").prefetch_related("destinations")
        for line in lines:
            partner = line.partner
            by_dest = {d.destination: d.amount for d in line.destinations.all()}
            if resolution.is_loss and not by_dest:
                by_dest = {Dest.Destination.LOSS_ABSORPTION: abs(line.net_amount)}
            dividend = by_dest.get(Dest.Destination.DIVIDEND_PAYABLE, zero)
            reinvest = by_dest.get(Dest.Destination.REINVEST, zero)
            retained = by_dest.get(Dest.Destination.RETAINED, zero)
            loss = by_dest.get(Dest.Destination.LOSS_ABSORPTION, zero)

            # Mismo criterio que execute_resolution: se liquidan retiros completos, del más antiguo.
            liquidated = zero
            remaining = line.provisional_withdrawals_offset
            if remaining > 0:
                for tx in PartnerTransaction.objects.filter(
                    partner=partner,
                    transaction_type=PartnerTransaction.Type.PROVISIONAL_WITHDRAWAL,
                    distribution_resolution__isnull=True,
                ).order_by("date"):
                    if remaining <= 0:
                        break
                    liquidated += tx.amount
                    remaining -= tx.amount

            balance_before = partner.partner_provisional_withdrawals_balance
            equity_before = partner.partner_net_equity
            equity_after = equity_before + liquidated + reinvest + retained - loss
            rows.append(
                {
                    "partner": partner.id,
                    "partner_name": partner.name,
                    "percentage_before": PartnerService.get_equity_percentage_at_date(
                        partner, resolution.resolution_date
                    ),
                    "gross_amount": line.gross_amount,
                    "provisional_withdrawals_offset": line.provisional_withdrawals_offset,
                    "provisional_balance_before": balance_before,
                    "provisional_balance_after": balance_before - liquidated,
                    "net_amount": line.net_amount,
                    "dividend": dividend,
                    "reinvest": reinvest,
                    "retained": retained,
                    "loss": loss,
                    "equity_before": equity_before,
                    "equity_after": equity_after,
                }
            )

        # Participaciones de socios fuera de la resolución también se rebalancean.
        in_resolution = {r["partner"] for r in rows}
        for p in Contact.objects.filter(is_partner=True).exclude(id__in=in_resolution):
            eq = p.partner_net_equity
            rows.append(
                {
                    "partner": p.id, "partner_name": p.name,
                    "percentage_before": PartnerService.get_equity_percentage_at_date(p, resolution.resolution_date),
                    "gross_amount": zero, "provisional_withdrawals_offset": zero,
                    "provisional_balance_before": p.partner_provisional_withdrawals_balance,
                    "provisional_balance_after": p.partner_provisional_withdrawals_balance,
                    "net_amount": zero, "dividend": zero, "reinvest": zero, "retained": zero, "loss": zero,
                    "equity_before": eq, "equity_after": eq,
                }
            )

        total_after = sum((r["equity_after"] for r in rows), zero)
        for r in rows:
            r["percentage_after"] = (
                (r["equity_after"] / total_after * 100).quantize(Decimal("0.01")) if total_after > 0 else zero
            )
            r["percentage_changes"] = r["percentage_after"] != r["percentage_before"]
        rows.sort(key=lambda r: r["partner_name"])

        def as_str(row):
            return {k: (str(v) if isinstance(v, Decimal) else v) for k, v in row.items()}

        return {
            "resolution": resolution.id,
            "is_profit": resolution.is_profit,
            "partners": [as_str(r) for r in rows],
            "totals": {k: str(v) for k, v in {
                "gross": sum((r["gross_amount"] for r in rows), zero),
                "provisional_offset": sum((r["provisional_withdrawals_offset"] for r in rows), zero),
                "net": sum((r["net_amount"] for r in rows), zero),
                "dividend": sum((r["dividend"] for r in rows), zero),
                "reinvest": sum((r["reinvest"] for r in rows), zero),
                "retained": sum((r["retained"] for r in rows), zero),
                "loss": sum((r["loss"] for r in rows), zero),
            }.items()},
            "percentages_change": any(r["percentage_changes"] for r in rows),
        }

    @staticmethod
    @transaction.atomic
    def approve_resolution(resolution: ProfitDistributionResolution, approved_by):
        """Transitions resolution from DRAFT to APPROVED."""
        if resolution.status != ProfitDistributionResolution.Status.DRAFT:
            raise ValidationError("La resolución debe estar en borrador para ser aprobada.")

        resolution.status = ProfitDistributionResolution.Status.APPROVED
        resolution.approved_by = approved_by
        resolution.approved_at = timezone.now()
        resolution.save()
        return resolution

    @staticmethod
    @transaction.atomic
    def execute_resolution(
        resolution: ProfitDistributionResolution, executed_by
    ) -> ProfitDistributionResolution:
        """
        Executes an APPROVED resolution.
        Generates the complex journal entry and all partner transactions.
        """
        if resolution.status != ProfitDistributionResolution.Status.APPROVED:
            raise ValidationError("La resolución debe estar aprobada para ser ejecutada.")

        settings = ProfitDistributionService._get_settings()

        # 0. Immediate Configuration Check
        if not settings.partner_current_year_earnings_account:
            raise ValidationError("Falta configurar la Cuenta de Utilidades del Ejercicio.")
        if not settings.partner_retained_earnings_account:
            raise ValidationError("Falta configurar la Cuenta de Utilidades Retenidas.")

        # Check destinations to ensure all target accounts are configred before doing any damage
        from .partner_models import ProfitDistributionLineDestination

        destinations = (
            ProfitDistributionLineDestination.objects.filter(line__resolution=resolution)
            .values_list("destination", flat=True)
            .distinct()
        )
        if ProfitDistributionLineDestination.Destination.DIVIDEND_PAYABLE in destinations:
            if not settings.partner_dividends_payable_account:
                raise ValidationError("Falta configurar la Cuenta de Dividendos por Pagar.")

        if ProfitDistributionLineDestination.Destination.REINVEST in destinations:
            if not settings.partner_capital_social_account:
                raise ValidationError("Falta configurar la Cuenta de Capital Social.")

        entry = JournalEntry(
            description=GlosaBuilder.build(
                GlosaBuilder.DISTRIBUCION_RESULTADOS,
                resolution.display_id,
                "",
                abs(resolution.net_result),
                extra=[f"Acta: {resolution.acta_number}"] if resolution.acta_number else None,
            ),
            date=resolution.resolution_date,
            status=JournalEntry.Status.POSTED,
        )
        # Bypasses closure validation for closed periods as this is a system closing logic
        entry._is_system_closing_entry = True
        entry.save()

        resolution.journal_entry = entry

        # 1. Close the Current Year Earnings account
        # If profit, it has a credit balance, so we debit it
        # If loss, it has a debit balance, so we credit it
        JournalItem.objects.create(
            entry=entry,
            account=settings.partner_current_year_earnings_account,
            label=GlosaBuilder.item(Roles.RESULTADO, f"Ejercicio {resolution.fiscal_year}", resolution.display_id),
            debit=abs(resolution.net_result) if resolution.is_profit else 0,
            credit=0 if resolution.is_profit else abs(resolution.net_result),
        )

        for line in resolution.lines.all():
            partner = line.partner

            # Record Provisional Withdrawal Offsets first
            if line.provisional_withdrawals_offset > 0:
                if not settings.partner_provisional_withdrawal_account:
                    raise ValidationError(
                        "La cuenta de Retiros Provisorios no está configurada globalmente."
                    )

                # Offset unliquidated transactions
                unliquidated = PartnerTransaction.objects.filter(
                    partner=partner,
                    transaction_type=PartnerTransaction.Type.PROVISIONAL_WITHDRAWAL,
                    distribution_resolution__isnull=True,
                ).order_by("date")

                remaining_offset = line.provisional_withdrawals_offset
                for tx in unliquidated:
                    if remaining_offset <= 0:
                        break
                    tx.distribution_resolution = resolution
                    tx.save(update_fields=["distribution_resolution"])
                    remaining_offset -= tx.amount

                # Accounting for Offset (Credit the Provisional Withdrawal account to reduce the contra-equity)
                JournalItem.objects.create(
                    entry=entry,
                    account=PartnerService._resolve_partner_withdrawal_account(partner),
                    partner=partner,
                    label=GlosaBuilder.item(Roles.RETIRO_PROVISORIO, partner.name, resolution.display_id),
                    debit=0,
                    credit=line.provisional_withdrawals_offset,
                )

                # NEW: Create a Partner Transaction for the Offset (so it's visible in the Ledger)
                PartnerTransaction.objects.create(
                    partner=partner,
                    transaction_type=PartnerTransaction.Type.DIVIDEND,
                    amount=line.provisional_withdrawals_offset,
                    date=resolution.resolution_date,
                    description=f"Compensación Retiros Provisorios - Ejercicio {resolution.fiscal_year}",
                    journal_entry=entry,
                    distribution_resolution=resolution,
                    created_by=executed_by,
                )

            # Record final destination of Net Amount by iterating over the specified destinations
            for dest in line.destinations.all():
                if dest.amount <= 0:
                    continue

                abs_net = dest.amount

                if dest.destination == ProfitDistributionLineDestination.Destination.RETAINED:
                    # Credit Partner's Specific Earnings Account (Equity)
                    JournalItem.objects.create(
                        entry=entry,
                        account=PartnerService._resolve_partner_retained_account(partner),
                        partner=partner,
                        label=GlosaBuilder.item(Roles.RETENIDAS, partner.name, resolution.display_id),
                        debit=0,
                        credit=abs_net,
                    )

                    # Create Partner Transaction for History
                    ptx = PartnerTransaction.objects.create(
                        partner=partner,
                        transaction_type=PartnerTransaction.Type.RETAINED,
                        amount=abs_net,
                        date=resolution.resolution_date,
                        description=f"Utilidades Retenidas Ejercicio {resolution.fiscal_year}",
                        journal_entry=entry,
                        distribution_resolution=resolution,
                        created_by=executed_by,
                    )
                    dest.partner_transaction = ptx
                    dest.save(update_fields=["partner_transaction"])

                elif (
                    dest.destination
                    == ProfitDistributionLineDestination.Destination.DIVIDEND_PAYABLE
                ):
                    # Credit Dividends Payable (Liability)
                    div_account = PartnerService._resolve_partner_dividends_account(partner)

                    JournalItem.objects.create(
                        entry=entry,
                        account=div_account,
                        partner=partner,
                        label=GlosaBuilder.item(Roles.DIVIDENDO_PAGAR, partner.name, resolution.display_id),
                        debit=0,
                        credit=abs_net,
                    )

                    # Create Partner Transaction for History (Allocation)
                    ptx = PartnerTransaction.objects.create(
                        partner=partner,
                        transaction_type=PartnerTransaction.Type.DIVIDEND,
                        amount=abs_net,
                        date=resolution.resolution_date,
                        description=f"Asignación Dividendos Ejercicio {resolution.fiscal_year}",
                        journal_entry=entry,
                        distribution_resolution=resolution,
                        created_by=executed_by,
                    )
                    dest.partner_transaction = ptx
                    dest.save(update_fields=["partner_transaction"])

                elif dest.destination == ProfitDistributionLineDestination.Destination.REINVEST:
                    # Credit Partner's Specific Capital Account (Equity)
                    JournalItem.objects.create(
                        entry=entry,
                        account=PartnerService._resolve_partner_contribution_account(partner),
                        partner=partner,
                        label=GlosaBuilder.item(Roles.REINVERSION, partner.name, resolution.display_id),
                        debit=0,
                        credit=abs_net,
                    )

                    # Also create a Partner Transaction for Reinvestment (Increases Equity Stake)
                    ptx = PartnerTransaction.objects.create(
                        partner=partner,
                        transaction_type=PartnerTransaction.Type.REINVESTMENT,
                        amount=abs_net,
                        date=resolution.resolution_date,
                        description=f"Reinversión Utilidades {resolution.fiscal_year}",
                        journal_entry=entry,
                        distribution_resolution=resolution,
                        created_by=executed_by,
                    )
                    dest.partner_transaction = ptx
                    dest.save(update_fields=["partner_transaction"])

                elif (
                    dest.destination
                    == ProfitDistributionLineDestination.Destination.LOSS_ABSORPTION
                ):
                    # Debit Partner's Specific Earnings Account (Equity)
                    JournalItem.objects.create(
                        entry=entry,
                        account=PartnerService._resolve_partner_retained_account(partner),
                        partner=partner,
                        label=GlosaBuilder.item(Roles.RESULTADO, f"Absorción pérdida {partner.name}", resolution.display_id),
                        debit=abs_net,
                        credit=0,
                    )

                    ptx = PartnerTransaction.objects.create(
                        partner=partner,
                        transaction_type=PartnerTransaction.Type.LOSS_ABSORPTION,
                        amount=-abs_net,
                        date=resolution.resolution_date,
                        description=f"Absorción Pérdida {resolution.fiscal_year}",
                        journal_entry=entry,
                        distribution_resolution=resolution,
                        created_by=executed_by,
                    )
                    dest.partner_transaction = ptx
                    dest.save(update_fields=["partner_transaction"])

        entry.check_balance()

        resolution.status = ProfitDistributionResolution.Status.EXECUTED
        resolution.executed_by = executed_by
        resolution.executed_at = timezone.now()
        resolution.save()

        # If any reinvestments occurred, we need to recalculate equity stakes
        has_reinvestments = ProfitDistributionLineDestination.objects.filter(
            line__resolution=resolution,
            destination=ProfitDistributionLineDestination.Destination.REINVEST,
        ).exists()
        if has_reinvestments:
            PartnerService._recalculate_and_snapshot_stakes(
                date=resolution.resolution_date,
                source_transaction=None,  # Multiple possible
                created_by=executed_by,
            )

        return resolution

    @staticmethod
    @transaction.atomic
    def execute_mass_payment(
        resolution: ProfitDistributionResolution,
        treasury_account_id: int,
        payments_data: list,
        executed_by,
    ) -> ProfitDistributionResolution:
        """
        Executes payments for DIVIDEND_PAYABLE destinations.
        payments_data: [{'partner_id': int, 'amount': float}]
        """
        if not treasury_account_id:
            raise ValidationError("Falta seleccionar la cuenta de tesorería (treasury_account_id).")

        # Serializes concurrent payments of a resolution, so the pending amounts below stay valid.
        resolution = ProfitDistributionResolution.objects.select_for_update().get(pk=resolution.pk)

        if resolution.status != ProfitDistributionResolution.Status.EXECUTED:
            raise ValidationError(
                "La resolución debe estar ejecutada contablemente para realizar pagos."
            )

        from .partner_models import ProfitDistributionLineDestination, ProfitDistributionPayment

        amounts_by_partner: dict = {}
        for p_data in payments_data:
            amount = Decimal(str(p_data.get("amount", 0)))
            if amount > 0:
                partner_id = p_data.get("partner_id")
                amounts_by_partner[partner_id] = amounts_by_partner.get(partner_id, Decimal("0")) + amount

        # Verify and Aggregate total payment
        total_payment = Decimal("0")
        valid_payments = []
        for partner_id, amount in amounts_by_partner.items():
            # Find the total dividend payable for this partner
            destinations = ProfitDistributionLineDestination.objects.filter(
                line__resolution=resolution,
                line__partner_id=partner_id,
                destination=ProfitDistributionLineDestination.Destination.DIVIDEND_PAYABLE,
            )
            total_payable = sum(d.amount for d in destinations)

            # Find already paid
            already_paid = ProfitDistributionPayment.objects.filter(
                resolution=resolution, partner_id=partner_id
            ).aggregate(Sum("amount"))["amount__sum"] or Decimal("0")

            remaining = total_payable - already_paid
            if amount > remaining:
                raise ValidationError(
                    f"El monto a pagar ({amount}) supera el dividendo pendiente ({remaining})."
                )

            total_payment += amount
            valid_payments.append({"partner_id": partner_id, "amount": amount})

        if total_payment <= 0:
            raise ValidationError("Debe especificar al menos un monto de pago mayor a 0.")

        from treasury.models import TreasuryAccount, TreasuryMovement

        try:
            treasury_account = TreasuryAccount.objects.select_for_update().get(id=treasury_account_id)
        except TreasuryAccount.DoesNotExist:
            raise ValidationError("Cuenta de tesorería no válida.")

        PartnerService._assert_sufficient_funds(treasury_account, total_payment)
        is_bank = treasury_account.account_type != TreasuryAccount.Type.CASH
        payment_date = timezone.localdate()
        from tax.services import validate_period_open

        validate_period_open(payment_date, action="pagar los dividendos")

        # Create Journal Entry
        entry = JournalEntry.objects.create(
            description=GlosaBuilder.build(GlosaBuilder.PAGO_DIVIDENDOS, resolution.display_id, "", total_payment, extra=[f"Acta: {resolution.acta_number}"]),
            date=payment_date,
            status=JournalEntry.Status.POSTED,
            source_content_type=ContentType.objects.get_for_model(ProfitDistributionResolution),
            source_object_id=resolution.id,
        )

        # 1. Credit Treasury Account
        bank_account = treasury_account.account
        if not bank_account:
            raise ValidationError(
                "La cuenta de tesorería seleccionada no tiene cuenta contable asociada."
            )

        JournalItem.objects.create(
            entry=entry,
            account=bank_account,
            label=GlosaBuilder.item(
                Roles.BANCO if is_bank else Roles.EFECTIVO, f"Ej. {resolution.fiscal_year}", resolution.display_id
            ),
            debit=0,
            credit=total_payment,
        )

        # 2. Debit Dividends Payable
        # In mass payment, we iterate over the valid_payments and debit each partner's specific account
        for vp in valid_payments:
            p_id = vp["partner_id"]
            p_amount = vp["amount"]
            p_obj = Contact.objects.get(id=p_id)
            p_div_account = PartnerService._resolve_partner_dividends_account(p_obj)

            JournalItem.objects.create(
                entry=entry,
                account=p_div_account,
                partner=p_obj,
                label=GlosaBuilder.item(Roles.DIVIDENDO_PAGAR, p_obj.name, resolution.display_id),
                debit=p_amount,
                credit=0,
            )

        entry.check_balance()

        # 3. Create Treasury Movement
        movement = TreasuryMovement.objects.create(
            movement_type=TreasuryMovement.Type.OUTBOUND,
            payment_method=(
                TreasuryMovement.Method.TRANSFER if is_bank else TreasuryMovement.Method.CASH
            ),
            amount=total_payment,
            from_account=treasury_account,
            date=payment_date,
            notes=f"Pago Dividendos - Ej. {resolution.fiscal_year}",
            journal_entry=entry,
            justify_reason=TreasuryMovement.JustifyReason.PARTNER_WITHDRAWAL,
            is_pending_registration=False,
            created_by=executed_by,
        )

        # 4. Create ProfitDistributionPayment records and PartnerTransactions
        for vp in valid_payments:
            partner_id = vp["partner_id"]
            amount = vp["amount"]

            # Record formal transaction on partner account
            ptx = PartnerTransaction.objects.create(
                partner_id=partner_id,
                transaction_type=PartnerTransaction.Type.DIVIDEND_PAYMENT,
                amount=amount,
                date=payment_date,
                description=f"Pago Efectivo Dividendo Ej. {resolution.fiscal_year}",
                journal_entry=entry,
                treasury_movement=movement,
                distribution_resolution=resolution,
                created_by=executed_by,
            )

            # Bind the payment
            ProfitDistributionPayment.objects.create(
                resolution=resolution,
                partner_id=partner_id,
                amount=amount,
                treasury_movement=movement,
                partner_transaction=ptx,
                created_by=executed_by,
            )

        return resolution

    @staticmethod
    def _get_settings() -> AccountingSettings:
        settings = AccountingSettings.get_solo()
        if not settings:
            raise ValidationError("No se encontró configuración contable.")
        return settings
