import os
import sys
import django
from decimal import Decimal
from datetime import date

# Setup Django environment
sys.path.append('c:\\Users\\patox\\Nextcloud\\Pato\\Aplicaciones\\ERPGrafico\\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from hr.services import PayrollService
from hr.models import Employee, PayrollConcept, AFP, GlobalHRSettings, Payroll
from contacts.models import Contact

def test_formulas():
    # 1. Setup Data
    settings, _ = GlobalHRSettings.objects.get_or_create(id=1)
    settings.uf_current_value = Decimal('37000')
    settings.save()
    
    afp, _ = AFP.objects.get_or_create(name="Test AFP", defaults={'percentage': Decimal('11.00')})
    contact, _ = Contact.objects.get_or_create(tax_id="111-1", defaults={'name': "Test Employee"})
    
    # Test cases: (start_date, contract_type, expected_worker_pct, expected_employer_pct)
    test_cases = [
        (date(2020, 1, 1), Employee.ContractType.INDEFINIDO, Decimal('0.006'), Decimal('0.024')), # 6 years < 11
        (date(2010, 1, 1), Employee.ContractType.INDEFINIDO, Decimal('0'), Decimal('0.008')),      # 16 years > 11
        (date(2023, 1, 1), Employee.ContractType.PLAZO_FIJO, Decimal('0'), Decimal('0.03')),     # Fixed contract
    ]
    
    # Get concepts from DB (they should be updated if setup_demo_data was run, 
    # but here I'll just check if they exists or create them if needed for the test)
    worker_concept = PayrollConcept.objects.filter(name='Seguro Cesantía (Aporte Trabajador)').first()
    employer_concept = PayrollConcept.objects.filter(name='Seguro Cesantía (Aporte Empleador)').first()
    
    if not worker_concept or not employer_concept:
        print("Concepts not found in DB. Make sure setup_demo_data was run or update manually.")
        return

    print(f"Worker Concept Formula: {worker_concept.formula}")
    print(f"Employer Concept Formula: {employer_concept.formula}")
    print("-" * 50)

    for start_date, ctype, exp_w, exp_e in test_cases:
        emp = Employee.objects.create(
            contact=contact,
            start_date=start_date,
            contract_type=ctype,
            base_salary=Decimal('1000000'),
            afp=afp
        )
        
        # Test 2026-03 (Current date in context is 2026-03-25)
        payroll = PayrollService.generate_proforma_payroll(employee_id=emp.id, year=2026, month=3)
        
        imponible = payroll.worked_days * (emp.base_salary / 30) # Simplified
        imponible = imponible.quantize(Decimal('1'))
        
        worker_item = payroll.items.filter(concept=worker_concept).first()
        employer_item = payroll.items.filter(concept=employer_concept).first()
        
        w_amount = worker_item.amount if worker_item else Decimal('0')
        e_amount = employer_item.amount if employer_item else Decimal('0')
        
        w_pct = (w_amount / imponible) if imponible > 0 else Decimal('0')
        e_pct = (e_amount / imponible) if imponible > 0 else Decimal('0')
        
        print(f"Employee (Start: {start_date}, Type: {ctype})")
        print(f"  Calculated Imponible: {imponible}")
        print(f"  Worker: {w_amount} ({w_pct:.4f}) | Expected Pct: {exp_w:.4f}")
        print(f"  Employer: {e_amount} ({e_pct:.4f}) | Expected Pct: {exp_e:.4f}")
        
        # Clean up
        payroll.delete()
        emp.delete()
        print("-" * 30)

if __name__ == "__main__":
    test_formulas()
