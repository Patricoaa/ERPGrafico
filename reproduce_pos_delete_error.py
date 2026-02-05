
import os
import django
import sys

# Setup Django
sys.path.append(os.path.join(os.getcwd(), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from treasury.models import POSTerminal, POSSession
from django.db.models.deletion import ProtectedError
from django.contrib.auth import get_user_model

User = get_user_model()

def reproduce():
    # 1. Create a terminal
    terminal = POSTerminal.objects.create(
        name="Reproduction Terminal",
        code="REPRO_001",
        is_active=True
    )
    print(f"Created terminal: {terminal}")

    # 2. Create a session for this terminal
    user = User.objects.first()
    session = POSSession.objects.create(
        terminal=terminal,
        user=user,
        opening_balance=1000,
        status='CLOSED'
    )
    print(f"Created session: {session} for terminal")

    # 3. Try to delete the terminal
    print("Attempting to delete terminal...")
    try:
        terminal.delete()
        print("Terminal deleted successfully (unexpected!)")
    except ProtectedError as e:
        print(f"Caught ProtectedError as expected: {e}")
    except Exception as e:
        print(f"Caught unexpected error type {type(e)}: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    reproduce()
