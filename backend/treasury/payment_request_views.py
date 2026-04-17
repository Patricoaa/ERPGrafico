"""
Endpoints DRF para PaymentRequest (Pago Remoto TUU). Ver ADR 002 §D8.

- POST /api/treasury/payments/initiate
- GET  /api/treasury/payments/{idempotency_key}
- POST /api/treasury/payments/{idempotency_key}/cancel
"""
from __future__ import annotations

from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .gateways import GatewayError
from .models import PaymentRequest, PaymentTerminalDevice, POSSession
from .payment_request_service import PaymentRequestService


class PaymentRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentRequest
        fields = [
            "id", "idempotency_key", "status", "amount",
            "device", "provider", "dte_type", "payment_method_code",
            "description", "sale_order", "pos_session",
            "sequence_number", "transaction_reference", "acquirer_id",
            "failure_reason", "initiated_at", "completed_at",
        ]
        read_only_fields = fields


class InitiateSerializer(serializers.Serializer):
    device = serializers.PrimaryKeyRelatedField(queryset=PaymentTerminalDevice.objects.all())
    amount = serializers.IntegerField(min_value=100, max_value=99_999_999)
    payment_method_code = serializers.ChoiceField(
        choices=PaymentRequest.PaymentMethodCode.choices,
        default=PaymentRequest.PaymentMethodCode.CREDIT,
    )
    # ADR 002 §D1: alcance actual = solo DTE 48 (Comprobante de Pago Electrónico).
    # Ampliar choices si se suman otros tipos (33, 39) en el futuro.
    dte_type = serializers.ChoiceField(choices=[(48, "COMPROBANTE_PAGO")], default=48)
    description = serializers.CharField(max_length=28, required=False, allow_blank=True)
    sale_order = serializers.IntegerField(required=False, allow_null=True)
    pos_session = serializers.PrimaryKeyRelatedField(
        queryset=POSSession.objects.all(), required=False, allow_null=True
    )
    idempotency_key = serializers.CharField(max_length=36, required=False, allow_blank=True)


class PaymentRequestViewSet(viewsets.ViewSet):
    """
    ViewSet acciones:
    - initiate: POST /initiate
    - retrieve: GET /{idempotency_key}
    - cancel:   POST /{idempotency_key}/cancel
    """
    lookup_field = "idempotency_key"

    def retrieve(self, request, idempotency_key=None):
        try:
            pr = PaymentRequestService.get_by_key(idempotency_key)
        except PaymentRequest.DoesNotExist:
            return Response({"detail": "No encontrada"}, status=status.HTTP_404_NOT_FOUND)
        return Response(PaymentRequestSerializer(pr).data)

    @action(detail=False, methods=["post"])
    def initiate(self, request):
        serializer = InitiateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        sale_order_ref = None
        so_id = data.get("sale_order")
        if so_id:
            from sales.models import SaleOrder
            sale_order_ref = SaleOrder.objects.filter(pk=so_id).first()

        try:
            result = PaymentRequestService.initiate(
                device=data["device"],
                amount=data["amount"],
                payment_method_code=int(data["payment_method_code"]),
                dte_type=int(data.get("dte_type", 48)),
                description=data.get("description", ""),
                sale_order=sale_order_ref,
                pos_session=data.get("pos_session"),
                idempotency_key=data.get("idempotency_key") or None,
            )
        except GatewayError as exc:
            http = exc.http_status or 400
            return Response(
                {"detail": str(exc), "code": exc.code}, status=http
            )

        return Response(
            PaymentRequestSerializer(result.payment_request).data,
            status=status.HTTP_201_CREATED if result.created else status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"])
    def cancel(self, request, idempotency_key=None):
        try:
            pr = PaymentRequestService.cancel(idempotency_key)
        except PaymentRequest.DoesNotExist:
            return Response({"detail": "No encontrada"}, status=status.HTTP_404_NOT_FOUND)
        except GatewayError as exc:
            return Response(
                {"detail": str(exc), "code": exc.code},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(PaymentRequestSerializer(pr).data)
