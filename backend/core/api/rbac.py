"""RBAC catalog and bundles API views.

GET /permissions/catalog/ — curated permission catalog grouped by app.
GET /permissions/bundles/ — all bundle definitions with their expanded perms.

Both require auth.view_group.
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from core.api.permissions import require_perms

_ViewGroup = require_perms("auth.view_group")


@api_view(["GET"])
@permission_classes([_ViewGroup])
def catalog_view(request):
    """Return the curated permission catalog grouped by app."""
    from core.rbac.catalog import curated_catalog
    return Response(curated_catalog())


@api_view(["GET"])
@permission_classes([_ViewGroup])
def bundles_view(request):
    """Return all bundle definitions with their expanded permissions."""
    from core.rbac.bundles import BUNDLES, expand
    result = [
        {**bundle, "permissions": sorted(expand([key]))}
        for key, bundle in BUNDLES.items()
    ]
    return Response(result)
