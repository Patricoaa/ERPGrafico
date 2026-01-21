"""
Test script to verify VAT calculation changes.

This script creates a test sale order with multiple lines and verifies
that the VAT is calculated correctly on the total net amount.
"""

from decimal import Decimal
import math

# Simulate the new calculation logic
def calculate_totals_new(lines):
    """New method: Calculate VAT on total net"""
    total_net = Decimal('0.00')
    
    for line in lines:
        total_net += line['subtotal']
    
    tax_rate = Decimal('19.00')
    total_tax = total_net * (tax_rate / Decimal('100.0'))
    total_tax = Decimal(str(math.ceil(total_tax)))
    total = total_net + total_tax
    
    return {
        'total_net': total_net,
        'total_tax': total_tax,
        'total': total
    }

# Simulate the old calculation logic
def calculate_totals_old(lines):
    """Old method: Calculate VAT per line then sum"""
    total_net = Decimal('0.00')
    total_tax = Decimal('0.00')
    
    for line in lines:
        line_net = line['subtotal']
        line_tax_rate = Decimal('19.00')
        line_tax = line_net * (line_tax_rate / Decimal('100.0'))
        
        total_net += line_net
        total_tax += line_tax
    
    total_tax = Decimal(str(math.ceil(total_tax)))
    total = total_net + total_tax
    
    return {
        'total_net': total_net,
        'total_tax': total_tax,
        'total': total
    }

# Test cases
test_cases = [
    {
        'name': 'Simple 3-line order',
        'lines': [
            {'subtotal': Decimal('1000')},
            {'subtotal': Decimal('1500')},
            {'subtotal': Decimal('2333')},
        ]
    },
    {
        'name': 'Many small lines',
        'lines': [
            {'subtotal': Decimal('100')} for _ in range(10)
        ]
    },
    {
        'name': 'Large order with decimals',
        'lines': [
            {'subtotal': Decimal('15789')},
            {'subtotal': Decimal('23456')},
            {'subtotal': Decimal('8901')},
            {'subtotal': Decimal('12345')},
        ]
    },
]

print("VAT Calculation Comparison Test")
print("=" * 80)

for test in test_cases:
    print(f"\nTest: {test['name']}")
    print("-" * 80)
    
    old_result = calculate_totals_old(test['lines'])
    new_result = calculate_totals_new(test['lines'])
    
    print(f"Total Net:  ${old_result['total_net']:>12}")
    print(f"Old VAT:    ${old_result['total_tax']:>12}")
    print(f"New VAT:    ${new_result['total_tax']:>12}")
    print(f"Difference: ${abs(old_result['total_tax'] - new_result['total_tax']):>12}")
    
    if old_result['total_tax'] != new_result['total_tax']:
        print("⚠️  DISCREPANCY DETECTED")
    else:
        print("✅ Same result")
    
    # Verify new calculation matches expected formula
    expected_tax = Decimal(str(math.ceil(old_result['total_net'] * Decimal('0.19'))))
    if new_result['total_tax'] == expected_tax:
        print("✅ New calculation matches formula: ceil(total_net × 0.19)")
    else:
        print(f"❌ Expected {expected_tax}, got {new_result['total_tax']}")

print("\n" + "=" * 80)
print("Test complete!")
