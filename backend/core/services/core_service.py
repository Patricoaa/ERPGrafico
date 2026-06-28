from django.conf import settings


class CoreService:
    @staticmethod
    def get_or_create_company_settings():
        from core.models import CompanySettings

        obj, _ = CompanySettings.objects.get_or_create(pk=1, defaults={"name": "Mi Empresa"})
        return obj

    @staticmethod
    def get_user_preferences(user):
        from core.models import UserPreference

        prefs = UserPreference.objects.filter(user=user)
        return {p.key: p.value for p in prefs}

    @staticmethod
    def set_user_preferences(user, data):
        from core.models import UserPreference

        for key, value in data.items():
            UserPreference.objects.update_or_create(
                user=user, key=key, defaults={"value": value}
            )

    @staticmethod
    def get_system_status():
        from django.db import connections
        from django.db.utils import OperationalError
        from django.utils import timezone

        db_conn = True
        try:
            connections["default"].cursor()
        except OperationalError:
            db_conn = False
        return {
            "version": getattr(settings, "APP_VERSION", "0.0.0"),
            "git_hash": getattr(settings, "GIT_HASH", "unknown"),
            "environment": "production" if not settings.DEBUG else "development",
            "database_connected": db_conn,
            "server_time": timezone.now().isoformat(),
        }
