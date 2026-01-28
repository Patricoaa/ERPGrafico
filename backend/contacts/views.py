from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db import models
from core.views import AuditHistoryMixin
from .models import Contact
from .serializers import ContactSerializer, ContactListSerializer


class ContactViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    """
    ViewSet for managing contacts.
    Supports filtering by type (customer/supplier/both/none).
    """
    queryset = Contact.objects.all()
    serializer_class = ContactSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_default_customer', 'is_default_vendor']
    search_fields = ['name', 'tax_id', 'email', 'contact_name']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']
    
    def get_serializer_class(self):
        """Use lightweight serializer for list action"""
        if self.action == 'list':
            return ContactListSerializer
        return ContactSerializer
    
    def get_queryset(self):
        """
        Filter contacts by type if requested.
        ?type=customer - only contacts with sale orders
        ?type=supplier - only contacts with purchase orders
        ?type=both - contacts with both sale and purchase orders
        ?type=none - contacts without any orders
        """
        queryset = super().get_queryset()
        contact_type = self.request.query_params.get('type', None)
        
        if contact_type:
            contact_type = contact_type.upper()
            if contact_type == 'CUSTOMER':
                # Include contacts that are customers or have no role yet (potential)
                # Exclude only those who are strictly suppliers
                queryset = queryset.filter(
                    models.Q(sale_orders__isnull=False) | 
                    models.Q(sale_orders__isnull=True, purchase_orders__isnull=True)
                ).distinct()
            elif contact_type == 'SUPPLIER':
                # Include contacts that are suppliers or have no role yet
                # Exclude only those who are strictly customers
                queryset = queryset.filter(
                    models.Q(purchase_orders__isnull=False) | 
                    models.Q(sale_orders__isnull=True, purchase_orders__isnull=True)
                ).distinct()
            elif contact_type == 'BOTH':
                # Has both sale and purchase orders
                queryset = queryset.filter(sale_orders__isnull=False, purchase_orders__isnull=False).distinct()
            elif contact_type == 'NONE':
                # Has neither sale nor purchase orders
                queryset = queryset.filter(sale_orders__isnull=True, purchase_orders__isnull=True)
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def customers(self, request):
        """Get all contacts that are customers (have sale orders)"""
        contacts = Contact.objects.filter(sale_orders__isnull=False).distinct()
        serializer = self.get_serializer(contacts, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def suppliers(self, request):
        """Get all contacts that are suppliers (have purchase orders)"""
        contacts = Contact.objects.filter(purchase_orders__isnull=False).distinct()
        serializer = self.get_serializer(contacts, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def insights(self, request, pk=None):
        """
        Get insights for a specific contact including:
        - Sales summary (invoices, sale orders)
        - Purchases summary (purchase orders)
        - Work orders summary (as customer or related contact)
        """
        contact = self.get_object()
        
        # Sales data (invoices related to this contact)
        from billing.models import Invoice
        sales_invoices = Invoice.objects.filter(
            customer=contact,
            invoice_type__in=['FACTURA', 'BOLETA', 'NC', 'ND']
        ).order_by('-date')
        
        # Purchase data
        purchase_orders = contact.purchase_orders.all().order_by('-date')
        
        # Work orders (as sale customer or related contact)
        from production.models import WorkOrder
        work_orders_as_customer = WorkOrder.objects.filter(
            sale_order__customer=contact
        ).order_by('-created_at')
        
        work_orders_as_related = contact.related_work_orders.all().order_by('-created_at')
        
        # Combine and deduplicate work orders
        all_work_order_ids = set(
            list(work_orders_as_customer.values_list('id', flat=True)) +
            list(work_orders_as_related.values_list('id', flat=True))
        )
        all_work_orders = WorkOrder.objects.filter(id__in=all_work_order_ids).order_by('-created_at')
        
        # Serialize data
        from billing.serializers import InvoiceSerializer
        from purchasing.serializers import PurchaseOrderSerializer
        from production.serializers import WorkOrderSerializer
        
        return Response({
            'contact': ContactSerializer(contact).data,
            'sales': {
                'count': sales_invoices.count(),
                'invoices': InvoiceSerializer(sales_invoices[:50], many=True).data  # Limit to 50 most recent
            },
            'purchases': {
                'count': purchase_orders.count(),
                'orders': PurchaseOrderSerializer(purchase_orders[:50], many=True).data
            },
            'work_orders': {
                'count': all_work_orders.count(),
                'orders': WorkOrderSerializer(all_work_orders[:50], many=True).data
            }
        })
