from django.apps import AppConfig


class WorkflowConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'workflow'

    def ready(self):
        # Register signals
        import workflow.signals

        try:
            from core.permissions import PermissionRegistry
            PermissionRegistry.register('workflow', [
                ('view_dashboard_workflow', 'Can view workflow dashboard'),
            ])
        except ImportError:
            pass

        # workflow.Task NO se registra en UniversalRegistry (T-102, Camino B).
        # TaskInbox vive en el sidebar global del DashboardShell — no existe como
        # página de ruta propia. El deeplink ?selected=<id> requeriría montar el
        # sidebar, que además hace doble salto según task_type (HUB, WorkOrder, F29...).
        # Si en el futuro se crea /workflow/tasks/page.tsx como vista dedicada,
        # agregar aquí el registro con list_url='/workflow/tasks'.
