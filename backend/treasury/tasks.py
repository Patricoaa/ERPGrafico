"""
Celery tasks for the Treasury module.
"""

import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from .matching_service import MatchingService

# Rust native extension for batch scoring (graceful fallback)
try:
    import json as _json

    import erpgrafico_rs as _rs

    _HAS_RUST = True
except ImportError:
    _HAS_RUST = False


logger = logging.getLogger(__name__)


# ── F2.10: Alertas de vencimiento de cuotas ──────────────────────────────


@shared_task(name="treasury.mark_overdue_loan_installments")
def mark_overdue_loan_installments(days_ahead: int = 5, notify: bool = True):
    """
    Marca como OVERDUE las cuotas PENDING con due_date < hoy y notifica
    las próximas a vencer (entre hoy y hoy+days_ahead).

    Pensado para correr diariamente vía beat (ver settings.CELERY_BEAT_SCHEDULE).
    Retorna un dict con contadores para diagnóstico.
    """
    from django.contrib.auth import get_user_model
    from django.contrib.contenttypes.models import ContentType

    from workflow.models import Notification

    from .models import LoanInstallment

    today = timezone.now().date()
    horizon = today + timedelta(days=days_ahead)

    # 1) Marcar OVERDUE las vencidas y aún PENDING.
    overdue_qs = LoanInstallment.objects.filter(
        status=LoanInstallment.Status.PENDING,
        due_date__lt=today,
    )
    overdue_count = overdue_qs.update(status=LoanInstallment.Status.OVERDUE)

    # 2) Notificar próximas a vencer (a usuarios con permiso view_bank_loan).
    upcoming = list(
        LoanInstallment.objects.filter(
            status=LoanInstallment.Status.PENDING,
            due_date__gte=today,
            due_date__lte=horizon,
        ).select_related("loan", "loan__lender")
    )

    notified = 0
    if notify and upcoming:
        User = get_user_model()
        # Notificar a usuarios activos con permiso sobre el módulo treasury
        # (admin y tesoreros). Si no hay, se cae a superusuarios.
        recipients = User.objects.filter(is_active=True, is_superuser=True)
        if not recipients.exists():
            return {
                "overdue_marked": overdue_count,
                "upcoming_count": len(upcoming),
                "upcoming_notified": 0,
            }
        ct = ContentType.objects.get_for_model(LoanInstallment)
        for inst in upcoming:
            # Deduplicación: 1 notificación por (inst, día). Usamos el
            # campo `data` para guardar la fecha objetivo como string
            # ISO y dedupeamos contra eso (más robusto que comparar
            # `created_at__date` cuando el proceso corre a través de
            # medianoche o en distintos timezones).
            target_iso = today.isoformat()
            already = Notification.objects.filter(
                notification_type="LOAN_INSTALLMENT_UPCOMING",
                content_type=ct,
                object_id=inst.id,
                data__target_date=target_iso,
            ).exists()
            if already:
                continue
            for user in recipients:
                Notification.objects.create(
                    user=user,
                    title=f"Cuota #{inst.number} próxima a vencer",
                    message=(
                        f"Crédito {inst.loan.display_id} ({inst.loan.lender.name}): "
                        f"vence el {inst.due_date.strftime('%d/%m/%Y')} "
                        f"por ${inst.total_amount:,.0f}."
                    ),
                    type=Notification.Type.WARNING,
                    notification_type="LOAN_INSTALLMENT_UPCOMING",
                    content_type=ct,
                    object_id=inst.id,
                    link=f"/treasury/loans?selected={inst.loan.id}",
                    data={"target_date": target_iso},
                )
                notified += 1

    return {
        "overdue_marked": overdue_count,
        "upcoming_count": len(upcoming),
        "upcoming_notified": notified,
    }


# ── F3.7: Marcar como OVERDUE los estados de cuenta de tarjeta vencidos ───


@shared_task(name="treasury.mark_overdue_credit_card_statements")
def mark_overdue_credit_card_statements(days_ahead: int = 5, notify: bool = True):
    """
    Marca como OVERDUE los `CreditCardStatement` con `status=OPEN` y
    `due_date < hoy`, y notifica los próximos a vencer
    (`OPEN` con `due_date` entre hoy y `hoy + days_ahead`).

    Análogo a `mark_overdue_loan_installments`. Pensado para correr
    diariamente vía beat (ver `settings.CELERY_BEAT_SCHEDULE`).

    Persiste el cambio de estado (cierra el gap A del análisis del
    ciclo de vida de tarjeta de crédito, ver ADR-0037).

    Retorna un dict con contadores para diagnóstico.
    """
    from django.contrib.auth import get_user_model
    from django.contrib.contenttypes.models import ContentType

    from workflow.models import Notification

    from .models import CreditCardStatement

    today = timezone.now().date()
    horizon = today + timedelta(days=days_ahead)

    # 1) Marcar OVERDUE los vencidos y aún OPEN o PARTIALLY_PAID
    # (Onda 3, ADR-0044: un pago parcial también puede caer en mora
    # si la fecha de vencimiento pasó y aún hay saldo).
    overdue_qs = CreditCardStatement.objects.filter(
        status__in=(
            CreditCardStatement.Status.OPEN,
            CreditCardStatement.Status.PARTIALLY_PAID,
        ),
        due_date__lt=today,
    )
    overdue_count = overdue_qs.update(status=CreditCardStatement.Status.OVERDUE)

    # 2) Notificar próximos a vencer (a usuarios con permiso sobre el
    # módulo treasury). Se cae a superusuarios si no hay destinatarios.
    upcoming = list(
        CreditCardStatement.objects.filter(
            status=CreditCardStatement.Status.OPEN,
            due_date__gte=today,
            due_date__lte=horizon,
        ).select_related("card_account", "card_account__bank")
    )

    notified = 0
    if notify and upcoming:
        User = get_user_model()
        recipients = User.objects.filter(is_active=True, is_superuser=True)
        if not recipients.exists():
            return {
                "overdue_marked": overdue_count,
                "upcoming_count": len(upcoming),
                "upcoming_notified": 0,
            }
        ct = ContentType.objects.get_for_model(CreditCardStatement)
        for stmt in upcoming:
            # Deduplicación: 1 notificación por (statement, día).
            target_iso = today.isoformat()
            already = Notification.objects.filter(
                notification_type="CARD_STATEMENT_UPCOMING",
                content_type=ct,
                object_id=stmt.id,
                data__target_date=target_iso,
            ).exists()
            if already:
                continue
            for user in recipients:
                Notification.objects.create(
                    user=user,
                    title=f"Estado tarjeta {stmt.period_month:02d}/{stmt.period_year} por vencer",
                    message=(
                        f"Estado de cuenta de la tarjeta {stmt.card_account.name} "
                        f"({stmt.card_account.bank.name if stmt.card_account.bank else 's/banco'}) "
                        f"vence el {stmt.due_date.strftime('%d/%m/%Y')} "
                        f"por ${stmt.total_to_pay:,.0f}."
                    ),
                    type=Notification.Type.WARNING,
                    notification_type="CARD_STATEMENT_UPCOMING",
                    content_type=ct,
                    object_id=stmt.id,
                    link=f"/treasury/cards?selected={stmt.id}",
                    data={"target_date": target_iso},
                )
                notified += 1

    return {
        "overdue_marked": overdue_count,
        "upcoming_count": len(upcoming),
        "upcoming_notified": notified,
    }


# ── F2.9: Devengo mensual de interés (opt-in) ────────────────────────────


@shared_task(name="treasury.accrue_monthly_loan_interest")
def accrue_monthly_loan_interest(year: int = None, month: int = None):
    """
    Devenga el interés del periodo para créditos ACTIVE (criterio devengado).

    Opt-in: solo se ejecuta para créditos donde el operador haya decidido
    devengar (futuro flag en BankLoan). Por ahora, default off (PYME-friendly).

    Para cada crédito ACTIVE con cuotas en el mes:
      - Calcula el interés total del mes (suma de interest_amount).
      - Si UF, convierte con IndicatorValue del último día del mes.
      - Crea 1 JournalEntry DRAFT con:
          Debe  interest_expense_account
          Haber interest_payable_account (pasivo transitorio, hasta pagar)
      - Idempotente: si ya existe JE con la misma referencia/mes/loan, no duplica.

    Requiere que AccountingSettings tenga las cuentas
    `interest_expense_account` e `interest_payable_account`
    (F5.1). Si no están configuradas, retorna 0 sin error.
    """
    from django.db.models import Sum

    from accounting.glosa_builder import GlosaBuilder, Roles
    from accounting.models import AccountingSettings, JournalEntry, JournalItem

    from .models import BankLoan, LoanInstallment

    if year is None or month is None:
        today = timezone.now().date()
        year = today.year
        month = today.month

    settings_obj = AccountingSettings.get_solo()
    if not settings_obj:
        return {"accrued": 0, "reason": "no AccountingSettings"}

    # F5.1: resolver cuentas desde AccountingSettings.
    interest_expense_account = getattr(settings_obj, "interest_expense_account", None)
    interest_payable_account = getattr(settings_obj, "interest_payable_account", None)
    if not (interest_expense_account and interest_payable_account):
        return {"accrued": 0, "reason": "no interest accounts configured (F5.1)"}

    # Cuotas del mes por crédito ACTIVE.
    installments = LoanInstallment.objects.filter(
        loan__status=BankLoan.Status.ACTIVE,
        due_date__year=year,
        due_date__month=month,
        status__in=[LoanInstallment.Status.PENDING, LoanInstallment.Status.PAID],
    ).select_related("loan")

    accrued = 0
    seen_loans = set()
    for inst in installments:
        if inst.loan_id in seen_loans:
            continue
        seen_loans.add(inst.loan_id)

        total_interest_uf = (
            installments.filter(loan_id=inst.loan_id).aggregate(s=Sum("interest_amount"))["s"] or 0
        )
        if total_interest_uf <= 0:
            continue

        total_interest_clp = total_interest_uf.quantize(__import__("decimal").Decimal("0.01"))

        # Idempotencia: si ya hay JE con este ref, no duplicar.
        ref = f"ACCRUAL-{inst.loan.display_id}-{year:04d}{month:02d}"
        if JournalEntry.objects.filter(reference=ref).exists():
            continue

        entry = JournalEntry.objects.create(
            date=timezone.now().date(),
            description=GlosaBuilder.build(GlosaBuilder.DEVENGO_INTERESES, inst.loan.display_id, "", total_interest_clp, extra=[f"{month:02d}/{year}"]),
            reference=ref,
            status=JournalEntry.Status.DRAFT,
        )
        JournalItem.objects.create(
            entry=entry,
            account=interest_expense_account,
            debit=total_interest_clp,
            credit=0,
            label=GlosaBuilder.item(Roles.INTERES, inst.loan.display_id, ref),
        )
        JournalItem.objects.create(
            entry=entry,
            account=interest_payable_account,
            debit=0,
            credit=total_interest_clp,
            label=GlosaBuilder.item(Roles.INTERES_PAGAR, inst.loan.display_id, ref),
        )
        from accounting.services import JournalEntryService

        JournalEntryService.post_entry(entry)
        accrued += 1

    return {"accrued": accrued, "year": year, "month": month}


@shared_task(bind=True, max_retries=1, soft_time_limit=300)
def auto_match_statement_task(self, statement_id: int, confidence_threshold: float = 90.0):
    """
    S4.8: Auto-match asincrónico con reporte de progreso incremental.

    Corre en background vía Celery. El frontend hace polling al endpoint
    /treasury/statements/{id}/auto_match_status/?task_id=<id> cada 1s.

    Progress format:
        { 'processed': int, 'total': int, 'matched': int, 'percent': int }
    """
    try:
        from datetime import timedelta

        from django.db.models import Q

        from .models import BankStatement, ReconciliationSettings, TreasuryMovement

        try:
            statement = BankStatement.objects.select_related(
                "treasury_account", "treasury_account__account"
            ).get(id=statement_id)
        except BankStatement.DoesNotExist:
            raise ValueError(f"Cartola {statement_id} no encontrada")

        if statement.status == "CONFIRMED":
            raise ValueError("Cartola ya confirmada")

        account = statement.treasury_account

        # Load Settings
        settings = ReconciliationSettings.get_for_account(account)

        # Use provided threshold or fallback to settings
        threshold = (
            confidence_threshold
            if confidence_threshold is not None
            else settings.confidence_threshold
        )

        # Pre-fetch unreconciled lines
        unreconciled_lines = list(
            statement.lines.filter(reconciliation_status="UNRECONCILED").select_related(
                "statement", "statement__treasury_account"
            )
        )
        total_unreconciled = len(unreconciled_lines)

        if total_unreconciled == 0:
            return {"matched_count": 0, "total_unreconciled": 0, "matches": []}

        # Seed progress
        self.update_state(
            state="PROGRESS",
            meta={"processed": 0, "total": total_unreconciled, "matched": 0, "percent": 0},
        )

        # Date range from settings
        dates = [line.transaction_date for line in unreconciled_lines]
        lookback = settings.date_range_days
        range_min = min(dates) - timedelta(days=lookback)
        range_max = max(dates) + timedelta(days=lookback)

        # Pre-fetch candidates
        candidates_qs = TreasuryMovement.objects.filter(
            Q(
                is_reconciled=False,
                is_pending_registration=False,
                date__gte=range_min,
                date__lte=range_max,
            )
            & (Q(to_account=account) | Q(from_account=account))
        ).select_related("contact", "from_account", "to_account")

        all_candidates = list(candidates_qs)

        already_matched_payment_ids: set = set()
        matched_count = 0
        matches = []

        if _HAS_RUST and total_unreconciled * len(all_candidates) > 100:
            # ── Fast path: Rust batch scoring ────────────────────────────────
            def _serialize_date(d):
                if hasattr(d, "isoformat"):
                    return d.isoformat()
                return str(d)

            lines_data = []
            for line in unreconciled_lines:
                lines_data.append(
                    {
                        "id": line.id,
                        "credit": float(line.credit),
                        "debit": float(line.debit),
                        "transactionDate": _serialize_date(line.transaction_date),
                        "transactionId": line.transaction_id or None,
                        "reference": line.reference or None,
                        "description": line.description or None,
                        "bankFormat": line.statement.bank_format if line.statement else None,
                    }
                )

            payments_data = []
            for p in all_candidates:
                payments_data.append(
                    {
                        "id": p.id,
                        "amount": float(p.amount),
                        "date": _serialize_date(p.date),
                        "transactionNumber": p.transaction_number or None,
                        "contactName": p.contact.name
                        if hasattr(p, "contact") and p.contact
                        else None,
                    }
                )

            settings_data = {
                "amountWeight": float(settings.amount_weight),
                "dateWeight": float(settings.date_weight),
                "referenceWeight": float(settings.reference_weight),
                "contactWeight": float(settings.contact_weight),
            }

            scores_json = _rs.batch_match_scores(
                _json.dumps(lines_data),
                _json.dumps(payments_data),
                _json.dumps(settings_data),
            )
            all_scores = _json.loads(scores_json)

            scores_by_line: list[dict[int, dict]] = []
            for _ in range(len(lines_data)):
                scores_by_line.append({})
            for entry in all_scores:
                li = entry["lineIdx"]
                pi = entry["paymentIdx"]
                scores_by_line[li][pi] = entry

            for i, line in enumerate(unreconciled_lines):
                is_inbound = line.credit > line.debit
                best_score_val = 0.0
                best_pi = None
                best_entry = None

                for pi, p in enumerate(all_candidates):
                    if p.id in already_matched_payment_ids:
                        continue
                    if not MatchingService._payment_matches_account_sense(p, account, is_inbound):
                        continue
                    entry = scores_by_line[i].get(pi)
                    if entry is None:
                        continue
                    if entry["score"] > best_score_val:
                        best_score_val = entry["score"]
                        best_pi = pi
                        best_entry = entry

                if best_entry is not None and best_score_val >= threshold:
                    payment = all_candidates[best_pi]
                    try:
                        MatchingService.create_match_group([line.id], [payment.id], None)
                        already_matched_payment_ids.add(payment.id)
                        matched_count += 1
                        matches.append(
                            {
                                "line_id": line.id,
                                "payment_id": payment.id,
                                "score": best_score_val,
                            }
                        )
                    except Exception:
                        pass

                processed = i + 1
                percent = int(processed / total_unreconciled * 100)
                self.update_state(
                    state="PROGRESS",
                    meta={
                        "processed": processed,
                        "total": total_unreconciled,
                        "matched": matched_count,
                        "percent": percent,
                    },
                )
        else:
            # ── Slow path: Python native scoring (fallback) ──────────────────
            for i, line in enumerate(unreconciled_lines):
                is_inbound = line.credit > line.debit

                line_candidates = [
                    p
                    for p in all_candidates
                    if p.id not in already_matched_payment_ids
                    and MatchingService._payment_matches_account_sense(p, account, is_inbound)
                ]

                best_suggestion = None
                best_score: float = 0.0

                for p in line_candidates:
                    score_data = MatchingService._calculate_match_score(line, p, settings=settings)
                    if score_data["score"] > best_score:
                        best_score = score_data["score"]
                        best_suggestion = {"payment": p, "score": score_data["score"]}

                if best_suggestion and best_score >= threshold:
                    payment = best_suggestion["payment"]
                    try:
                        MatchingService.create_match_group([line.id], [payment.id], None)
                        already_matched_payment_ids.add(payment.id)
                        matched_count += 1
                        matches.append(
                            {
                                "line_id": line.id,
                                "payment_id": payment.id,
                                "score": best_suggestion["score"],
                            }
                        )
                    except Exception:
                        pass

                processed = i + 1
                percent = int(processed / total_unreconciled * 100)
                self.update_state(
                    state="PROGRESS",
                    meta={
                        "processed": processed,
                        "total": total_unreconciled,
                        "matched": matched_count,
                        "percent": percent,
                    },
                )

        return {
            "matched_count": matched_count,
            "total_unreconciled": total_unreconciled,
            "matches": matches,
        }

    except Exception as exc:
        self.update_state(state="FAILURE", meta={"error": str(exc)})
        raise


# ── F4.6: Alertas de cheques por vencer y depósitos en tránsito ─────────


@shared_task(name="treasury.check_alerts")
def check_alerts(days_ahead: int = 5, transit_max_days: int = 10, notify: bool = True):
    """
    Alertas diarias de cheques:

    1. Cheques en cartera (IN_PORTFOLIO) con due_date próximo a vencer.
    2. Cheques depositados (DEPOSITED) con más de N días sin cobrar (tránsito añejo).
    3. Cheques propios girados (ISSUED) con due_date próximo a vencer.

    Retorna un dict con contadores para diagnóstico.
    """
    from django.contrib.auth import get_user_model
    from django.contrib.contenttypes.models import ContentType

    from workflow.models import Notification

    from .models import Check

    today = timezone.now().date()
    horizon = today + timedelta(days=days_ahead)

    # 1) Cheques en cartera por vencer
    portfolio_expiring = list(
        Check.objects.filter(
            direction=Check.Direction.RECEIVED,
            status=Check.Status.IN_PORTFOLIO,
            due_date__gte=today,
            due_date__lte=horizon,
        ).select_related("bank", "counterparty")
    )

    # 2) Depósitos en tránsito añejos
    transit_stale = list(
        Check.objects.filter(
            status=Check.Status.DEPOSITED,
            deposited_at__date__lte=today - timedelta(days=transit_max_days),
        ).select_related("bank", "counterparty")
    )

    # 3) Cheques propios por vencer
    issued_expiring = list(
        Check.objects.filter(
            direction=Check.Direction.ISSUED,
            status=Check.Status.ISSUED,
            due_date__gte=today,
            due_date__lte=horizon,
        ).select_related("bank", "counterparty")
    )

    notified = 0
    if notify and (portfolio_expiring or transit_stale or issued_expiring):
        User = get_user_model()
        recipients = User.objects.filter(is_active=True, is_superuser=True)
        if not recipients.exists():
            return {
                "portfolio_expiring": len(portfolio_expiring),
                "transit_stale": len(transit_stale),
                "issued_expiring": len(issued_expiring),
                "notified": 0,
            }

        ct = ContentType.objects.get_for_model(Check)
        target_iso = today.isoformat()

        for check in portfolio_expiring:
            already = Notification.objects.filter(
                notification_type="CHECK_PORTFOLIO_UPCOMING",
                content_type=ct,
                object_id=check.id,
                data__target_date=target_iso,
            ).exists()
            if already:
                continue
            for user in recipients:
                Notification.objects.create(
                    user=user,
                    title=f"Cheque {check.display_id} por vencer",
                    message=(
                        f"Cheque de {check.bank.name} N° {check.check_number} "
                        f"por ${check.amount:,.0f} vence el {check.due_date.strftime('%d/%m/%Y')}."
                    ),
                    type=Notification.Type.WARNING,
                    notification_type="CHECK_PORTFOLIO_UPCOMING",
                    content_type=ct,
                    object_id=check.id,
                    link="/treasury/checks",
                    data={"target_date": target_iso},
                )
                notified += 1

        for check in transit_stale:
            already = Notification.objects.filter(
                notification_type="CHECK_TRANSIT_STALE",
                content_type=ct,
                object_id=check.id,
                data__target_date=target_iso,
            ).exists()
            if already:
                continue
            for user in recipients:
                Notification.objects.create(
                    user=user,
                    title=f"Cheque {check.display_id} en tránsito prolongado",
                    message=(
                        f"Cheque de {check.bank.name} N° {check.check_number} "
                        f"depositado hace más de {transit_max_days} días sin cobrar."
                    ),
                    type=Notification.Type.WARNING,
                    notification_type="CHECK_TRANSIT_STALE",
                    content_type=ct,
                    object_id=check.id,
                    link="/treasury/checks",
                    data={"target_date": target_iso},
                )
                notified += 1

        for check in issued_expiring:
            already = Notification.objects.filter(
                notification_type="CHECK_ISSUED_UPCOMING",
                content_type=ct,
                object_id=check.id,
                data__target_date=target_iso,
            ).exists()
            if already:
                continue
            for user in recipients:
                Notification.objects.create(
                    user=user,
                    title=f"Cheque propio {check.display_id} por vencer",
                    message=(
                        f"Cheque propio N° {check.check_number} "
                        f"por ${check.amount:,.0f} vence el {check.due_date.strftime('%d/%m/%Y')}."
                    ),
                    type=Notification.Type.WARNING,
                    notification_type="CHECK_ISSUED_UPCOMING",
                    content_type=ct,
                    object_id=check.id,
                    link="/treasury/checks",
                    data={"target_date": target_iso},
                )
                notified += 1

    return {
        "portfolio_expiring": len(portfolio_expiring),
        "transit_stale": len(transit_stale),
        "issued_expiring": len(issued_expiring),
        "notified": notified,
    }


# ── F5.4: Calendario unificado de vencimientos ────────────────────────────


@shared_task(name="treasury.unified_maturity_alerts")
def unified_maturity_alerts(days_ahead: int = 7, notify: bool = True):
    """
    Alerta consolidada diaria de TODOS los vencimientos bancarios:
      - Cuotas de préstamo (PENDING / OVERDUE)
      - Cheques recibidos en cartera (IN_PORTFOLIO)
      - Cheques propios girados (ISSUED)
      - Estados de cuenta de tarjeta de crédito (OPEN / OVERDUE)

    Emite una notificación por cada ítem a vencer dentro del horizonte,
    con deduplicación por (notification_type, object_id, target_date).
    """
    from django.contrib.auth import get_user_model
    from django.contrib.contenttypes.models import ContentType

    from workflow.models import Notification

    from .models import Check, CreditCardStatement, LoanInstallment

    today = timezone.now().date()
    horizon = today + timedelta(days=days_ahead)

    items = []

    # 1) Cuotas de préstamo
    upcoming_installments = LoanInstallment.objects.filter(
        status__in=[LoanInstallment.Status.PENDING, LoanInstallment.Status.OVERDUE],
        due_date__gte=today,
        due_date__lte=horizon,
    ).select_related("loan", "loan__lender")
    for inst in upcoming_installments:
        items.append(
            {
                "notification_type": "UNIFIED_MATURITY_LOAN",
                "content_model": LoanInstallment,
                "object_id": inst.id,
                "title": f"Cuota #{inst.number} próxima a vencer",
                "message": (
                    f"Crédito {inst.loan.display_id} ({inst.loan.lender.name}): "
                    f"vence el {inst.due_date.strftime('%d/%m/%Y')} "
                    f"por ${inst.total_amount:,.0f}."
                ),
                "link": f"/treasury/loans?selected={inst.loan.id}",
            }
        )

    # 2) Cheques recibidos en cartera
    expiring_checks = Check.objects.filter(
        direction=Check.Direction.RECEIVED,
        status=Check.Status.IN_PORTFOLIO,
        due_date__gte=today,
        due_date__lte=horizon,
    ).select_related("bank")
    for ch in expiring_checks:
        items.append(
            {
                "notification_type": "UNIFIED_MATURITY_CHECK",
                "content_model": Check,
                "object_id": ch.id,
                "title": f"Cheque {ch.display_id} por vencer",
                "message": (
                    f"Cheque de {ch.bank.name} N° {ch.check_number} "
                    f"por ${ch.amount:,.0f} vence el {ch.due_date.strftime('%d/%m/%Y')}."
                ),
                "link": "/treasury/checks",
            }
        )

    # 3) Cheques propios girados
    issued_checks = Check.objects.filter(
        direction=Check.Direction.ISSUED,
        status=Check.Status.ISSUED,
        due_date__gte=today,
        due_date__lte=horizon,
    ).select_related("bank")
    for ch in issued_checks:
        items.append(
            {
                "notification_type": "UNIFIED_MATURITY_CHECK_ISSUED",
                "content_model": Check,
                "object_id": ch.id,
                "title": f"Cheque propio {ch.display_id} por vencer",
                "message": (
                    f"Cheque propio N° {ch.check_number} "
                    f"por ${ch.amount:,.0f} vence el {ch.due_date.strftime('%d/%m/%Y')}."
                ),
                "link": "/treasury/checks",
            }
        )

    # 4) Estados de cuenta de tarjeta
    open_statements = CreditCardStatement.objects.filter(
        status__in=[CreditCardStatement.Status.OPEN, CreditCardStatement.Status.OVERDUE],
        due_date__gte=today,
        due_date__lte=horizon,
    ).select_related("card_account")
    for stmt in open_statements:
        items.append(
            {
                "notification_type": "UNIFIED_MATURITY_CARD",
                "content_model": CreditCardStatement,
                "object_id": stmt.id,
                "title": f"Estado tarjeta {stmt.period_month:02d}/{stmt.period_year} por vencer",
                "message": (
                    f"Estado de cuenta de la tarjeta {stmt.card_account.name} "
                    f"vence el {stmt.due_date.strftime('%d/%m/%Y')} "
                    f"por ${stmt.total_to_pay:,.0f}."
                ),
                "link": "/treasury/credit-card-statements",
            }
        )

    # Enviar notificaciones con deduplicación
    notified = 0
    if notify and items:
        User = get_user_model()
        recipients = User.objects.filter(is_active=True, is_superuser=True)
        if not recipients.exists():
            return {"total_items": len(items), "notified": 0}

        target_iso = today.isoformat()
        for item_data in items:
            ct = ContentType.objects.get_for_model(item_data["content_model"])
            already = Notification.objects.filter(
                notification_type=item_data["notification_type"],
                content_type=ct,
                object_id=item_data["object_id"],
                data__target_date=target_iso,
            ).exists()
            if already:
                continue
            for user in recipients:
                Notification.objects.create(
                    user=user,
                    title=item_data["title"],
                    message=item_data["message"],
                    type=Notification.Type.WARNING,
                    notification_type=item_data["notification_type"],
                    content_type=ct,
                    object_id=item_data["object_id"],
                    link=item_data["link"],
                    data={"target_date": target_iso},
                )
                notified += 1

    return {
        "total_items": len(items),
        "loan_installments": len(upcoming_installments),
        "checks_expiring": len(expiring_checks),
        "checks_issued": len(issued_checks),
        "card_statements": len(open_statements),
        "notified": notified,
    }


@shared_task(name="treasury.check_credit_line_expirations")
def check_credit_line_expirations():
    """
    Marca como EXPIRED las líneas de crédito con `valid_until` <= hoy
    que aún están ACTIVE. Pensado para correr diariamente vía beat.
    """
    from .models import CreditLine

    today = timezone.now().date()
    expired = CreditLine.objects.filter(
        status=CreditLine.Status.ACTIVE,
        valid_until__isnull=False,
        valid_until__lte=today,
    )
    count = expired.update(status=CreditLine.Status.EXPIRED)
    if count:
        logger.info("check_credit_line_expirations: %d línea(s) marcada(s) como EXPIRED.", count)
    return {"expired_count": count}
