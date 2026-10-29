from django.apps import apps
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ImproperlyConfigured


class PermissionRegistry:
    """
    Central registry for system permissions.
    Allows apps to register their permissions programmatically.
    """

    _registry: dict[str, list[tuple[str, str]]] = {}

    @classmethod
    def register(cls, app_name: str, permissions: list[tuple[str, str]]) -> None:
        """Register a list of permissions for an app.

        Args:
            app_name: The name of the app (e.g., 'sales').
            permissions: List of tuples ``(codename, name)``.
        """
        if app_name not in cls._registry:
            cls._registry[app_name] = []

        existing_codes = {p[0] for p in cls._registry[app_name]}
        for codename, name in permissions:
            if codename not in existing_codes:
                cls._registry[app_name].append((codename, name))

    @classmethod
    def get_registered_permissions(cls) -> dict[str, list[tuple[str, str]]]:
        """Returns the entire registry."""
        return cls._registry

    @classmethod
    def sync_to_db(cls) -> int:
        """Sync registered permissions to the database.

        * If the app has **no models**, raises ``ImproperlyConfigured`` — the
          developer must add a ``managed=False`` permission-holder model.
        * If a ``Permission`` with the same ``(app_label, codename)`` already
          exists (e.g. from ``Meta.permissions``), it is **skipped** — no
          duplicate is created.

        Returns:
            Number of new ``Permission`` rows created.
        """
        created_count = 0

        for app_name, perms in cls._registry.items():
            try:
                app_config = apps.get_app_config(app_name)
            except LookupError:
                print(f"Warning: App {app_name} not found installed.")
                continue

            models = list(app_config.get_models())
            if not models:
                raise ImproperlyConfigured(
                    f"{app_name}: no tiene modelos. Usa un modelo de permisos "
                    f"(managed=False) en vez de PermissionRegistry para "
                    f"registrar permisos de esta app."
                )

            # Prefer a model whose name contains "settings"; fallback to first.
            ct_model = next(
                (m for m in models if "settings" in m._meta.model_name),
                models[0],
            )
            content_type = ContentType.objects.get_for_model(ct_model)

            for codename, name in perms:
                # Skip if any Permission already exists for this app + codename,
                # regardless of which content type it sits on.
                if Permission.objects.filter(
                    content_type__app_label=app_name,
                    codename=codename,
                ).exists():
                    continue

                Permission.objects.create(
                    content_type=content_type,
                    codename=codename,
                    name=name,
                )
                created_count += 1
                print(f"Created permission: {app_name}.{codename}")

        return created_count


# Pre-defined Standard Roles
class Roles:
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"  # Accountant / Sales Manager
    OPERATOR = "OPERATOR"
    READ_ONLY = "READ_ONLY"

    @classmethod
    def get_choices(cls):
        return [
            (cls.ADMIN, "Administrador"),
            (cls.MANAGER, "Gerente/Contador"),
            (cls.OPERATOR, "Operador"),
            (cls.READ_ONLY, "Lectura"),
        ]
