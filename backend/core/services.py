from core.models import User, ActionLog
from django.conf import settings

class CoreService:
    @staticmethod
    def get_or_create_company_settings():
        from .models import CompanySettings

        obj, _ = CompanySettings.objects.get_or_create(pk=1, defaults={"name": "Mi Empresa"})
        return obj

    @staticmethod
    def get_user_preferences(user):
        from .models import UserPreference

        prefs = UserPreference.objects.filter(user=user)
        return {p.key: p.value for p in prefs}

    @staticmethod
    def set_user_preferences(user, data):
        from .models import UserPreference

        for key, value in data.items():
            UserPreference.objects.update_or_create(
                user=user, key=key, defaults={"value": value}
            )

    @staticmethod
    def get_system_status():
        from django.utils import timezone
        from django.db import connections
        from django.db.utils import OperationalError
        db_conn = True
        try: connections['default'].cursor()
        except OperationalError: db_conn = False
        return {
            'version': getattr(settings, 'APP_VERSION', '0.0.0'),
            'git_hash': getattr(settings, 'GIT_HASH', 'unknown'),
            'environment': 'production' if not settings.DEBUG else 'development',
            'database_connected': db_conn,
            'server_time': timezone.now().isoformat()
        }

class CoreSelector:
    @staticmethod
    def get_background_jobs_for_user(user):
        from .models import BackgroundJob

        qs = BackgroundJob.objects.all()
        if not user.is_superuser:
            qs = qs.filter(user=user)
        return qs

    @staticmethod
    def get_global_audit_log(limit):
        from sales.models import SaleOrder
        from purchasing.models import PurchaseOrder
        from contacts.models import Contact
        from billing.models import Invoice
        from treasury.models import TreasuryMovement
        from production.models import WorkOrder
        from inventory.models import StockMove, Product
        from accounting.models import JournalEntry
        from .serializers import ActionLogSerializer, HistoricalRecordSerializer
        
        logs = ActionLogSerializer(ActionLog.objects.all()[:limit], many=True).data
        for l in logs: l.update({'source': 'action_log', 'entity_type': 'system', 'date': l['timestamp'], 'type_label': l['action_type_display']})
        
        models = [(Product, 'product', 'Producto'), (SaleOrder, 'sale_order', 'Nota de Venta'), (PurchaseOrder, 'purchase_order', 'Orden de Compra'), (Contact, 'contact', 'Contacto'), (Invoice, 'invoice', 'Factura'), (TreasuryMovement, 'treasury_movement', 'Movimiento de Tesorería'), (WorkOrder, 'work_order', 'Orden de Trabajo'), (StockMove, 'stock_move', 'Movimiento Stock'), (JournalEntry, 'journal_entry', 'Asiento Contable')]
        
        all_hist = []
        for m, t_slug, t_lbl in models:
            if hasattr(m, 'history'):
                for r in HistoricalRecordSerializer(m.history.all()[:limit], many=True).data:
                    verb = 'creó' if r['history_type'] == '+' else 'editó' if r['history_type'] == '~' else 'eliminó'
                    obj_name = str(next((r.get(f) for f in ['number', 'name', 'internal_code', 'display_id', 'id'] if r.get(f)), ''))
                    r.update({'source': 'history', 'entity_type': t_slug, 'entity_label': t_lbl, 'date': r['history_date'], 'description': f'{verb.capitalize()} {t_lbl.lower()} {obj_name}'.strip(), 'user_name': r['history_user_username']})
                    all_hist.append(r)
        
        combined = logs + all_hist
        combined.sort(key=lambda x: x['date'], reverse=True)
        return combined[:limit]
