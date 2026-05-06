from rest_framework import viewsets, status
from core.mixins import BulkImportMixin, AuditHistoryMixin
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenRefreshView, TokenObtainPairView
from django.contrib.auth.models import Group
from .models import User, CompanySettings, ActionLog, Attachment
from .serializers import (
    UserSerializer, CompanySettingsSerializer, CustomTokenRefreshSerializer,
    ActionLogSerializer, HistoricalRecordSerializer, GroupSerializer
)
from .services import ActionLoggingService
from django.utils import timezone
from django.contrib.auth.hashers import make_password
from inventory.models import Product, StockMove
from sales.models import SaleOrder
from purchasing.models import PurchaseOrder
from contacts.models import Contact
from billing.models import Invoice
from treasury.models import TreasuryMovement
from production.models import WorkOrder
from accounting.models import JournalEntry

class CustomTokenRefreshView(TokenRefreshView):
    serializer_class = CustomTokenRefreshSerializer

class CustomTokenObtainPairView(TokenObtainPairView):
    def post(self, request, *args, **kwargs):
        try:
            response = super().post(request, *args, **kwargs)
        except Exception as e:
            # Catch login failures (e.g. invalid credentials)
            # Log as Security Incident
            username = request.data.get('username') or "unknown"
            
            # We try to get the user object if possible to link it, even if auth failed
            user_obj = User.objects.filter(username=username).first()
            
            ActionLoggingService.log_action(
                user=user_obj, # Can be None
                action_type=ActionLog.Type.SECURITY,
                description=f"Intento de inicio de sesión fallido para usuario '{username}'.",
                request=request,
                metadata={'error': str(e)}
            )
            # Re-raise exception so normal error response is sent to client
            raise e
        
        if response.status_code == 200:
            try:
                # User is technically authenticated if we got 200
                username = request.data.get('username')
                if username:
                    user = User.objects.filter(username=username).first()
                    if user:
                        ActionLoggingService.log_action(
                            user=user,
                            action_type=ActionLog.Type.LOGIN,
                            description=f"Usuario {user.username} ha iniciado sesión.",
                            request=request
                        )
            except Exception as e:
                # Don't fail login if logging fails
                print(f"Login audit log error: {e}")
                
        return response

class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


class MyProfileView(APIView):
    """Returns the authenticated user's full profile: user data, linked employee, payrolls, advances, and payments."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from hr.models import Employee, Payroll, SalaryAdvance, PayrollPayment
        from hr.serializers import (
            EmployeeSerializer, PayrollListSerializer, SalaryAdvanceSerializer, 
            PayrollPaymentSerializer, ContactMiniSerializer
        )

        user = request.user
        user_data = UserSerializer(user).data

        employee_data = None
        contact_detail = None
        payrolls_data = []
        advances_data = []
        payments_data = []

        # Resolve User → Contact → Employee
        if user.contact:
            contact_detail = ContactMiniSerializer(user.contact).data
            employee = Employee.objects.filter(contact=user.contact).select_related('contact', 'afp').first()
            if employee:
                employee_data = EmployeeSerializer(employee).data

                # Payrolls (only POSTED, ordered by period)
                payrolls = Payroll.objects.filter(
                    employee=employee, status=Payroll.Status.POSTED
                ).select_related(
                    'employee', 'employee__contact', 'journal_entry', 'previred_journal_entry'
                ).prefetch_related('items', 'items__concept', 'advances', 'payments').order_by('-period_year', '-period_month')
                payrolls_data = PayrollListSerializer(payrolls, many=True).data

                # Advances
                advances = SalaryAdvance.objects.filter(
                    employee=employee
                ).select_related('employee', 'employee__contact', 'payroll').order_by('-date')
                advances_data = SalaryAdvanceSerializer(advances, many=True).data

                # Payroll Payments
                payments = PayrollPayment.objects.filter(
                    payroll__employee=employee
                ).select_related('payroll', 'payroll__employee', 'payroll__employee__contact').order_by('-date')
                payments_data = PayrollPaymentSerializer(payments, many=True).data

        return Response({
            'user': user_data,
            'contact_detail': contact_detail,
            'employee': employee_data,
            'payrolls': payrolls_data,
            'advances': advances_data,
            'payments': payments_data,
        })


class MyProfilePayrollPreviewView(APIView):
    """Allows an authenticated employee to view their own payroll details (excluding employer costs)."""
    permission_classes = [IsAuthenticated]

    def get(self, request, payroll_id):
        from hr.models import Payroll
        from hr.serializers import EmployeePayrollPreviewSerializer
        from rest_framework.exceptions import PermissionDenied, NotFound

        user = request.user
        if not user.contact_id:
            raise PermissionDenied("User is not linked to an employee contact")

        try:
            payroll = Payroll.objects.select_related(
                'employee', 'employee__contact'
            ).prefetch_related(
                'items', 'items__concept'
            ).get(
                id=payroll_id,
                employee__contact_id=user.contact_id,
                status=Payroll.Status.POSTED
            )
        except Payroll.DoesNotExist:
            raise NotFound("Payroll not found or not accessible")

        return Response(EmployeePayrollPreviewSerializer(payroll).data)


class ChangePasswordView(APIView):
    """Allows the authenticated user to change their own password."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        current_password = request.data.get('current_password', '')
        new_password = request.data.get('new_password', '')

        if not current_password or not new_password:
            return Response(
                {'detail': 'Debe proporcionar la contraseña actual y la nueva contraseña.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not user.check_password(current_password):
            return Response(
                {'detail': 'La contraseña actual es incorrecta.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if len(new_password) < 6:
            return Response(
                {'detail': 'La nueva contraseña debe tener al menos 6 caracteres.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user.set_password(new_password)
        user.save()

        ActionLoggingService.log_action(
            user=user,
            action_type=ActionLog.Type.SECURITY,
            description=f"Usuario {user.username} cambió su contraseña.",
            request=request
        )

        return Response({'detail': 'Contraseña actualizada exitosamente.'})


class ChangePinView(APIView):
    """Allows the authenticated user to change their own POS PIN."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        current_password = request.data.get('current_password', '')
        new_pin = request.data.get('new_pin', '')

        if not current_password or not new_pin:
            return Response(
                {'detail': 'Debe proporcionar la contraseña actual y el nuevo PIN.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not user.check_password(current_password):
            return Response(
                {'detail': 'La contraseña actual es incorrecta.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate numericality and length for PIN (max 4 digits)
        if not new_pin.isdigit() or not (len(new_pin) <= 4):
            return Response(
                {'detail': 'El PIN debe ser numérico y tener un máximo de 4 dígitos.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # We store the PIN securely using make_password but in the pos_pin field
        user.pos_pin = make_password(new_pin)
        user.save()

        ActionLoggingService.log_action(
            user=user,
            action_type=ActionLog.Type.SECURITY,
            description=f"Usuario {user.username} cambió su PIN de POS.",
            request=request
        )

        return Response({'detail': 'PIN de POS actualizado exitosamente.'})


class UserViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = User.objects.all()
    serializer_class = UserSerializer

    def destroy(self, request, *args, **kwargs):
        """
        Prevent hard deletion of users to maintain traceability.
        Instead, the user is deactivated.
        """
        instance = self.get_object()
        instance.is_active = False
        instance.save()
        
        ActionLoggingService.log_action(
            user=request.user,
            action_type=ActionLog.Type.SECURITY,
            description=f"Usuario {instance.username} fue desactivado (Baja de sistema) en lugar de eliminado para trazabilidad.",
            request=request,
            metadata={'target_user_id': instance.id, 'target_username': instance.username}
        )
        
        return Response(
            {"detail": "Los usuarios no pueden ser eliminados físicamente para mantener la trazabilidad. El usuario ha sido desactivado."},
            status=status.HTTP_200_OK
        )

    @action(detail=False, methods=['get'])
    def roles(self, request):
        from .permissions import Roles
        return Response(Roles.get_choices())

class GroupViewSet(viewsets.ModelViewSet):
    """
    Expose user groups (roles) with full CRUD.
    """
    queryset = Group.objects.all()
    serializer_class = GroupSerializer
    permission_classes = [IsAuthenticated]

class CompanySettingsViewSet(viewsets.ModelViewSet, AuditHistoryMixin):
    queryset = CompanySettings.objects.all()
    serializer_class = CompanySettingsSerializer

    @action(detail=False, methods=['get', 'put', 'patch'])
    def current(self, request):
        obj = CompanySettings.get_solo()
        if not obj:
            if request.method == 'GET':
                 return Response({"detail": "Settings not found"}, status=status.HTTP_404_NOT_FOUND)
            # For put/patch, create if not exist
            obj = CompanySettings.objects.create(name="Mi Empresa")
        
        if request.method == 'GET':
            serializer = self.get_serializer(obj)
            return Response(serializer.data)
        
        # Check permission for PUT/PATCH manually if we're bypassing StandardizedModelPermissions
        # But actually, get_permissions is better
        serializer = self.get_serializer(obj, data=request.data, partial=(request.method == 'PATCH'))
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def get_permissions(self):
        """
        Allow any user to GET current company settings (needed for initial dashboard render/SSR).
        Maintain model permissions for other actions and methods.
        """
        if self.action == 'current' and self.request.method == 'GET':
            from rest_framework.permissions import AllowAny
            return [AllowAny()]
        return super().get_permissions()

class ActionLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ActionLog.objects.all()
    serializer_class = ActionLogSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['user', 'action_type']

class GlobalAuditLogView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        limit = int(request.query_params.get('limit', 50))
        
        # 1. Action Logs
        action_logs = ActionLog.objects.all()[:limit]
        action_logs_data = ActionLogSerializer(action_logs, many=True).data
        for log in action_logs_data:
            log['source'] = 'action_log'
            log['entity_type'] = 'system'
            log['date'] = log['timestamp']
            # Map action_type to history_type style (+, ~, -) or keep as is
            log['type_label'] = log['action_type_display']

        # 2. Historical Records from Models
        models_to_track = [
            (Product, 'product', 'Producto'),
            (SaleOrder, 'sale_order', 'Nota de Venta'),
            (PurchaseOrder, 'purchase_order', 'Orden de Compra'),
            (Contact, 'contact', 'Contacto'),
            (Invoice, 'invoice', 'Factura'),
            (TreasuryMovement, 'treasury_movement', 'Movimiento de Tesorería'),
            (WorkOrder, 'work_order', 'Orden de Trabajo'),
            (StockMove, 'stock_move', 'Movimiento Stock'),
            (JournalEntry, 'journal_entry', 'Asiento Contable'),
        ]

        all_history = []
        for model, type_slug, type_label in models_to_track:
            if hasattr(model, 'history'):
                history_records = model.history.all()[:limit]
                serialized = HistoricalRecordSerializer(history_records, many=True).data
                for rec in serialized:
                    rec['source'] = 'history'
                    rec['entity_type'] = type_slug
                    rec['entity_label'] = type_label
                    rec['date'] = rec['history_date']
                    
                    # Create a description
                    h_type = rec['history_type']
                    action_verb = "creó" if h_type == '+' else "editó" if h_type == '~' else "eliminó"
                    
                    # Try to get a display name for the object
                    # We need to find a field that represents the object name/number
                    obj_name = ""
                    for field in ['number', 'name', 'internal_code', 'display_id', 'id']:
                        if rec.get(field):
                            obj_name = str(rec.get(field))
                            break
                    
                    rec['description'] = f"{action_verb.capitalize()} {type_label.lower()} {obj_name}".strip()
                    rec['user_name'] = rec['history_user_username']
                    all_history.append(rec)

        # Combine and Sort
        combined = action_logs_data + all_history
        combined.sort(key=lambda x: x['date'], reverse=True)
        
        return Response(combined[:limit])

@api_view(['GET'])
def server_time(request):
    """Return current server date and time"""
    now = timezone.now()
    return Response({
        'datetime': now.isoformat(),
        'date': now.date().isoformat(),
        'year': now.year,
        'month': now.month,
        'day': now.day,
        'timezone': str(timezone.get_current_timezone())
    })

@api_view(['GET'])
def system_status(request):
    """Return system information: version, git hash, and environment status"""
    from django.conf import settings
    from django.db import connections
    from django.db.utils import OperationalError
    
    # Check DB connection
    db_conn = True
    try:
        connections['default'].cursor()
    except OperationalError:
        db_conn = False

    return Response({
        'version': getattr(settings, 'APP_VERSION', '0.0.0'),
        'git_hash': getattr(settings, 'GIT_HASH', 'unknown'),
        'environment': 'production' if not settings.DEBUG else 'development',
        'database_connected': db_conn,
        'server_time': timezone.now().isoformat(),
    })
