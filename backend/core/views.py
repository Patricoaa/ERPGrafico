from core.api.pagination import StandardResultsSetPagination
from django.conf import settings
from django.contrib.auth.models import Group
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from accounting.models import JournalEntry
from billing.models import Invoice
from contacts.models import Contact
from core.mixins import AuditHistoryMixin
from inventory.models import Product, StockMove
from production.models import WorkOrder
from purchasing.models import PurchaseOrder
from sales.models import SaleOrder
from treasury.models import TreasuryMovement

from .models import ActionLog, CompanySettings, User, UserPreference, BackgroundJob
from .serializers import (
    ActionLogSerializer,
    CompanySettingsSerializer,
    CustomTokenRefreshSerializer,
    GroupSerializer,
    HistoricalRecordSerializer,
    UserSerializer,
    BackgroundJobSerializer,
)
from .services import ActionLoggingService, UserService


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
        try: response = super().post(request, *args, **kwargs)
        except Exception as e:
            from core.models import User, ActionLog
            from core.action_logger import ActionLoggingService
            usr = request.data.get('username') or 'unknown'
            u = User.objects.filter(username=usr).first()
            ActionLoggingService.log_action(user=u, action_type=ActionLog.Type.SECURITY, description=f"Fallo login '{usr}'.", request=request, metadata={'error': str(e)})
            raise e
        if response.status_code == 200:
            try:
                if response.data.get('access'): response.set_cookie('access_token', response.data['access'], httponly=True, secure=not settings.DEBUG, samesite='Strict', max_age=1800, path='/')
                from core.models import User, ActionLog
                from core.action_logger import ActionLoggingService
                u = User.objects.filter(username=request.data.get('username')).first()
                if u: ActionLoggingService.log_action(user=u, action_type=ActionLog.Type.LOGIN, description=f'Login {u.username}', request=request)
            except Exception: pass
        return response


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        user = request.user
        serializer = UserSerializer(user, data=request.data, partial=True)
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
        from .user_service import UserServiceExt
        from rest_framework.exceptions import ValidationError
        try: return Response(UserServiceExt.change_password_from_request(request))
        except ValidationError as e: return Response({'detail': str(e)}, status=400)


class ChangePinView(APIView):
    """Allows the authenticated user to change their own POS PIN."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        from .user_service import UserServiceExt
        from rest_framework.exceptions import ValidationError
        try: return Response(UserServiceExt.change_pin_from_request(request))
        except ValidationError as e: return Response({'detail': str(e)}, status=400)


class UserPreferenceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        prefs = UserPreference.objects.filter(user=request.user)
        data = {p.key: p.value for p in prefs}
        return Response(data)

    def patch(self, request):
        data = request.data
        for key, value in data.items():
            UserPreference.objects.update_or_create(
                user=request.user, key=key, defaults={"value": value}
            )
        return Response(data)


class UserViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    pagination_class = StandardResultsSetPagination
    queryset = User.objects.all()
    serializer_class = UserSerializer

    def destroy(self, request, *args, **kwargs):
        """
        Prevent hard deletion of users to maintain traceability.
        Instead, the user is deactivated.
        """
        instance = self.get_object()
        UserService.deactivate(user=instance, deactivated_by=request.user, request=request)
        return Response(
            {
                "detail": "Los usuarios no pueden ser eliminados físicamente para mantener la trazabilidad. El usuario ha sido desactivado."
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"])
    def roles(self, request):
        from .permissions import Roles

        return Response(Roles.get_choices())


class GroupViewSet(viewsets.ModelViewSet):
    """
    Expose user groups (roles) with full CRUD.
    """

    queryset = Group.objects.all()
    serializer_class = GroupSerializer
    pagination_class = None  # Master data
    permission_classes = [IsAuthenticated]


class CompanySettingsViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = CompanySettings.objects.all()
    serializer_class = CompanySettingsSerializer

    @action(detail=False, methods=["get", "put", "patch"])
    def current(self, request):
        obj, _ = CompanySettings.objects.get_or_create(
            pk=1, defaults={"name": "Mi Empresa"}
        )

        if request.method == "GET":
            serializer = self.get_serializer(obj)
            return Response(serializer.data)

        # Check permission for PUT/PATCH manually if we're bypassing StandardizedModelPermissions
        # But actually, get_permissions is better
        serializer = self.get_serializer(
            obj, data=request.data, partial=(request.method == "PATCH")
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def get_permissions(self):
        """
        Allow any user to GET current company settings (needed for initial dashboard render/SSR).
        Maintain model permissions for other actions and methods.
        """
        if self.action == "current" and self.request.method == "GET":
            from rest_framework.permissions import AllowAny

            return [AllowAny()]
        return super().get_permissions()


class ActionLogViewSet(viewsets.ReadOnlyModelViewSet):
    pagination_class = StandardResultsSetPagination
    queryset = ActionLog.objects.all()
    serializer_class = ActionLogSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["user", "action_type"]


class GlobalAuditLogView(APIView):
    permission_classes = [IsAuthenticated]

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


class BackgroundJobViewSet(viewsets.ReadOnlyModelViewSet):
    pagination_class = StandardResultsSetPagination
    """
    Expose background jobs (read-only for users).
    Users can only see their own jobs, unless they are superusers.
    """
    serializer_class = BackgroundJobSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = BackgroundJob.objects.all()
        if not user.is_superuser:
            qs = qs.filter(user=user)
        return qs
