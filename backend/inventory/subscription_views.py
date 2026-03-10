from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import Subscription
from .subscription_serializers import SubscriptionSerializer


class SubscriptionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing subscriptions.
    Provides CRUD operations plus custom actions for pause, cancel, and resume.
    """
    queryset = Subscription.objects.all().select_related('product', 'supplier').order_by('-created_at')
    serializer_class = SubscriptionSerializer
    
    def get_queryset(self):
        """
        Optionally filter by status, supplier, or upcoming renewals.
        """
        queryset = super().get_queryset()
        
        # Filter by status
        status_filter = self.request.query_params.get('status', None)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Filter by supplier
        supplier_id = self.request.query_params.get('supplier', None)
        if supplier_id:
            queryset = queryset.filter(supplier_id=supplier_id)
        
        # Filter by upcoming renewals (next N days)
        upcoming_days = self.request.query_params.get('upcoming_days', None)
        if upcoming_days:
            try:
                days = int(upcoming_days)
                threshold = timezone.now().date() + timezone.timedelta(days=days)
                queryset = queryset.filter(
                    status=Subscription.Status.ACTIVE,
                    next_payment_date__lte=threshold
                )
            except ValueError:
                pass
        
        return queryset
    
    @action(detail=True, methods=['post'])
    def pause(self, request, pk=None):
        """
        Pause an active subscription.
        """
        subscription = self.get_object()
        
        if subscription.status != Subscription.Status.ACTIVE:
            return Response(
                {'error': 'Solo se pueden pausar suscripciones activas'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        subscription.status = Subscription.Status.PAUSED
        subscription.save()
        
        serializer = self.get_serializer(subscription)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """
        Cancel a subscription permanently.
        """
        subscription = self.get_object()
        
        subscription.status = Subscription.Status.CANCELLED
        subscription.end_date = timezone.now().date()
        subscription.save()
        
        serializer = self.get_serializer(subscription)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def resume(self, request, pk=None):
        """
        Resume a paused subscription.
        """
        subscription = self.get_object()
        
        if subscription.status != Subscription.Status.PAUSED:
            return Response(
                {'error': 'Solo se pueden reanudar suscripciones pausadas'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        subscription.status = Subscription.Status.ACTIVE
        subscription.save()
        
        serializer = self.get_serializer(subscription)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        Get subscription statistics.
        """
        from django.db.models import Sum, Count
        
        active_count = Subscription.objects.filter(status=Subscription.Status.ACTIVE).count()
        paused_count = Subscription.objects.filter(status=Subscription.Status.PAUSED).count()
        cancelled_count = Subscription.objects.filter(status=Subscription.Status.CANCELLED).count()
        
        total_monthly_cost = Subscription.objects.filter(
            status=Subscription.Status.ACTIVE
        ).aggregate(total=Sum('amount'))['total'] or 0
        
        upcoming_renewals = Subscription.objects.filter(
            status=Subscription.Status.ACTIVE,
            next_payment_date__lte=timezone.now().date() + timezone.timedelta(days=30)
        ).count()
        
        return Response({
            'active_subscriptions': active_count,
            'paused_subscriptions': paused_count,
            'cancelled_subscriptions': cancelled_count,
            'total_monthly_cost': float(total_monthly_cost),
            'upcoming_renewals_30_days': upcoming_renewals,
        })

    @action(detail=False, methods=['post'])
    def trigger_inspection(self, request):
        """
        Manually trigger the daily subscription inspection task async.
        """
        from purchasing.tasks import generate_subscription_orders
        
        # Run asynchronously so the frontend doesn't hang
        try:
            generate_subscription_orders.delay()
            return Response({'message': 'Inspección de suscripciones encolada (ejecución asíncrona).'})
        except Exception as e:
            return Response(
                {'error': f"Error al encolar la tarea: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        """
        Get history of Purchase Orders and unit costs for this subscription.
        """
        subscription = self.get_object()
        product = subscription.product
        supplier = subscription.supplier

        # Get Purchase Orders linked to this product and supplier
        from purchasing.models import PurchaseOrder, PurchaseLine
        
        orders_qs = PurchaseOrder.objects.filter(
            supplier=supplier,
            lines__product=product
        ).distinct().order_by('-date')

        # Since we might not have a specialized serializer for this summary, 
        # we'll build a simplified response.
        orders_data = []
        for order in orders_qs:
            orders_data.append({
                'id': order.id,
                'number': order.number,
                'display_id': order.display_id,
                'date': order.date,
                'status': order.status,
                'total': float(order.total),
                'receiving_status': order.receiving_status,
            })

        # Get Unit Cost history from Purchase Lines
        price_history_qs = PurchaseLine.objects.filter(
            product=product,
            order__supplier=supplier,
            order__status__in=[PurchaseOrder.Status.CONFIRMED, PurchaseOrder.Status.RECEIVED]
        ).order_by('-order__date')[:20]

        price_history = []
        for line in price_history_qs:
            price_history.append({
                'date': line.order.date,
                'unit_cost': float(line.unit_cost),
                'order_number': line.order.number,
            })

        # Get Credit/Debit Notes associated with these Purchase Orders
        from billing.models import Invoice
        notes_qs = Invoice.objects.filter(
            purchase_order__in=orders_qs,
            dte_type__in=[Invoice.DTEType.NOTA_CREDITO, Invoice.DTEType.NOTA_DEBITO]
        ).order_by('-date')

        notes_data = []
        for note in notes_qs:
            notes_data.append({
                'id': note.id,
                'number': note.number,
                'display_id': note.display_id,
                'date': note.date,
                'status': note.status,
                'dte_type': note.dte_type,
                'total': float(note.total),
                'purchase_order_number': note.purchase_order.number if note.purchase_order else None
            })

        return Response({
            'orders': orders_data,
            'price_history': price_history,
            'notes': notes_data,
            'product_name': product.name,
            'supplier_name': supplier.name
        })
