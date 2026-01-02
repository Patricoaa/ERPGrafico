
import os
import sys
import traceback

try:
    import django
    from django.core.management import call_command
    
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "erpgrafico.settings")
    
    with open('check_error.log', 'w') as f:
        try:
            django.setup()
            call_command('check')
            f.write("Check passed successfully.\n")
        except Exception:
            f.write(traceback.format_exc())
            print("Exception caught and written to log.")
except Exception:
    # If even imports fail
    with open('check_error.log', 'w') as f:
        f.write("SETUP FAILED:\n")
        f.write(traceback.format_exc())
