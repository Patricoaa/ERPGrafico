from core.api.pagination import StandardResultsSetPagination
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .selectors import SubscriptionSelector
from .subscription_serializers import SubscriptionSerializer


class SubscriptionViewSet(viewsets.ModelViewSet):
    pagination_class = StandardResultsSetPagination
    serializer_class = SubscriptionSerializer

    def get_queryset(self):
        return SubscriptionSelector.list_subscriptions(params=self.request.query_params)

    @action(detail=True, methods=["post"])
    def pause(self, request, pk=None):
        """
        Pause an active subscription.
        """
        subscription = self.get_object()
        from .services import SubscriptionService
        from django.core.exceptions import ValidationError

        try:
            subscription = SubscriptionService.pause_subscription(subscription)
            serializer = self.get_serializer(subscription)
            return Response(serializer.data)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        """
        Cancel a subscription permanently.
        """
        subscription = self.get_object()
        from .services import SubscriptionService

        subscription = SubscriptionService.cancel_subscription(subscription)
        serializer = self.get_serializer(subscription)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def resume(self, request, pk=None):
        """
        Resume a paused subscription.
        """
        subscription = self.get_object()
        from .services import SubscriptionService
        from django.core.exceptions import ValidationError

        try:
            subscription = SubscriptionService.resume_subscription(subscription)
            serializer = self.get_serializer(subscription)
            return Response(serializer.data)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def stats(self, request):
        return Response(SubscriptionSelector.get_stats())

    @action(detail=False, methods=["post"])
    def trigger_inspection(self, request):
        """
        Manually trigger the daily subscription inspection task async.
        """
        from purchasing.tasks import generate_subscription_orders

        # Run asynchronously so the frontend doesn't hang
        try:
            from django.db import transaction
            transaction.on_commit(lambda: generate_subscription_orders.delay())
            return Response(
                {"message": "Inspección de suscripciones encolada (ejecución asíncrona)."}
            )
        except Exception as e:
            return Response(
                {"error": f"Error al encolar la tarea: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["get"])
    def history(self, request, pk=None):
        subscription = self.get_object()
        return Response(SubscriptionSelector.get_full_history(subscription))
