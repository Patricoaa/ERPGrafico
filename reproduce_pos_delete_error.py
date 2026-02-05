
import os
import django
import sys
from pathlib import Path

# Setup Path
BASE_DIR = Path(__file__).resolve().parent
sys.path.append(str(BASE_DIR / 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

try:
    django.setup()
except Exception as e:
    print(f"Django setup failed: {e}")
    sys.exit(1)

from treasury.models import POSTerminal, POSSession
from django.db.models.deletion import ProtectedError
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory, force_authenticate
from treasury.views import POSTerminalViewSet

User = get_user_model()

def reproduce():
    # 1. Create a terminal
    terminal = POSTerminal.objects.create(
        name="Reproduction Terminal",
        code="REPRO_999",
        is_active=True
    )
    print(f"Created terminal: {terminal}")

    # 2. Create a session for this terminal
    user = User.objects.filter(is_superuser=True).first() or User.objects.first()
    session = POSSession.objects.create(
        terminal=terminal,
        user=user,
        opening_balance=1000,
        status='CLOSED'
    )
    print(f"Created session: {session} for terminal")

    # 3. Try to delete the terminal via API
    print("Attempting to delete terminal via API...")
    factory = APIRequestFactory()
    view = POSTerminalViewSet.as_view({'delete': 'destroy'})
    request = factory.delete(f'/api/treasury/pos-terminals/{terminal.id}/')
    force_authenticate(request, user=user)
    
    response = view(request, pk=terminal.id)
    
    print(f"API Response Status: {response.status_code}")
    print(f"API Response Data: {response.data}")
    
    if response.status_code == 400 and "error" in response.data:
        print("SUCCESS: Received expected error message from API!")
    else:
        print("FAILURE: Did not receive expected error format")

    # 4. Try to delete a terminal WITHOUT sessions
    terminal_clean = POSTerminal.objects.create(name="Clean Terminal", code="CLEAN_999")
    request_clean = factory.delete(f'/api/treasury/pos-terminals/{terminal_clean.id}/')
    force_authenticate(request_clean, user=user)
    response_clean = view(request_clean, pk=terminal_clean.id)
    print(f"Clean Delete Response Status: {response_clean.status_code}")
    if response_clean.status_code == 204:
        print("SUCCESS: Clean terminal deleted via API!")
    
    # Cleanup repro data
    session.delete()
    terminal.delete()
    print("Cleanup complete.")

if __name__ == "__main__":
    reproduce()
