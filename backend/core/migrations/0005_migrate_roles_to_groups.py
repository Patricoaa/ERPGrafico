from django.db import migrations

def migrate_roles(apps, schema_editor):
    User = apps.get_model('core', 'User')
    Group = apps.get_model('auth', 'Group')
    
    # Define standard groups (must match names in sync_permissions)
    GROUPS = {
        'ADMIN': 'ADMIN',
        'MANAGER': 'MANAGER',
        'OPERATOR': 'OPERATOR',
    }
    
    # Create groups if they don't exist (though sync_permissions should have done it)
    admin_group, _ = Group.objects.get_or_create(name=GROUPS['ADMIN'])
    manager_group, _ = Group.objects.get_or_create(name=GROUPS['MANAGER'])
    operator_group, _ = Group.objects.get_or_create(name=GROUPS['OPERATOR'])
    
    # Iterate users and assign groups
    for user in User.objects.all():
        save_needed = False
        if user.role == 'ADMIN':
            if not user.groups.filter(name=GROUPS['ADMIN']).exists():
                user.groups.add(admin_group)
                save_needed = True
        elif user.role == 'ACCOUNTANT':
            if not user.groups.filter(name=GROUPS['MANAGER']).exists():
                user.groups.add(manager_group)
                save_needed = True
        elif user.role == 'OPERATOR':
             if not user.groups.filter(name=GROUPS['OPERATOR']).exists():
                user.groups.add(operator_group)
                save_needed = True
        
        if save_needed:
            print(f"Migrated user {user.username} with role {user.role}")

def reverse_migrate(apps, schema_editor):
    # We don't want to remove groups blindly as they might have been added manually
    pass

class Migration(migrations.Migration):

    dependencies = [
        ('core', '0004_attachment'),
    ]

    operations = [
        migrations.RunPython(migrate_roles, reverse_migrate),
    ]
