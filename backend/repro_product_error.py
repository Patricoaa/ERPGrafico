import os
import django
import sys

# Setup Django environment
sys.path.append('c:/Users/PATRI/Nextcloud/Pato/Aplicaciones/ERPGrafico/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from inventory.models import Product, ProductCategory, UoM

def test_create_products():
    try:
        cat = ProductCategory.objects.first()
        if not cat:
            print("No category found")
            return
            
        uom = UoM.objects.first()
        if not uom:
            print("No UoM found")
            return

        print(f"Using category: {cat.name} (prefix: {cat.prefix})")
        
        # Try to create first product
        p1 = Product.objects.create(
            name="Test Product 1",
            code="TEST001",
            category=cat,
            uom=uom,
            product_type='MANUFACTURABLE',
            requires_advanced_manufacturing=True
        )
        print(f"Created P1: {p1.name}, internal_code: {p1.internal_code}")

        # Try to create second product
        p2 = Product.objects.create(
            name="Test Product 2",
            code="TEST002",
            category=cat,
            uom=uom,
            product_type='MANUFACTURABLE',
            requires_advanced_manufacturing=True
        )
        print(f"Created P2: {p2.name}, internal_code: {p2.internal_code}")

    except Exception as e:
        import traceback
        print("Error during product creation:")
        traceback.print_exc()

if __name__ == "__main__":
    test_create_products()
