from django.apps import apps
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.conf import settings

class PermissionRegistry:
    """
    Central registry for system permissions.
    Allows apps to register their permissions programmatically.
    """
    _registry = {}

    @classmethod
    def register(cls, app_name, permissions):
        """
        Register a list of permissions for an app.
        
        Args:
            app_name (str): The name of the app (e.g., 'sales')
            permissions (list): List of tuples (codename, name)
                                e.g., [('view_dashboard', 'Can view dashboard')]
        """
        if app_name not in cls._registry:
            cls._registry[app_name] = []
        
        # Avoid duplicates
        existing_codes = {p[0] for p in cls._registry[app_name]}
        for codename, name in permissions:
            if codename not in existing_codes:
                cls._registry[app_name].append((codename, name))

    @classmethod
    def get_registered_permissions(cls):
        """Returns the entire registry."""
        return cls._registry

    @classmethod
    def sync_to_db(cls):
        """
        Syncs registered permissions to the database.
        Should be called via management command.
        """
        created_count = 0
        for app_name, perms in cls._registry.items():
            # We associate these permissions with a dummy ContentType for the app specific configuration
            # Or we can see if there is a generic model. 
            # For now, let's look for a 'Settings' model in the app, or default to User if none found,
            # but ideally we want "Global" permissions not tied to a specific model instance.
            # Django requires a ContentType. We will use the app's 'Config' or a placeholder.
            
            # Strategy: Use ContentType of a "Settings" model if exists, else first model found, else User.
            try:
                app_config = apps.get_app_config(app_name)
                models = list(app_config.get_models())
                if models:
                    # Prefer a settings model
                    ct_model = next((m for m in models if 'settings' in m._meta.model_name), models[0])
                else:
                    from django.contrib.auth import get_user_model
                    ct_model = get_user_model()
                
                content_type = ContentType.objects.get_for_model(ct_model)
                
                for codename, name in perms:
                    if not Permission.objects.filter(content_type=content_type, codename=codename).exists():
                        Permission.objects.create(
                            content_type=content_type,
                            codename=codename,
                            name=name
                        )
                        created_count += 1
                        print(f"Created permission: {app_name}.{codename}")
                        
            except LookupError:
                print(f"Warning: App {app_name} not found installed.")
                continue

        return created_count

# Pre-defined Standard Roles
class Roles:
    ADMIN = 'ADMIN'
    MANAGER = 'MANAGER' # Accountant / Sales Manager
    OPERATOR = 'OPERATOR'
    READ_ONLY = 'READ_ONLY'

    @classmethod
    def get_choices(cls):
        return [
            (cls.ADMIN, 'Administrador'),
            (cls.MANAGER, 'Gerente/Contador'),
            (cls.OPERATOR, 'Operador'),
            (cls.READ_ONLY, 'Lectura'),
        ]
