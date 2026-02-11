"""
Script to assign accounting period permissions to admin users.
Run with: docker compose exec backend python manage.py shell < assign_period_permissions.py
"""

from django.contrib.auth.models import Permission
from core.models import User

# Get the permissions
try:
    close_perm = Permission.objects.get(codename='can_close_accounting_period')
    reopen_perm = Permission.objects.get(codename='can_reopen_accounting_period')
    
    # Assign to all superusers
    superusers = User.objects.filter(is_superuser=True)
    
    for user in superusers:
        user.user_permissions.add(close_perm, reopen_perm)
        print(f"✓ Permisos asignados a {user.username}")
    
    print(f"\n✓ Total: {superusers.count()} usuarios con permisos de periodos contables")
    
except Permission.DoesNotExist:
    print("⚠ Los permisos aún no existen. Ejecuta las migraciones primero:")
    print("  docker compose exec backend python manage.py migrate")
