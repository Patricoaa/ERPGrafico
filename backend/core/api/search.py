from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from core.registry import UniversalRegistry


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
