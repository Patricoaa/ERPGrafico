"""Capa de abstracción sobre proveedores de terminales de pago. Ver ADR 002."""
from .base import GatewayError, GatewayResponse, PaymentGateway
from .factory import get_gateway

__all__ = ["GatewayError", "GatewayResponse", "PaymentGateway", "get_gateway"]
