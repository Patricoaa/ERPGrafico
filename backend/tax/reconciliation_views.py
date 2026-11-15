"""API del cuadre fiscal de ventas TUU (ADR-0138 D4)."""

import calendar
from datetime import date

from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from treasury.models import TerminalSale

from .reconciliation.terminal import (
    match_terminal_sale,
    reconcile_terminal_sales,
    terminal_sale_candidates,
    unmatch_terminal_sale,
)
from .reconciliation_serializers import (
    TerminalCandidateSerializer,
    TerminalMatchSerializer,
    TerminalRunSerializer,
)

_PERM = "tax.change_taxperiod"
_SALE = r"terminal-sales/(?P<sale_id>[0-9]+)"


class TerminalReconciliationViewSet(viewsets.ViewSet):
    action_permissions = {"run": _PERM, "candidates": _PERM, "match": _PERM, "unmatch": _PERM}

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
