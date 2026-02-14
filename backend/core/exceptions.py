from datetime import datetime
from typing import Optional, Dict, Any

class ERPGraficoError(Exception):
    """Base exception for all ERPGrafico errors."""
    def __init__(
        self, 
        message: str, 
        code: str = "INTERNAL_ERROR", 
        details: Optional[Dict[str, Any]] = None,
        status_code: int = 500
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.details = details or {}
        self.status_code = status_code
        self.timestamp = datetime.utcnow()

class DomainError(ERPGraficoError):
    """Raised when a business rule is violated."""
    def __init__(self, message: str, code: str = "DOMAIN_ERROR", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, code, details, status_code=400)

class ValidationError(DomainError):
    """Raised when data validation fails."""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, code="VALIDATION_ERROR", details=details)

class NotFoundError(ERPGraficoError):
    """Raised when a resource is not found."""
    def __init__(self, resource: str, identifier: Any):
        super().__init__(
            f"{resource} con identificador {identifier} no fue encontrado.",
            code="NOT_FOUND",
            details={"resource": resource, "identifier": identifier},
            status_code=404
        )

class InfrastructureError(ERPGraficoError):
    """Raised when an external service or infrastructure component fails."""
    def __init__(self, message: str, service: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message, 
            code="INFRASTRUCTURE_ERROR", 
            details={**(details or {}), "service": service},
            status_code=502
        )
