"""
Decorador @idempotent_endpoint para garantizar idempotencia HTTP.

Ver docs/20-contracts/idempotency.md.

Uso:

    from core.idempotency import idempotent_endpoint

    class InvoiceViewSet(ModelViewSet):
        @idempotent_endpoint(scope="billing.invoice.create")
        def create(self, request, *args, **kwargs):
            return super().create(request, *args, **kwargs)

El cliente debe enviar el header `Idempotency-Key: <uuidv4>` generado una sola
vez por acción del usuario y reusado en cualquier retry HTTP.
"""

from __future__ import annotations

import json
from functools import wraps
from hashlib import sha256

from django.db import IntegrityError, transaction
from rest_framework import status as http_status
from rest_framework.response import Response

from core.models import IdempotencyRecord


def idempotent_endpoint(scope: str):
    """
    Garantiza que múltiples llamadas con el mismo Idempotency-Key + scope
    devuelvan el resultado de la primera ejecución, sin re-ejecutar el view.

    - Sin header → 400.
    - Mismo key + mismo body → response cacheada (status original).
    - Mismo key + body distinto → 409 Conflict.
    - Mismo key con ejecución en curso (otra request en flight) → 425 Too Early.
    - Usuario anónimo → 401.

    Ventana de validez: 24h. Pasada esa ventana, el cleanup task purga el registro
    y la siguiente llamada con el mismo key se trata como nueva.
    """

    def decorator(view_func):
        @wraps(view_func)
        def wrapper(self, request, *args, **kwargs):
            key = request.headers.get("Idempotency-Key")
            if not key:
                return Response(
                    {"detail": "Idempotency-Key header required"},
                    status=http_status.HTTP_400_BAD_REQUEST,
                )

            if not getattr(request.user, "is_authenticated", False):
                return Response(
                    {"detail": "Authentication required"},
                    status=http_status.HTTP_401_UNAUTHORIZED,
                )

            body_hash = _compute_body_hash(request)

            record, created = _get_or_create_record(
                key=key, scope=scope, body_hash=body_hash, user=request.user
            )

            if record.body_hash != body_hash:
                return Response(
                    {"detail": "Idempotency-Key reused with different body"},
                    status=http_status.HTTP_409_CONFLICT,
                )

            if record.status == IdempotencyRecord.Status.DONE:
                return Response(
                    record.response_payload,
                    status=record.response_status or http_status.HTTP_200_OK,
                )

            # 425 only applies to existing PENDING records from a concurrent
            # request. A freshly created record (created=True) must proceed.
            if not created and record.status == IdempotencyRecord.Status.PENDING and _is_concurrent(record):
                return Response(
                    {"detail": "In progress, retry shortly"},
                    status=http_status.HTTP_425_TOO_EARLY,
                )

            # First execution path — el record acaba de crearse o quedó en pending sin lock activo.
            try:
                response = view_func(self, request, *args, **kwargs)
            except Exception:
                record.status = IdempotencyRecord.Status.ERROR
                record.save(update_fields=["status"])
                raise

            record.response_status = response.status_code
            record.response_payload = _coerce_payload(response.data)
            record.status = IdempotencyRecord.Status.DONE
            record.save(update_fields=["response_status", "response_payload", "status"])
            return response

        return wrapper

    return decorator


def _compute_body_hash(request) -> str:
    """
    Compute deterministic body hash for idempotency.

    For multipart/form-data: hash parsed POST data + file metadata
    instead of raw body, because the raw multipart body includes a
    random boundary that differs on every request (breaks retries).

    For other content types: hash raw request.body.
    """
    content_type = (request.content_type or "").lower()
    if "multipart/form-data" in content_type:
        post_data = {k: sorted(v) for k, v in sorted(request.POST.lists())}
        files_data = {}
        for key, file_list in request.FILES.lists():
            files_data[key] = sorted(
                [
                    {"name": f.name, "content_type": f.content_type, "size": f.size}
                    for f in file_list
                ],
                key=lambda x: x["name"],
            )
        hash_input = json.dumps(
            {"post": post_data, "files": files_data},
            sort_keys=True,
            default=str,
        )
        return sha256(hash_input.encode()).hexdigest()
    return sha256(request.body or b"").hexdigest()


def _get_or_create_record(*, key: str, scope: str, body_hash: str, user) -> tuple[IdempotencyRecord, bool]:
    """
    INSERT idempotente bajo unique_together(key, scope). Race-safe: si dos
    requests entran simultáneamente, una crea y la otra lo encuentra en el
    segundo intento.

    Returns (record, created) tuple where created=True means the record was
    inserted by this request (first execution path).
    """
    try:
        with transaction.atomic():
            return (
                IdempotencyRecord.objects.create(
                    key=key,
                    scope=scope,
                    body_hash=body_hash,
                    user=user,
                    status=IdempotencyRecord.Status.PENDING,
                ),
                True,
            )
    except IntegrityError:
        return IdempotencyRecord.objects.get(key=key, scope=scope), False


def _is_concurrent(record: IdempotencyRecord) -> bool:
    """
    Heurística simple para detectar ejecución en curso: el record está PENDING
    y fue creado hace menos de 60s. Después de 60s asumimos que la ejecución
    original murió (timeout / worker crash) y permitimos reintento.

    Esto es deliberadamente laxo: el costo de un retry pendiente que en realidad
    no estaba colgado es bajo (idempotencia interna del view lo cubre); el costo
    de bloquear indefinidamente por un PENDING fantasma es mucho mayor.
    """
    from django.utils import timezone

    return (timezone.now() - record.created_at).total_seconds() < 60


def _coerce_payload(data):
    """
    Aplana DRF response.data a algo serializable a JSONField.
    Convierte recursivamente valores no primitivos (Decimal, datetime, UUID, etc.) a str.
    """
    if data is None or isinstance(data, (str, int, float, bool)):
        return data
    if isinstance(data, dict):
        return {k: _coerce_payload(v) for k, v in data.items()}
    if isinstance(data, (list, tuple)):
        return [_coerce_payload(item) for item in data]
    return str(data)
