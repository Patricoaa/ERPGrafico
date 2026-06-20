from rest_framework import filters as drf_filters
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from core.registry import UniversalRegistry


class DistinctSearchFilter(drf_filters.SearchFilter):
    """
    Extends DRF's SearchFilter with .distinct() to prevent duplicate
    rows when search_fields span relationships (e.g. lines__product__name).
    """
    def filter_queryset(self, request, queryset, view):
        queryset = super().filter_queryset(request, queryset, view)
        search = request.query_params.get(self.search_param, '')
        if search:
            queryset = queryset.distinct()
        return queryset


class SearchThrottle(UserRateThrottle):
    scope = "search"


@api_view(["GET"])
@permission_classes([IsAuthenticated])
@throttle_classes([SearchThrottle])
def universal_search(request: Request) -> Response:
    q = request.GET.get("q", "").strip()
    limit = min(int(request.GET.get("limit", 20)), 50)

    if len(q) < 2:
        return Response({"results": []})

    results = UniversalRegistry.search(q, user=request.user, limit=limit)
    return Response({"results": results})
