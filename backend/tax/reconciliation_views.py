"""API del cuadre fiscal: reporte del período, ventas TUU y documentos RCV (ADR-0138 D4-D6)."""

import calendar
from datetime import date

from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounting.models import RCVDocument, RCVImport
from treasury.models import TerminalSale

from .reconciliation.rcv import (
    match_rcv_document,
    rcv_document_candidates,
    reconcile_rcv_period,
    unmatch_rcv_document,
)
from .reconciliation.report import fiscal_reconciliation_report
from .reconciliation.terminal import (
    match_terminal_sale,
    reconcile_terminal_sales,
    terminal_sale_candidates,
    unmatch_terminal_sale,
)
from .reconciliation_serializers import (
    InvoiceCandidateSerializer,
    PeriodSerializer,
    TerminalCandidateSerializer,
    TerminalMatchSerializer,
    TerminalRunSerializer,
)

_PERM = "tax.change_taxperiod"
_SALE = r"terminal-sales/(?P<sale_id>[0-9]+)"
_DOC = r"rcv-documents/(?P<doc_id>[0-9]+)"


def _period(data) -> tuple[int, int]:
    body = PeriodSerializer(data=data)
    body.is_valid(raise_exception=True)
    return body.validated_data["year"], body.validated_data["month"]


def _rcv_link(doc: RCVDocument) -> Response:
    return Response({"id": doc.pk, "match_status": doc.match_status, "matched_invoice": doc.matched_invoice_id})


class TerminalReconciliationViewSet(viewsets.ViewSet):
    action_permissions = {
        "list": "tax.view_taxperiod",
        **dict.fromkeys(
            ("run", "candidates", "match", "unmatch", "rcv_run", "rcv_candidates", "rcv_match", "rcv_unmatch"),
            _PERM,
        ),
    }

    def list(self, request):
        return Response(fiscal_reconciliation_report(*_period(request.query_params)))

    @action(detail=False, methods=["post"], url_path="terminal/run")
    def run(self, request):
        body = TerminalRunSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        year, month = body.validated_data["year"], body.validated_data["month"]
        last = calendar.monthrange(year, month)[1]
        return Response(reconcile_terminal_sales(date(year, month, 1), date(year, month, last)))

    @action(detail=False, methods=["get"], url_path=f"{_SALE}/candidates")
    def candidates(self, request, sale_id=None):
        sale = get_object_or_404(TerminalSale, pk=sale_id)
        return Response(TerminalCandidateSerializer(terminal_sale_candidates(sale), many=True).data)

    @action(detail=False, methods=["post"], url_path=f"{_SALE}/match")
    def match(self, request, sale_id=None):
        sale = get_object_or_404(TerminalSale, pk=sale_id)
        body = TerminalMatchSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        match_terminal_sale(sale, body.validated_data["invoice"])
        return Response({"id": sale.pk, "match_status": sale.match_status, "matched_invoice": sale.matched_invoice_id})

    @action(detail=False, methods=["post"], url_path=f"{_SALE}/unmatch")
    def unmatch(self, request, sale_id=None):
        sale = unmatch_terminal_sale(get_object_or_404(TerminalSale, pk=sale_id))
        return Response({"id": sale.pk, "match_status": sale.match_status, "matched_invoice": None})

    @action(detail=False, methods=["post"], url_path="rcv/run")
    def rcv_run(self, request):
        year, month = _period(request.data)
        return Response({
            "purchase": reconcile_rcv_period(RCVImport.Direction.PURCHASES, year, month),
            "sale": reconcile_rcv_period(RCVImport.Direction.SALES, year, month),
        })

    @action(detail=False, methods=["get"], url_path=f"{_DOC}/candidates")
    def rcv_candidates(self, request, doc_id=None):
        doc = get_object_or_404(RCVDocument, pk=doc_id)
        return Response(InvoiceCandidateSerializer(rcv_document_candidates(doc), many=True).data)

    @action(detail=False, methods=["post"], url_path=f"{_DOC}/match")
    def rcv_match(self, request, doc_id=None):
        doc = get_object_or_404(RCVDocument, pk=doc_id)
        body = TerminalMatchSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        return _rcv_link(match_rcv_document(doc, body.validated_data["invoice"]))

    @action(detail=False, methods=["post"], url_path=f"{_DOC}/unmatch")
    def rcv_unmatch(self, request, doc_id=None):
        return _rcv_link(unmatch_rcv_document(get_object_or_404(RCVDocument, pk=doc_id)))
