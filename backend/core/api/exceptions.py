from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from .exceptions import ERPGraficoError
import logging

logger = logging.getLogger(__name__)

def erpgrafico_exception_handler(exc, context):
    """
    Custom exception handler for Django REST Framework.
    Standardizes error responses for both application-specific and generic exceptions.
    """
    # Call DRF's default exception handler first to get the standard error response.
    response = exception_handler(exc, context)

    if isinstance(exc, ERPGraficoError):
        # Handle our custom application errors
        data = {
            "error": {
                "message": exc.message,
                "code": exc.code,
                "details": exc.details,
                "timestamp": exc.timestamp.isoformat()
            }
        }
        return Response(data, status=exc.status_code)

    if response is not None:
        # Standardize DRF built-in exceptions (like 401, 403, 404, 405)
        # We wrap them in our standard structure
        message = response.data.get("detail") or str(response.data)
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
                "details": response.data,
                "status_code": response.status_code
            }
        }
    else:
        # Handle unexpected exceptions (500 Internal Server Error)
        logger.exception("Generando 500 error no controlado:")
        
        data = {
            "error": {
                "message": "Ocurrió un error inesperado en el servidor.",
                "code": "INTERNAL_SERVER_ERROR",
                "details": str(exc) if hasattr(exc, "__dict__") else {},
                "status_code": 500
            }
        }
        return Response(data, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return response
