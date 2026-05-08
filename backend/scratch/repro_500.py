import os
import django
import sys

# Setup Django
sys.path.append('/home/pato/Nextcloud/Pato/Aplicaciones/ERPGrafico/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from accounting.models import Account
from accounting.serializers import AccountSerializer

try:
    accounts = Account.objects.all()
    for account in accounts:
        print(f"Serializing account {account.code} - {account.name}")
        serializer = AccountSerializer(account)
        _ = serializer.data
    print("All accounts serialized successfully in script.")
except Exception as e:
    print(f"Error during serialization: {e}")
    import traceback
    traceback.print_exc()
