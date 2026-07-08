from core.api.pagination import StandardResultsSetPagination
from decimal import Decimal

from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.mixins import AuditHistoryMixin

from .models import Contact
from .selectors import ContactSelector, list_contacts, list_credit_portfolio
from .serializers import ContactListSerializer, ContactSerializer


class ContactViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    pagination_class = StandardResultsSetPagination
    """
    ViewSet for managing contacts.
    Supports filtering by type (customer/supplier/both/none).
    """

    queryset = Contact.objects.all()
    serializer_class = ContactSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["is_default_customer", "is_default_vendor"]
    search_fields = ["name", "tax_id", "email", "contact_name", "code"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]

    def destroy(self, request, *args, **kwargs):
        from rest_framework import status
        from rest_framework.exceptions import ValidationError
        from .services import ContactService

        contact = self.get_object()
        try:
            ContactService.validate_deletion(contact)
        except ValidationError as e:
            return Response({"error": str(e.detail)}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

    def get_serializer_class(self):
        """Use lightweight serializer for list action"""
        if self.action == "list":
            return ContactListSerializer
        return ContactSerializer

    def get_queryset(self):
        return list_contacts(params=self.request.query_params)

    @action(detail=False, methods=["get"], url_path="filter-suggestions")
    def filter_suggestions(self, request):
        q = request.query_params.get("q", "").strip()
        return Response(ContactSelector.filter_suggestions(q))

    @action(detail=False, methods=["get"])
    def customers(self, request):
        contacts = ContactSelector.list_customers()
        serializer = self.get_serializer(contacts, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def suppliers(self, request):
        contacts = ContactSelector.list_suppliers()
        serializer = self.get_serializer(contacts, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def insights(self, request, pk=None):
        from .selectors import ContactSelectorExt
        return Response(ContactSelectorExt.get_insights(self.get_object()))

    @action(detail=True, methods=["get"])
    def credit_ledger(self, request, pk=None):
        """
        Returns a list of unpaid credit orders for the contact,
        enriched with due_date and aging_bucket.
        """
        contact = self.get_object()
        include_all = request.query_params.get("include_all", "false") == "true"

        from .selectors import ContactSelector

        ledger_data = ContactSelector.get_credit_ledger(contact=contact, include_all=include_all)
        return Response(ledger_data)

    @action(detail=False, methods=['get'])
    def credit_portfolio(self, request):
        from .selectors import ContactSelectorExt
        return Response(ContactSelectorExt.get_credit_portfolio_data_cached(request, self))

    @action(detail=True, methods=['post'])
    def write_off_debt(self, request, pk=None):
        from .services import ContactService
        from django.core.exceptions import ValidationError as DjangoValidationError
        from rest_framework.exceptions import ValidationError
        try:
            return Response(ContactService.write_off_debt_from_request(request, self.get_object()))
        except (DjangoValidationError, ValidationError) as e:
            return Response({'error': str(e.message if hasattr(e, 'message') else e)}, status=400)
        except Exception as e:
            return Response({'error': f'Error interno: {str(e)}'}, status=500)

    @action(detail=True, methods=["get"])
    def credit_history(self, request, pk=None):
        contact = self.get_object()
        return Response(ContactSelector.get_credit_history(contact))

    @action(detail=True, methods=["post"])
    def unblock_credit(self, request, pk=None):
        """Re-enables credit for a manually blocked contact"""
        from .services import ContactService

        contact = self.get_object()
        ContactService.unblock_credit(contact=contact, unblocked_by=request.user)
        return Response({"message": "Crédito rehabilitado correctamente."})

    @action(detail=True, methods=['post'])
    def recover_written_off_debt(self, request, pk=None):
        from .services import ContactService
        from django.core.exceptions import ValidationError as DjangoValidationError
        from rest_framework.exceptions import ValidationError
        try:
            return Response(ContactService.recover_written_off_debt_from_request(request, self.get_object()))
        except (DjangoValidationError, ValidationError) as e:
            return Response({'error': str(e.message if hasattr(e, 'message') else e)}, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    # ==========================================================
    # PARTNERS (SOCIOS) ENDPOINTS
    # ==========================================================

    @action(detail=False, methods=["get"])
    def partners(self, request):
        contacts = ContactSelector.list_partners()
        serializer = self.get_serializer(contacts, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def partner_statement(self, request, pk=None):
        from .selectors import ContactSelectorExt
        from rest_framework.exceptions import ValidationError
        try:
            return Response(ContactSelectorExt.get_partner_statement(self.get_object(), self.get_serializer))
        except ValidationError as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=False, methods=["get"])
    def partners_summary(self, request):
        """Calculates global metrics for the partner dashboard."""
        from .partner_service import PartnerService

        summary = PartnerService.get_global_summary()
        # Convert Decimal values to strings for JSON serialization
        for key in ["total_capital", "total_provisional_withdrawals"]:
            summary[key] = str(summary[key])
        return Response(summary)

    @action(detail=True, methods=["post"], url_path="promote-partner")
    def promote_partner(self, request, pk=None):
        """
        Promotes a contact to Partner (Socio), auto-creating the necessary accounting sub-accounts.
        """
        contact = self.get_object()
        from .services import ContactPartnerService

        try:
            ContactPartnerService.promote_to_partner(contact, user=request.user)
            return Response(self.get_serializer(contact).data)
        except Exception as e:
            from rest_framework import status

            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="demote-partner")
    def demote_partner(self, request, pk=None):
        """
        Demotes a Partner back to a regular Contact, removing the partner accounts if possible.
        """
        contact = self.get_object()
        from .services import ContactPartnerService

        try:
            ContactPartnerService.demote_from_partner(contact, user=request.user)
            return Response(self.get_serializer(contact).data)
        except Exception as e:
            from rest_framework import status

            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post", "put", "patch"])
    def setup_partner(self, request, pk=None):
        """Enable or update partner specific settings for a contact"""
        from .services import ContactService

        contact = self.get_object()
        ContactService.setup_partner(
            contact=contact,
            is_partner=request.data.get("is_partner", contact.is_partner),
            equity_percentage=request.data.get("partner_equity_percentage"),
        )
        return Response(self.get_serializer(contact).data)

    @action(detail=True, methods=['post'])
    def individual_dividend_payment(self, request, pk=None):
        from .services import ContactService
        from rest_framework.exceptions import ValidationError
        try:
            return Response(ContactService.individual_dividend_payment_from_request(request, self.get_object()))
        except ValidationError as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['get'])
    def partner_transactions(self, request, pk=None):
        from .serializers import PartnerTransactionSerializer
        transactions = ContactSelector.list_partner_transactions(self.get_object())
        page = self.paginate_queryset(transactions)
        if page is not None:
            return self.get_paginated_response(PartnerTransactionSerializer(page, many=True).data)
        return Response(PartnerTransactionSerializer(transactions, many=True).data)

    @action(detail=False, methods=["post"])
    @transaction.atomic
    def equity_subscription(self, request):
        """
        Records a formal capital subscription or reduction.
        Uses PartnerService for proper accounting separation.
        """
        from .partner_service import PartnerService
        try:
            ptx = PartnerService.handle_equity_movement_from_payload(request.data, request.user)
            return Response(
                {
                    "message": "Movimiento de capital registrado.",
                    "journal_entry": ptx.journal_entry.display_id if ptx.journal_entry else None,
                }
            )
        except ValidationError as e:
            return Response({"error": str(e.message if hasattr(e, 'message') else e)}, status=400)
        except Exception as e:
            return Response({"error": str(e)}, status=500)

    @action(detail=False, methods=["post"])
    @transaction.atomic
    def equity_transfer(self, request):
        """Records a transfer of participation between two partners."""
        from .partner_service import PartnerService

        try:
            seller_tx, buyer_tx = PartnerService.equity_transfer_from_request(request)
            return Response(
                {
                    "message": "Transferencia completada.",
                    "journal_entry": seller_tx.journal_entry.display_id
                    if seller_tx.journal_entry
                    else None,
                }
            )
        except ValidationError as e:
            return Response({"error": str(e.message if hasattr(e, 'message') else e)}, status=400)
        except Exception as e:
            return Response({"error": str(e)}, status=500)

    @action(detail=False, methods=["get"])
    def all_partner_transactions(self, request):
        return Response(ContactSelector.list_all_partner_transactions())

    @action(detail=False, methods=["get"])
    def equity_stakes_history(self, request):
        partner_id = request.query_params.get("partner_id")
        return Response(
            ContactSelector.get_equity_stakes_history(
                partner_id=int(partner_id) if partner_id else None
            )
        )

    @action(detail=False, methods=['post'])
    def initial_setup(self, request):
        from .services import ContactService
        from rest_framework.exceptions import ValidationError
        try:
            return Response(ContactService.initial_setup_from_request(request))
        except ValidationError as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=False, methods=['post'])
    def mass_mobilize_retained_earnings(self, request):
        from .services import ContactService
        from rest_framework.exceptions import ValidationError
        try:
            return Response(ContactService.mass_mobilize_retained_earnings_from_request(request))
        except ValidationError as e:
            return Response({'error': str(e)}, status=400)
