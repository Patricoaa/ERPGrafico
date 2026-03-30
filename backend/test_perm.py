import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth.models import Permission
print("Permissions matching approve_credit:")
for p in Permission.objects.filter(codename__icontains='approve'):
    print(f"{p.content_type.app_label}.{p.codename}")
