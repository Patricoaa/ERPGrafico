from django.apps import AppConfig


class ProductionConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "production"

    def ready(self):
        try:
            from core.permissions import PermissionRegistry

            PermissionRegistry.register(
                "production",
                [
                    ("view_dashboard_production", "Can view production dashboard"),
                ],
            )
        except ImportError:
            pass

        try:
            from core.prefix_registry import EntityPrefix
            from core.registry import SearchableEntity, UniversalRegistry
            from production.models import BillOfMaterials, WorkOrder

            UniversalRegistry.register(
                SearchableEntity(
                    model=WorkOrder,
                    label="production.workorder",
                    title_singular="Orden de Trabajo",
                    title_plural="Ordenes de Trabajo",
                    icon="wrench",
                    search_fields=("number", "description", "related_contact__name"),
                    short_display_template=f"{EntityPrefix.WORK_ORDER}-{{number}}",
                    display_template=f"{EntityPrefix.WORK_ORDER}-{{number}}",
                    subtitle_template="{description}",
                    extra_info_template="{status}",
                    list_url="/production/orders",
                    detail_url_pattern="/production/orders/{id}",
                    permission="production.view_workorder",
                )
            )
            UniversalRegistry.register(
                SearchableEntity(
                    model=BillOfMaterials,
                    label="production.bom",
                    title_singular="Lista de Materiales",
                    title_plural="Listas de Materiales",
                    icon="clipboard-list",
                    search_fields=("name", "product__name"),
                    short_display_template=f"{EntityPrefix.BOM}-{{id}}",
                    display_template="{name}",
                    subtitle_template="{product.name}",
                    extra_info_template="{status}",
                    list_url="/production/boms",
                    detail_url_pattern="/production/boms/{id}",
                    permission="production.view_billofmaterials",
                )
            )
        except Exception:
            pass
