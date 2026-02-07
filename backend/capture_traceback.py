
import os
import django
import traceback

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.core.management import execute_from_command_line

with open('full_traceback.txt', 'w') as f:
    try:
        execute_from_command_line(['manage.py', 'migrate', 'treasury', '0033'])
    except Exception:
        traceback.print_exc(file=f)
        print("Traceback captured to full_traceback.txt")
