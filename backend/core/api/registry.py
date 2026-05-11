from django.apps import apps
from django.core.cache import cache
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.serializers.metadata import build_schema


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def model_schema(request, model_label: str):
    cache_key = f"schema:{model_label}:{request.user.id}"
    cached = cache.get(cache_key)
    if cached:
        return Response(cached)

    try:
        app_label, model_name = model_label.split('.')
        model = apps.get_model(app_label, model_name)
    except (ValueError, LookupError):
        return Response({'error': 'Unknown model'}, status=404)

    perm = f"{app_label}.view_{model_name}"
    if not request.user.has_perm(perm):
        return Response({'error': 'Permission denied'}, status=403)

    schema = build_schema(model, user=request.user)
    
    # Expiration: 5 minutos (300s) según regla P-06, previene stale schemas
    cache.set(cache_key, schema, timeout=300)
    return Response(schema)
