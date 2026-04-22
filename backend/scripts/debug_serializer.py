import os
import django
import sys

# Add project root to path
sys.path.append(os.getcwd())

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'erpgrafico.settings')
django.setup()

from hr.models import Payroll
from hr.serializers import EmployeePayrollPreviewSerializer

def test_serializer():
    payroll = Payroll.objects.filter(status=Payroll.Status.POSTED).first()
    if not payroll:
        print("No posted payroll found for testing")
        return
    
    try:
        data = EmployeePayrollPreviewSerializer(payroll).data
        print("Serializer data generated successfully")
        # print(data)
    except Exception as e:
        print(f"Serializer failed: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_serializer()
