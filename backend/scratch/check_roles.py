import os

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from contacts.models import Contact

print("Checking contacts...")
for c in Contact.objects.all():
    print(f"Contact ID: {c.id}, Name: {c.name}")
    try:
        emp = c.employees.exists()
    except Exception as e:
        emp = f"Error: {e}"

    try:
        usr = hasattr(c, "system_user")
    except Exception as e:
        usr = f"Error: {e}"

    print(f"  - Has employee: {emp}")
    print(f"  - Has user: {usr}")
    print(f"  - Active roles: {c.active_roles}")
    print("---")
