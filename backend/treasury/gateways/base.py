"""
Contrato abstracto para gateways de pago remoto. Ver ADR 002.

Toda implementación concreta (TuuGateway, FakeTuuGateway) debe cumplir con
PaymentGateway. La máquina de estados de PaymentRequest vive en el modelo;
el gateway solo traduce entre nuestro modelo y la API del proveedor.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from treasury.models import PaymentRequest


class GatewayError(Exception):
    """Error al comunicar con el gateway (red, 4xx, 5xx, parsing)."""

    def __init__(self, message: str, *, code: str = "", http_status: int | None = None):
        super().__init__(message)
        self.code = code
        self.http_status = http_status


@dataclass
class GatewayResponse:
    """Respuesta normalizada del gateway tras create() o fetch_status()."""

    status: str
    raw: dict = field(default_factory=dict)
    sequence_number: str = ""
    transaction_reference: str = ""
    acquirer_id: str = ""
    failure_reason: str = ""


class PaymentGateway(ABC):
    """Interfaz mínima para cualquier proveedor de pago remoto."""

    @abstractmethod
    def create(self, payment_request: "PaymentRequest") -> GatewayResponse:
        """Envía la solicitud de cobro al terminal físico."""

    @abstractmethod
    def fetch_status(self, idempotency_key: str) -> GatewayResponse:
        """Consulta el estado actual de una solicitud ya creada."""
