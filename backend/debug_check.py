
import os
import sys
import django
from django.core.management import call_command

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "erpgrafico.settings")
django.setup()

try:
    call_command('check')
except Exception as e:
    print(e)
