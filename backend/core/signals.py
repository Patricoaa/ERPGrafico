from django.contrib.auth.models import Group
from django.db.models.signals import post_save
from django.dispatch import receiver

from contacts.models import Contact

from .models import CompanySettings


def _get_system_role_names() -> frozenset[str]:
    """Return the set of names for system roles (seeded roles with is_system=True)."""
    try:
        from core.rbac.seed import SEEDED_ROLES
        return frozenset(r["name"] for r in SEEDED_ROLES.values() if r["is_system"])
    except Exception:
        return frozenset()


_SYSTEM_ROLE_NAMES: frozenset[str] = _get_system_role_names()


@receiver(post_save, sender=Group)
def create_group_profile_on_group_create(sender, instance, created, **kwargs):
    """Auto-create a GroupProfile whenever a Group is created outside the API.

    System-role names get kind=ROLE + is_system=True; all others get kind=TEAM.
    """
    if created:
        from core.models import GroupProfile
        is_system_role = instance.name in _SYSTEM_ROLE_NAMES
        GroupProfile.objects.get_or_create(
            group=instance,
            defaults={
                "kind": GroupProfile.ROLE if is_system_role else GroupProfile.TEAM,
                "is_system": is_system_role,
            },
        )


@receiver(post_save, sender=Contact)
def sync_contact_to_company_settings(sender, instance, **kwargs):
    """
    Update CompanySettings if the modified contact is linked to it.
    Avoids infinite loops by checking values before saving.
    """
    settings = CompanySettings.objects.filter(contact=instance).first()
    if settings:
        updated = False
        if settings.name != instance.name:
            settings.name = instance.name
            updated = True
        if settings.tax_id != instance.tax_id:
            settings.tax_id = instance.tax_id
            updated = True
        if settings.email != instance.email:
            settings.email = instance.email
            updated = True
        if settings.phone != instance.phone:
            settings.phone = instance.phone
            updated = True
        if settings.address != instance.address:
            settings.address = instance.address
            updated = True

        if updated:
            # We use save() but carefully.
            # The CompanySettings.save() will trigger another Contact.save(),
            # but since we check values here, it should terminate.
            settings.save()


from django.core.cache import cache
from django.db.models.signals import post_migrate


@receiver(post_migrate)
def clear_schema_cache_on_migrate(sender, **kwargs):
    """
    Regla P-06: Limpia todas las cachés de schemas (schema:*) luego de una migración,
    ya que los modelos, metadatos y permisos pueden haber cambiado drásticamente.
    """
    try:
        # Backends django-redis soportan delete_pattern con wildcard
        cache.delete_pattern("schema:*")
    except AttributeError:
        # Fallback para locmem o memcached que no soportan delete_pattern
        try:
            cache.clear()
        except Exception:
            pass
    except Exception:
        # Redis no disponible (ej. entorno de test local sin Docker).
        # Registrar en silencio para no bloquear las migraciones.
        pass


@receiver(post_migrate)
def sync_registered_permissions(sender, **kwargs):
    """
    Sincroniza (solo aditivamente) los permisos de PermissionRegistry tras
    `migrate` y se los otorga al rol ADMIN. Se ejecuta una vez por migrate
    (solo para la app "core"). Nunca quita permisos de ningún grupo.
    """
    if getattr(sender, "name", None) != "core":
        return

    from .permissions import PermissionRegistry

    PermissionRegistry.sync_to_db()

    from core.rbac.services import RoleService
    # materialize_all() covers sysadmin via its ALL_MODULE_BUNDLES + ALL_SENSITIVE_BUNDLES,
    # keeping post_migrate and sync_permissions consistent (I10).
    # NOTE: on a fresh DB, GroupProfile for seeded roles does not exist yet —
    # run `manage.py sync_permissions` after the initial `migrate` to bootstrap roles.
    count = RoleService.materialize_all()
    if count == 0:
        import warnings
        warnings.warn(
            "post_migrate: materialize_all() found no ROLE groups. "
            "Run `manage.py sync_permissions` to create seeded roles.",
            stacklevel=2,
        )
