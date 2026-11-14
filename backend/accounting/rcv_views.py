"""API REST de la importación RCV (SII vía SimpleAPI)."""

from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.api.pagination import OptionalPaginationMixin, StandardResultsSetPagination
from core.api.permissions import require_perms
from core.idempotency import idempotent_endpoint

from . import rcv_service
from .models import RCVApiKey, RCVDocument, RCVImport, RCVSettings
from .rcv_serializers import (
    RCVApiKeySerializer,
    RCVDocumentFilterSerializer,
    RCVDocumentListSerializer,
    RCVDocumentSerializer,
    RCVImportFilterSerializer,
    RCVImportListSerializer,
    RCVImportSerializer,
    RCVImportStartSerializer,
    RCVSettingsSerializer,
)
from .selectors import (
    rcv_api_keys_queryset,
    rcv_document_detail_queryset,
    rcv_documents_queryset,
    rcv_import_detail_queryset,
    rcv_imports_queryset,
    rcv_total_monthly_quota,
)


class RCVDocumentViewSet(viewsets.ReadOnlyModelViewSet):
    """Documentos del RCV importados (solo lectura)."""

    pagination_class = StandardResultsSetPagination
    queryset = RCVDocument.objects.none()  # permisos por modelo; datos en get_queryset

    def get_queryset(self):
        if self.action != "list":
            return rcv_document_detail_queryset()
        filters = RCVDocumentFilterSerializer(data=self.request.query_params)
        filters.is_valid(raise_exception=True)
        return rcv_documents_queryset(filters.validated_data)

    def get_serializer_class(self):
        return RCVDocumentSerializer if self.action == "retrieve" else RCVDocumentListSerializer


class RCVImportViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Historial de importaciones RCV y disparo manual."""

    pagination_class = StandardResultsSetPagination
    queryset = RCVImport.objects.none()
    action_permissions = {"start": "accounting.add_rcvimport"}

    def get_queryset(self):
        if self.action == "retrieve":
            return rcv_import_detail_queryset()
        if self.action != "list":
            return rcv_imports_queryset({})
        filters = RCVImportFilterSerializer(data=self.request.query_params)
        filters.is_valid(raise_exception=True)
        return rcv_imports_queryset(filters.validated_data)

    def get_serializer_class(self):
        return RCVImportSerializer if self.action == "retrieve" else RCVImportListSerializer

    @idempotent_endpoint(scope="accounting.rcv_import.manual")
    @action(detail=False, methods=["post"])
    def start(self, request):
        from .tasks import run_rcv_imports

        body = RCVImportStartSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        data = body.validated_data
        try:
            imports = rcv_service.create_imports(
                data["year"],
                data["month"],
                data["directions"],
                RCVImport.Trigger.MANUAL,
                request.user,
            )
        except ValidationError as e:
            return Response({"detail": " ".join(e.messages)}, status=status.HTTP_400_BAD_REQUEST)
        rcv_service.enqueue_imports(imports, run_rcv_imports.delay)
        return Response(
            RCVImportListSerializer(imports, many=True).data, status=status.HTTP_202_ACCEPTED
        )


def _settings_context(settings: RCVSettings) -> dict:
    year, month = rcv_service.period_for(timezone.localdate())
    return {
        "next_period": {"year": year, "month": month},
        "estimated_monthly_queries": rcv_service.estimated_monthly_queries(settings),
        "total_monthly_quota": rcv_total_monthly_quota(),
    }


class RCVSettingsViewSet(viewsets.GenericViewSet):
    """Configuración singleton de la importación RCV (solo ``current``)."""

    queryset = RCVSettings.objects.all()
    serializer_class = RCVSettingsSerializer
    action_permissions = {"current": None}

    def get_permissions(self):
        if self.action == "current":
            verb = "view" if self.request.method in ("GET", "HEAD", "OPTIONS") else "change"
            return [require_perms(f"accounting.{verb}_rcvsettings")()]
        return super().get_permissions()

    @action(detail=False, methods=["get", "patch"])
    def current(self, request):
        settings = RCVSettings.get_settings()
        if request.method == "PATCH":
            serializer = RCVSettingsSerializer(settings, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            settings = serializer.save()
        context = {**self.get_serializer_context(), **_settings_context(settings)}
        return Response(RCVSettingsSerializer(settings, context=context).data)


class RCVApiKeyViewSet(OptionalPaginationMixin, viewsets.ModelViewSet):
    """API keys de SimpleAPI: key solo escritura, uso del mes anotado."""

    pagination_class = StandardResultsSetPagination
    queryset = RCVApiKey.objects.none()
    serializer_class = RCVApiKeySerializer

    def get_queryset(self):
        return rcv_api_keys_queryset(rcv_service.month_start(timezone.localdate()))
