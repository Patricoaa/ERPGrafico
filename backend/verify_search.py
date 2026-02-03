import os
import django
import sys

# Setup Django environment
sys.path.append(os.getcwd())
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from contacts.models import Contact
from django.test import RequestFactory
from contacts.views import ContactViewSet

from rest_framework.test import force_authenticate
from django.contrib.auth import get_user_model

def verification_test():
    User = get_user_model()
    # Get or create a superuser for testing
    user = User.objects.filter(is_superuser=True).first()
    if not user:
        user = User.objects.create_superuser('admin_test', 'admin@test.com', 'password')
        print("Created test superuser")

    print("Starting Contact Search Verification...")
    
    # Create a test contact
    # Use a unique RUT to avoid conflicts: 99.999.999-9
    test_rut = "99.999.999-9"
    test_name = "Test Search Contact"
    
    # Clean up any existing contact with this RUT
    Contact.objects.filter(tax_id=test_rut).delete()
    
    contact = Contact.objects.create(
        name=test_name,
        tax_id=test_rut,
        email="test@example.com"
    )
    
    # Reload to get the code
    contact.refresh_from_db()
    
    with open('verify_result.txt', 'w') as f:
        f.write("Starting Contact Search Verification...\n")
        f.write(f"Created test contact: {contact.name} (RUT: {contact.tax_id}, Code: {contact.code})\n")

        factory = RequestFactory()
        view = ContactViewSet.as_view({'get': 'list'})

        tests = [
            # Test 1: Search by formatted RUT
            {"search": "99.999.999-9", "desc": "Formatted RUT (exact)"},
            # Test 2: Search by unformatted RUT
            {"search": "999999999", "desc": "Unformatted RUT (no dots/dash)"},
            # Test 3: Search by mixed format (e.g. dots but no dash)
            {"search": "99.999.9999", "desc": "Mixed format"},
            # Test 4: Search by internal code
            {"search": contact.code, "desc": "Internal Code"},
            # Test 5: Search by name
            {"search": "Test Search", "desc": "Name partial match"}
        ]

        success = True
        for test in tests:
            request = factory.get('/api/contacts/', {'search': test['search']})
            force_authenticate(request, user=user)
            response = view(request)
            
            # Check if our contact is in the results
            found = False
            if response.status_code == 200:
                data = response.data
                if isinstance(data, dict):
                    results = data.get('results', [])
                elif isinstance(data, list):
                    results = data
                else:
                    results = []
                    
                found = any(c['id'] == contact.id for c in results)
            else:
                f.write(f"  Error: Status {response.status_code} - {response.data}\n")
            
            status = "PASSED" if found else "FAILED"
            f.write(f"Test '{test['desc']}' with query '{test['search']}': {status}\n")
            
            if not found:
                success = False

        if success:
            f.write("\nALL TESTS PASSED!\n")
        else:
            f.write("\nSOME TESTS FAILED.\n")

    # Cleanup
    contact.delete()
    print("Test contact deleted.")
    
    if success:
        print("\nALL TESTS PASSED!")
    else:
        print("\nSOME TESTS FAILED.")
        exit(1)

if __name__ == "__main__":
    verification_test()
