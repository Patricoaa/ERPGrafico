from django.conf import settings
from django.contrib.auth.models import Group
from django.db.models import Count
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from core.api.pagination import StandardResultsSetPagination
from core.api.permissions import require_perms
from core.mixins import AuditHistoryMixin

from .models import ActionLog, BackgroundJob, CompanySettings, User
from .serializers import (
    ActionLogSerializer,
    BackgroundJobSerializer,
    CompanySettingsSerializer,
    CustomTokenRefreshSerializer,
    GroupSerializer,
    MeSerializer,
    PublicCompanyBrandingSerializer,
    UserSerializer,
)
from .services import (
    ActionLoggingService,
    CoreSelector,
    CoreService,
    GroupService,
    UserService,
)


class BackgroundJobViewSet(viewsets.ModelViewSet):
    pagination_class = StandardResultsSetPagination
    queryset = BackgroundJob.objects.all()
    serializer_class = BackgroundJobSerializer
    permission_classes = [IsAuthenticated]


class CustomTokenRefreshView(TokenRefreshView):
    serializer_class = CustomTokenRefreshSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            access_token = response.data.get("access")
            if access_token:
                response.set_cookie(
                    "access_token",
                    access_token,
                    httponly=True,
                    secure=not settings.DEBUG,
                    samesite="Strict",
                    max_age=1800,
                    path="/",
                )
        return response


class CustomTokenObtainPairView(TokenObtainPairView):
    def post(self, request, *args, **kwargs):
        try:
            response = super().post(request, *args, **kwargs)
        except Exception as e:
            ActionLoggingService.log_failed_login(
                request.data.get('username') or 'unknown', request
            )
            raise e
        if response.status_code == 200:
            try:
                if response.data.get('access'):
                    response.set_cookie('access_token', response.data['access'], httponly=True, secure=not settings.DEBUG, samesite='Strict', max_age=1800, path='/')
                ActionLoggingService.log_successful_login(
                    request.data.get('username'), request
                )
            except Exception:
                pass
        return response


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = MeSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        user = request.user
        serializer = MeSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # Log visual preference updates in system log
        if "theme" in request.data:
            ActionLoggingService.log_action(
                user=user,
                action_type=ActionLog.Type.SETTINGS_CHANGE,
                description=f"Usuario {user.username} cambió su preferencia de tema a '{request.data['theme']}'.",
                request=request,
            )

        return Response(serializer.data)


class MyProfileView(APIView):
    """Returns the authenticated user's full profile: user data, linked employee, payrolls, advances, and payments."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .user_service import UserServiceExt
        return Response(UserServiceExt.get_my_profile_data(request.user))


class MyProfilePayrollPreviewView(APIView):
    """Allows an authenticated employee to view their own payroll details (excluding employer costs)."""

    permission_classes = [IsAuthenticated]

    def get(self, request, payroll_id):
        from rest_framework.exceptions import NotFound, PermissionDenied

        from hr.models import Payroll
        from hr.serializers import EmployeePayrollPreviewSerializer
        if not request.user.contact_id: raise PermissionDenied('User is not linked to an employee contact')
        try: p = Payroll.objects.select_related('employee', 'employee__contact').prefetch_related('items', 'items__concept').get(id=payroll_id, employee__contact_id=request.user.contact_id, status=Payroll.Status.POSTED)
        except Payroll.DoesNotExist: raise NotFound('Payroll not found')
        return Response(EmployeePayrollPreviewSerializer(p).data)


class ChangePasswordView(APIView):
    """Allows the authenticated user to change their own password."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        from rest_framework.exceptions import ValidationError

        from .user_service import UserServiceExt
        try: return Response(UserServiceExt.change_password_from_request(request))
        except ValidationError as e: return Response({'detail': str(e)}, status=400)


class ChangePinView(APIView):
    """Allows the authenticated user to change their own POS PIN."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        from rest_framework.exceptions import ValidationError

        from .user_service import UserServiceExt
        try: return Response(UserServiceExt.change_pin_from_request(request))
        except ValidationError as e: return Response({'detail': str(e)}, status=400)


class UserPreferenceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(CoreService.get_user_preferences(request.user))

    def patch(self, request):
        CoreService.set_user_preferences(request.user, request.data)
        return Response(request.data)


class UserViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    pagination_class = StandardResultsSetPagination
    queryset = User.objects.all()  # Base queryset includes archived for detail/update
    serializer_class = UserSerializer

    def get_queryset(self):
        # List view filters active by default; allow ?is_active=all/false
        if self.action == "list":
            is_active = self.request.query_params.get("is_active")
            if is_active == "all":
                return User.objects.all()
            elif is_active == "false":
                return User.objects.filter(is_active=False)
            return User.objects.filter(is_active=True)
        return super().get_queryset()

    def perform_create(self, serializer):
        from django.db import transaction

        from core.rbac.services import RoleService

        actor = self.request.user
        new_groups = list(serializer.validated_data.get("groups") or [])
        # C1: raises PermissionDenied BEFORE save if any group exceeds actor's perms
        RoleService.validate_new_user_groups(actor, new_groups)
        with transaction.atomic():
            instance = serializer.save()
            if new_groups:
                RoleService.audit_new_user_groups(instance, new_groups, actor, self.request)

    def perform_update(self, serializer):
        from core.rbac.services import RoleService
        instance = self.get_object()
        is_before = instance.is_active
        is_after = serializer.validated_data.get("is_active", is_before)
        if is_before and not is_after:
            from .services import UserService
            UserService.deactivate(user=instance, deactivated_by=self.request.user, request=self.request)
            return
        new_groups = serializer.validated_data.get("groups")
        before = set(instance.groups.values_list("name", flat=True)) if new_groups is not None else None
        sod_warnings: list = []
        if new_groups is not None:
            sod_warnings = RoleService.validate_role_assignment(self.request.user, instance, list(new_groups))
        super().perform_update(serializer)
        if new_groups is not None:
            after = set(instance.groups.values_list("name", flat=True))
            RoleService.log_user_roles_change(instance, before, after, self.request.user, self.request, sod_warnings=sod_warnings)

    def destroy(self, request, *args, **kwargs):
        # Archivo pattern: hard DELETE not allowed, use PATCH is_active=false to archive
        return Response(
            {"detail": "Hard delete not allowed for Users. Use PATCH is_active=false to archive."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    @action(detail=False, methods=["get"])
    def roles(self, request):
        from .permissions import Roles

        return Response(Roles.get_choices())


class GroupViewSet(viewsets.ModelViewSet):
    """
    Expose user groups (roles) with full CRUD.
    """

    queryset = Group.objects.select_related("profile").annotate(user_count=Count("user")).order_by("name")
    serializer_class = GroupSerializer
    pagination_class = None  # Master data
    action_permissions = {
        "role_composition": None,  # reviewed — GET uses view_group, PUT uses change_group
    }

    def get_queryset(self):
        qs = super().get_queryset()
        kind = self.request.query_params.get("kind")
        if kind:
            qs = qs.filter(profile__kind=kind)
        return qs

    def perform_update(self, serializer):
        GroupService.validate_mutable(serializer.instance, serializer.validated_data.get("name"))
        serializer.save()

    def perform_destroy(self, instance):
        GroupService.validate_mutable(instance)
        instance.delete()

    @action(detail=True, methods=["get", "put"], url_path="composition")
    def role_composition(self, request, pk=None):
        from rest_framework.exceptions import PermissionDenied

        from core.rbac.services import RoleService

        group = self.get_object()
        if request.method == "GET":
            if not request.user.has_perm("auth.view_group"):
                raise PermissionDenied()
            return Response(RoleService.get_composition(group))
        if not request.user.has_perm("auth.change_group"):
            raise PermissionDenied()
        sod = RoleService.apply_composition(group, request.data, request.user, request)
        return Response({"status": "ok", "sod_warnings": sod})


class CompanySettingsViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = CompanySettings.objects.all()
    serializer_class = CompanySettingsSerializer
    action_permissions = {
        # current: PUT/PATCH → change_* by method; GET is open to authenticated users
        "current": None,
    }

    @action(detail=False, methods=["get", "put", "patch"])
    def current(self, request):
        obj = CoreService.get_or_create_company_settings()

        if request.method == "GET":
            serializer = self.get_serializer(obj)
            return Response(serializer.data)

        serializer = self.get_serializer(
            obj, data=request.data, partial=(request.method == "PATCH")
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(
        detail=False,
        methods=["get"],
        url_path="branding",
        permission_classes=[],  # AllowAny — explicit empty list
    )
    def branding(self, request):
        """Public endpoint: returns only name, trade_name and logo for branding (login, 404, etc.)."""
        obj = CoreService.get_or_create_company_settings()
        serializer = PublicCompanyBrandingSerializer(obj)
        return Response(serializer.data)


class ActionLogViewSet(viewsets.ReadOnlyModelViewSet):
    pagination_class = StandardResultsSetPagination
    queryset = ActionLog.objects.all()
    serializer_class = ActionLogSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["user", "action_type"]


class GlobalAuditLogView(APIView):
    permission_classes = [require_perms("core.view_actionlog")]

    def get(self, request):
        from .services import CoreSelector
        limit = int(request.query_params.get('limit', 50))
        return Response(CoreSelector.get_global_audit_log(limit))


@api_view(["POST"])
def logout_view(request):
    """Clear the HttpOnly access_token cookie."""
    response = Response({"detail": "Sesión cerrada."})
    response.delete_cookie("access_token", path="/")
    return response


@api_view(["GET"])
def server_time(request):
    """Return current server date and time"""
    now = timezone.now()
    return Response(
        {
            "datetime": now.isoformat(),
            "date": now.date().isoformat(),
            "year": now.year,
            "month": now.month,
            "day": now.day,
            "timezone": str(timezone.get_current_timezone()),
        }
    )


@api_view(["GET"])
def system_status(request):
    """Return system information: version, git hash, and environment status"""
    from .services import CoreService
    return Response(CoreService.get_system_status())


@api_view(["GET"])
def entity_prefixes(request):
    """Return the canonical EntityPrefix enum as {name: prefix}."""
    from .prefix_registry import EntityPrefix
    return Response(EntityPrefix.as_dict())


@api_view(["GET"])
def entity_config(request):
    """Return all registered SearchableEntity configs with templates and prefixes."""
    from .registry import UniversalRegistry
    return Response(UniversalRegistry.all_entities_serializable())


class BackgroundJobViewSet(viewsets.ReadOnlyModelViewSet):
    pagination_class = StandardResultsSetPagination
    """
    Expose background jobs (read-only for users).
    Users can only see their own jobs, unless they are superusers.
    """
    serializer_class = BackgroundJobSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return CoreSelector.get_background_jobs_for_user(self.request.user)
