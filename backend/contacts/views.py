
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.api.pagination import StandardResultsSetPagination
from core.idempotency import idempotent_endpoint
from core.mixins import AuditHistoryMixin

from .models import Contact
from .selectors import ContactSelector, list_contacts
from .serializers import (
    ContactListSerializer,
    ContactSerializer,
    ContactWriteSerializer,
    PartnerListSerializer,
)


class ContactViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    pagination_class = StandardResultsSetPagination
    """
    ViewSet for managing contacts.
    Supports filtering by type (customer/supplier/both/none).
    """

    queryset = Contact.objects.all()  # Base queryset includes archived for detail/update
    serializer_class = ContactSerializer
    action_permissions = {
        "unblock_credit": "sales.override_credit_limit",
        "write_off_debt": "contacts.write_off_contact",
        "recover_written_off_debt": "contacts.write_off_contact",
        "demote_partner": "contacts.post_partnertransaction",
        "equity_subscription": "contacts.post_partnertransaction",
        "equity_transfer": "contacts.post_partnertransaction",
        "individual_dividend_payment": "contacts.post_partnertransaction",
        "partner_transactions": "contacts.post_partnertransaction",
        "register_partner_transaction": "contacts.post_partnertransaction",
        "mass_mobilize_retained_earnings": "contacts.post_partnertransaction",
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["is_default_customer", "is_default_vendor"]
    search_fields = ["name", "tax_id", "email", "contact_name", "code"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]

    def get_queryset(self):
        # List view uses selector with is_active filter
        if self.action == "list":
            return list_contacts(params=self.request.query_params)
        # Detail/update/retrieve use full queryset (allows accessing archived)
        return super().get_queryset()

    def destroy(self, request, *args, **kwargs):
        # Archivo pattern: hard DELETE not allowed, use archive (is_active=false) instead
        return Response(
            {"detail": "Hard delete not allowed for Contacts. Use archive (is_active=false) instead."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def get_serializer_class(self):
        """Use lightweight serializer for list and partners actions"""
        if self.action == "list":
            return ContactListSerializer
        if self.action in ["create", "update", "partial_update"]:
            return ContactWriteSerializer
        if self.action == "partners":
            return PartnerListSerializer
        return ContactSerializer

    @action(detail=False, methods=["get"], url_path="filter-suggestions")
    def filter_suggestions(self, request):
        q = request.query_params.get("q", "").strip()
        return Response(ContactSelector.filter_suggestions(q))

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

        ledger_data = ContactSelector.get_credit_ledger(
            contact=contact, include_all=include_all, user=request.user
        )
        return Response(ledger_data)

    @action(detail=False, methods=['get'])
    def credit_portfolio(self, request):
        from .selectors import ContactSelectorExt
        return Response(ContactSelectorExt.get_credit_portfolio_data_cached(request, self))

    @action(detail=True, methods=['post'])
    def write_off_debt(self, request, pk=None):
        from .services import ContactService
        return Response(ContactService.write_off_debt_from_request(request, self.get_object()))

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
        return Response(ContactService.recover_written_off_debt_from_request(request, self.get_object()))

    # ==========================================================
    # PARTNERS (SOCIOS) ENDPOINTS
    # ==========================================================

    @action(detail=False, methods=["get"])
    def partners(self, request):
        return Response(ContactSelector.list_partner_payloads())

    @action(detail=True, methods=['get'])
    def partner_statement(self, request, pk=None):
        from .selectors import ContactSelectorExt
        return Response(ContactSelectorExt.get_partner_statement(self.get_object(), self.get_serializer))

    @action(detail=False, methods=["get"])
    def partners_summary(self, request):
        """Calculates global metrics for the partner dashboard."""
        from .partner_service import PartnerService
        return Response(PartnerService.get_global_summary_payload())

    @action(detail=True, methods=["post"], url_path="demote-partner")
    def demote_partner(self, request, pk=None):
        """Demotes a Partner back to a regular Contact, removing the partner accounts if possible."""
        from .services import ContactPartnerService

        contact = self.get_object()
        ContactPartnerService.demote_from_partner(contact, user=request.user)
        return Response(self.get_serializer(contact).data)

    @idempotent_endpoint(scope="contacts.partner.dividend_payment")
    @action(detail=True, methods=['post'])
    def individual_dividend_payment(self, request, pk=None):
        from .services import ContactService
        return Response(ContactService.individual_dividend_payment_from_request(request, self.get_object()))

    @action(detail=True, methods=['get'])
    def partner_transactions(self, request, pk=None):
        from .serializers import PartnerTransactionSerializer
        transactions = ContactSelector.list_partner_transactions(self.get_object())
        page = self.paginate_queryset(transactions)
        if page is not None:
            return self.get_paginated_response(PartnerTransactionSerializer(page, many=True).data)
        return Response(PartnerTransactionSerializer(transactions, many=True).data)

    @idempotent_endpoint(scope="contacts.partner.transaction")
    @partner_transactions.mapping.post
    def register_partner_transaction(self, request, pk=None):
        from .partner_service import PartnerService
        return Response(PartnerService.register_partner_transaction(request, self.get_object()))

    @idempotent_endpoint(scope="contacts.partner.equity_subscription")
    @action(detail=False, methods=["post"])
    def equity_subscription(self, request):
        """Records a formal capital subscription or reduction."""
        from .partner_service import PartnerService
        return Response(PartnerService.equity_subscription_response(request))

    @idempotent_endpoint(scope="contacts.partner.equity_transfer")
    @action(detail=False, methods=["post"])
    def equity_transfer(self, request):
        """Records a transfer of participation between two partners."""
        from .partner_service import PartnerService
        return Response(PartnerService.equity_transfer_response(request))

    @action(detail=False, methods=["get"])
    def equity_stakes_history(self, request):
        partner_id = request.query_params.get("partner_id")
        return Response(
            ContactSelector.get_equity_stakes_history(
                partner_id=int(partner_id) if partner_id else None
            )
        )

    @action(detail=False, methods=['get'])
    def partner_evolution(self, request):
        from .partner_analytics import PartnerAnalyticsService
        months = int(request.query_params.get('months', '24'))
        granularity = request.query_params.get('granularity', 'month')
        return Response(PartnerAnalyticsService.get_evolution(months, granularity))

    @idempotent_endpoint(scope="contacts.partner.mobilize_earnings")
    @action(detail=False, methods=['post'])
    def mass_mobilize_retained_earnings(self, request):
        from .services import ContactService
        return Response(ContactService.mass_mobilize_retained_earnings_from_request(request))
