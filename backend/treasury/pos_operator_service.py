"""
Operador identificado en cajas POS multiusuario (spec 2026-11-10).

Único punto que decide "quién actúa": en sesiones SINGLE es la cuenta logueada;
en MULTI es el operador del pase de un solo uso presentado en el encabezado.
"""

from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import APIException

from .models import POSOperatorPass, POSSession

User = get_user_model()

PASS_HEADER = "X-POS-Operator-Pass"
ONE_SHOT_TTL = timedelta(minutes=5)
UNBOUND_DRAFT_TTL = timedelta(minutes=30)

_ONE_SHOT_PURPOSES = (
    POSOperatorPass.Purpose.CASH_MOVEMENT,
    POSOperatorPass.Purpose.SESSION_CLOSE,
    POSOperatorPass.Purpose.PARTNER_WITHDRAWAL,
)


class POSOperatorRequired(APIException):
    status_code = 403
    default_code = "pos_operator_required"
    default_detail = "Debe identificar al operador para esta acción."

    def __init__(self, purpose: str):
        super().__init__(
            detail={"detail": self.default_detail, "code": self.default_code, "purpose": purpose}
        )


@dataclass(frozen=True)
class Actor:
    operator: User
    device_user: User
    operator_pass: POSOperatorPass | None


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class POSOperatorService:
    @staticmethod
    def verify_identity(operator, credential: dict | None) -> None:
        """Punto de extensión: la primera edición no verifica ningún secreto.

        PIN y tarjeta escaneable se validan aquí en la segunda edición.
        """
        return None

    @staticmethod
    @transaction.atomic
    def identify(
        *,
        session: POSSession,
        device_user,
        operator_id: int,
        tab_key: str,
        purpose: str,
        target_type: str = "",
        target_id: int | None = None,
        credential: dict | None = None,
    ) -> tuple[POSOperatorPass, str]:
        if session.status != POSSession.Status.OPEN:
            raise ValidationError("La sesión de caja está cerrada.")
        if not session.is_multi_user_for(device_user):
            raise ValidationError("Este dispositivo no opera la sesión en modo multiusuario.")
        if purpose not in POSOperatorPass.Purpose.values:
            raise ValidationError("Propósito de identificación inválido.")
        from .selectors import POSSelector

        operator = POSSelector.list_operators().filter(pk=operator_id).first()
        if operator is None:
            raise ValidationError("Operador no válido.")
        POSOperatorService.verify_identity(operator, credential)

        now = timezone.now()
        POSOperatorPass.objects.filter(
            session=session, tab_key=tab_key, ended_at__isnull=True
        ).update(ended_at=now, end_reason=POSOperatorPass.EndReason.SUPERSEDED)

        expires_at = None
        if purpose in _ONE_SHOT_PURPOSES:
            expires_at = now + ONE_SHOT_TTL
        elif purpose == POSOperatorPass.Purpose.DRAFT and target_id is None:
            expires_at = now + UNBOUND_DRAFT_TTL

        token = secrets.token_urlsafe(32)
        op_pass = POSOperatorPass.objects.create(
            session=session,
            operator=operator,
            device_user=device_user,
            tab_key=tab_key,
            purpose=purpose,
            target_type=target_type or "",
            target_id=target_id,
            token_hash=_hash(token),
            expires_at=expires_at,
        )
        return op_pass, token

    @staticmethod
    def resolve_actor(
        *,
        session: POSSession,
        device_user,
        raw_token: str | None,
        purpose: str,
        target_id: int | None = None,
    ) -> Actor:
        if not session.is_multi_user_for(device_user):
            return Actor(device_user, device_user, None)
        if not raw_token:
            raise POSOperatorRequired(purpose)

        op_pass = (
            POSOperatorPass.objects.select_related("operator")
            .filter(token_hash=_hash(raw_token))
            .first()
        )
        if (
            op_pass is None
            or op_pass.session_id != session.pk
            or op_pass.device_user_id != device_user.pk
            or op_pass.purpose != purpose
            or op_pass.ended_at is not None
            or not op_pass.operator.is_active
            or (target_id is not None and op_pass.target_id != target_id)
        ):
            raise POSOperatorRequired(purpose)
        if op_pass.expires_at is not None and op_pass.expires_at <= timezone.now():
            POSOperatorService.end(op_pass, POSOperatorPass.EndReason.EXPIRED)
            raise POSOperatorRequired(purpose)
        return Actor(op_pass.operator, device_user, op_pass)

    @staticmethod
    def actor_from_request(request, session: POSSession, purpose: str, target_id: int | None = None) -> Actor:
        return POSOperatorService.resolve_actor(
            session=session,
            device_user=request.user,
            raw_token=request.headers.get(PASS_HEADER),
            purpose=purpose,
            target_id=target_id,
        )

    @staticmethod
    def live_pass_for_tab(
        *, session: POSSession, device_user, tab_key: str, purpose: str, target_id: int | None = None
    ) -> POSOperatorPass | None:
        """Pase vigente de una pestaña. Sirve a heartbeat/unlock, que no llevan encabezado."""
        return (
            POSOperatorPass.objects.select_related("operator")
            .filter(
                session=session, device_user=device_user, tab_key=tab_key, purpose=purpose,
                target_id=target_id, ended_at__isnull=True,
            )
            .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now()))
            .first()
        )

    @staticmethod
    def release_from_request(request, session: POSSession) -> None:
        """Termina el pase del encabezado si es de esta sesión y cuenta. Silencioso si no hay."""
        raw = request.headers.get(PASS_HEADER)
        if not raw:
            return
        op_pass = POSOperatorPass.objects.filter(
            token_hash=_hash(raw), session=session, device_user=request.user
        ).first()
        if op_pass is not None:
            POSOperatorService.end(op_pass, POSOperatorPass.EndReason.RELEASED)

    @staticmethod
    def bind_target(op_pass: POSOperatorPass, target_type: str, target_id: int) -> None:
        op_pass.target_type = target_type
        op_pass.target_id = target_id
        op_pass.expires_at = None
        op_pass.save(update_fields=["target_type", "target_id", "expires_at"])

    @staticmethod
    def end(op_pass: POSOperatorPass, reason: str) -> None:
        """Termina el pase. Idempotente: el primer motivo gana."""
        updated = POSOperatorPass.objects.filter(pk=op_pass.pk, ended_at__isnull=True).update(
            ended_at=timezone.now(), end_reason=reason
        )
        if updated:
            op_pass.refresh_from_db(fields=["ended_at", "end_reason"])
