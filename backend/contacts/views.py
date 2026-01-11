from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db import models
from .models import Contact
from .serializers import ContactSerializer, ContactListSerializer


class ContactViewSet(viewsets.ModelViewSet):
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
