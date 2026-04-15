"""
Fake gateway para dev/test sin hardware ni cobros reales. Ver ADR 002 §D5/§D10.

Simula la máquina de estados de TUU: tras create() la solicitud avanza
Pending → Sent → Processing → Completed/Failed según el `amount` recibido.

Convenciones útiles para tests:
- amount % 10 == 1 → Failed con failure_reason='MR-SIMULATED'
- amount % 10 == 2 → Canceled
- resto            → Completed tras N fetch_status()

El estado se mantiene en memoria del proceso; compartido por idempotency_key.
"""
from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field

from .base import GatewayError, GatewayResponse, PaymentGateway


@dataclass
class _FakeEntry:
    amount: int
    device: str
    poll_count: int = 0
    raw: dict = field(default_factory=dict)


class FakeTuuGateway(PaymentGateway):
    """Implementación en memoria, segura para threads."""

    # Ciclos de fetch_status antes de llegar a estado terminal
    TRANSITIONS_TO_TERMINAL = 2

    def __init__(self):
        self._store: dict[str, _FakeEntry] = {}
        self._lock = threading.Lock()

    def create(self, payment_request) -> GatewayResponse:
        key = payment_request.idempotency_key
        with self._lock:
            if key in self._store:
                raise GatewayError(
                    "idempotency_key ya existe", code="DUPLICATE", http_status=409
                )
            self._store[key] = _FakeEntry(
                amount=int(payment_request.amount),
                device=payment_request.device.serial_number,
            )
        return GatewayResponse(status="Sent", raw={"idempotencyKey": key, "status": "Sent"})

    def fetch_status(self, idempotency_key: str) -> GatewayResponse:
        with self._lock:
            entry = self._store.get(idempotency_key)
            if entry is None:
                raise GatewayError(
                    "PaymentRequest no encontrada", code="NOT_FOUND", http_status=404
                )
            entry.poll_count += 1
            count = entry.poll_count
            amount = entry.amount
            device = entry.device

        if count < self.TRANSITIONS_TO_TERMINAL:
            return GatewayResponse(
                status="Processing",
                raw={"idempotencyKey": idempotency_key, "status": "Processing"},
            )

        if amount % 10 == 1:
            return GatewayResponse(
                status="Failed",
                failure_reason="MR-SIMULATED",
                raw={
                    "idempotencyKey": idempotency_key,
                    "status": "Failed",
                    "error": "MR-SIMULATED",
                },
            )
        if amount % 10 == 2:
            return GatewayResponse(
                status="Canceled",
                raw={"idempotencyKey": idempotency_key, "status": "Canceled"},
            )

        seq = f"{count:012d}"
        tx_ref = str(uuid.uuid4())
        acq = str(uuid.uuid4())
        return GatewayResponse(
            status="Completed",
            sequence_number=seq,
            transaction_reference=tx_ref,
            acquirer_id=acq,
            raw={
                "idempotencyKey": idempotency_key,
                "status": "Completed",
                "sequenceNumber": seq,
                "amount": amount,
                "device": device,
                "dteType": 48,
                "transactionReference": tx_ref,
                "acquirerId": acq,
            },
        )

    # Helpers solo para tests
    def _reset(self):
        with self._lock:
            self._store.clear()
