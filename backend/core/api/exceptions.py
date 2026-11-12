import logging

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler

from core.exceptions import ERPGraficoError

logger = logging.getLogger(__name__)


def _flatten_messages(data):
    """Turn DRF error payloads (nested dicts/lists of ErrorDetail) into readable text."""
    if isinstance(data, dict):
        parts = []
        for field, value in data.items():
            text = _flatten_messages(value)
            if not text:
                continue
            parts.append(text if field == "non_field_errors" else f"{field}: {text}")
        return "; ".join(parts)
    if isinstance(data, (list, tuple)):
        return "; ".join(text for text in (_flatten_messages(item) for item in data) if text)
    return str(data) if data is not None else ""


def erpgrafico_exception_handler(exc, context):
    """
    Custom exception handler for Django REST Framework.
    Standardizes error responses for both application-specific and generic exceptions.
    """
    # Los servicios lanzan ValidationError de Django para reglas de negocio: son mensajes
    # pensados para el usuario, se responden como 400 (nunca como 500).
    if isinstance(exc, DjangoValidationError):
        exc = DRFValidationError(
            exc.message_dict if hasattr(exc, "error_dict") else exc.messages
        )

    # Call DRF's default exception handler first to get the standard error response.
    response = exception_handler(exc, context)

    if isinstance(exc, ERPGraficoError):
        # Handle our custom application errors
        data = {
            "error": {
                "message": exc.message,
                "code": exc.code,
                "details": exc.details,
                "timestamp": exc.timestamp.isoformat(),
            }
        }
        return Response(data, status=exc.status_code)

    if response is not None:
        # Standardize DRF built-in exceptions (like 401, 403, 404, 405)
        # We wrap them in our standard structure. `response.data` may be a
        # dict (serializer errors), a list of ErrorDetail (ValidationError
        # raised with a plain string/list) or a bare ErrorDetail.
        data = response.data
        if isinstance(data, dict):
            message = data.get("detail") or _flatten_messages(data) or str(data)
        elif isinstance(data, (list, tuple)):
            message = _flatten_messages(data) or str(data)
        else:
            message = str(data)
        code = "API_ERROR"

        if response.status_code == status.HTTP_401_UNAUTHORIZED:
            code = "UNAUTHORIZED"
        elif response.status_code == status.HTTP_403_FORBIDDEN:
            code = "FORBIDDEN"
        elif response.status_code == status.HTTP_404_NOT_FOUND:
            code = "NOT_FOUND"

        response.data = {
            "error": {
                "message": message,
                "code": code,
                "details": data,
                "status_code": response.status_code,
            }
        }
        logger.warning("API %s error: %s", response.status_code, response.data)
    else:
        # Handle unexpected exceptions (500 Internal Server Error)
        logger.exception("Generando 500 error no controlado:")

        data = {
            "error": {
                "message": "Ocurrió un error inesperado en el servidor.",
                "code": "INTERNAL_SERVER_ERROR",
                "details": str(exc) if settings.DEBUG else {},
                "status_code": 500,
            }
        }
        return Response(data, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return response
