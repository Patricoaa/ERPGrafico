#!/usr/bin/env python
"""
Script de validación post-migración para cuentas de inventario
Uso: docker compose exec backend python validate_inventory_accounts.py
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from accounting.models import AccountingSettings
from inventory.models import Product
from django.db.models import Count

def validate_migration():
    print("=" * 60)
    print("VALIDACIÓN DE MIGRACIÓN: CUENTAS DE INVENTARIO")
    print("=" * 60)
    
    # 1. Verificar configuración
    settings = AccountingSettings.objects.first()
    if not settings:
        print("❌ ERROR: No existe configuración contable")
        return False
    
    print("\n1. CONFIGURACIÓN CONTABLE:")
    print(f"   default_inventory_account: {settings.default_inventory_account}")
    print(f"   storable_inventory_account: {settings.storable_inventory_account}")
    print(f"   manufacturable_inventory_account: {settings.manufacturable_inventory_account}")
    print(f"   default_consumable_account: {settings.default_consumable_account}")
    
    if not settings.storable_inventory_account:
        print("   ⚠️  WARNING: storable_inventory_account no configurada")
    if not settings.manufacturable_inventory_account:
        print("   ⚠️  WARNING: manufacturable_inventory_account no configurada")
    
    # 2. Verificar productos
    print("\n2. PRODUCTOS POR TIPO:")
    product_counts = Product.objects.values('product_type').annotate(count=Count('id'))
    for item in product_counts:
        print(f"   {item['product_type']}: {item['count']} productos")
    
    # 3. Verificar asignación de cuentas
    print("\n3. ASIGNACIÓN DE CUENTAS:")
    errors = []
    # Only check products that are NOT services
    for product in Product.objects.filter(track_inventory=True).exclude(product_type='SERVICE'):
        account = product.get_asset_account
        if not account:
            errors.append(f"   ❌ {product.code}: Sin cuenta asignada")
    
    if errors:
        print("\n".join(errors))
        return False
    else:
        print("   ✓ Todos los productos con inventario tienen cuenta asignada")
    
    # 4. Resumen
    print("\n4. RESUMEN:")
    storable = Product.objects.filter(product_type='STORABLE').count()
    mfg = Product.objects.filter(product_type='MANUFACTURABLE').count()
    consumable = Product.objects.filter(product_type='CONSUMABLE').count()
    service = Product.objects.filter(product_type='SERVICE').count()
    
    print(f"   ✓ {storable} productos STORABLE")
    print(f"   ✓ {mfg} productos MANUFACTURABLE")
    print(f"   ✓ {consumable} productos CONSUMABLE")
    print(f"   ✓ {service} productos SERVICE")
    
    # NEW: Verificar consistencia de STORABLE
    print("\n4.5. VERIFICACIÓN DE CONSISTENCIA (STORABLE):")
    storable_setting = settings.storable_inventory_account
    if not storable_setting:
         print("   ⚠️ No se puede verificar: storable_inventory_account no configurada")
    else:
        mismatches = []
        # Check first 5 storable products to avoid spam
        for product in Product.objects.filter(track_inventory=True, product_type='STORABLE')[:10]:
            account = product.get_asset_account
            if account and account.id != storable_setting.id:
                 mismatches.append(f"   ⚠️ {product.code}: Usa {account.code} pero configuración dice {storable_setting.code}")
        
        if mismatches:
            print("\n".join(mismatches))
            print("   ❌ ERROR: Productos STORABLE no están usando la cuenta configurada (¿Override de categoría?)")
            return False
        else:
            print(f"   ✓ Productos STORABLE están usando {storable_setting.code} correctamente")

    # 5. Verificar que nuevos campos apuntan a cuenta correcta
    print("\n5. VERIFICACIÓN DE MIGRACIÓN:")
    if settings.storable_inventory_account and settings.default_inventory_account:
        if settings.storable_inventory_account.id == settings.default_inventory_account.id:
            print("   ✓ storable_inventory_account apunta a default_inventory_account (correcto)")
        else:
            print("   ⚠️  storable_inventory_account apunta a cuenta diferente")
    
    if settings.manufacturable_inventory_account and settings.default_inventory_account:
        if settings.manufacturable_inventory_account.id == settings.default_inventory_account.id:
            print("   ✓ manufacturable_inventory_account apunta a default_inventory_account (correcto)")
        else:
            print("   ⚠️  manufacturable_inventory_account apunta a cuenta diferente")
    
    print("\n" + "=" * 60)
    print("✓ VALIDACIÓN EXITOSA")
    print("=" * 60)
    return True

if __name__ == '__main__':
    try:
        validate_migration()
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
