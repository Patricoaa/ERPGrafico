# Generated manually for UoM system simplification

from django.db import migrations


def migrate_uom_to_allowed_sale_uoms(apps, schema_editor):
    """
    Migrates existing sale_uom and purchase_uom values to allowed_sale_uoms.
    This ensures backward compatibility while moving to the new simplified system.
    """
    Product = apps.get_model('inventory', 'Product')
    
    migrated_count = 0
    for product in Product.objects.all():
        # Ensure product has a base UoM
        if not product.uom:
            # Fallback: use sale_uom or purchase_uom as base
            if product.sale_uom:
                product.uom = product.sale_uom
                product.save()
            elif product.purchase_uom:
                product.uom = product.purchase_uom
                product.save()
        
        # Migrate sale_uom and purchase_uom to allowed_sale_uoms
        uoms_to_add = []
        
        if product.sale_uom and product.sale_uom != product.uom:
            uoms_to_add.append(product.sale_uom)
        
        if product.purchase_uom and product.purchase_uom != product.uom:
            if product.purchase_uom not in uoms_to_add:
                uoms_to_add.append(product.purchase_uom)
        
        if uoms_to_add:
            product.allowed_sale_uoms.add(*uoms_to_add)
            migrated_count += 1
    
    print(f"✓ Migrated UoM data for {migrated_count} products")


def reverse_migration(apps, schema_editor):
    """
    Reverse migration - clear allowed_sale_uoms that were added by migration.
    Note: This is a best-effort reverse and may not be perfect.
    """
    Product = apps.get_model('inventory', 'Product')
    
    for product in Product.objects.all():
        product.allowed_sale_uoms.clear()


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0017_remove_product_mfg_show_contacts_and_more'),
    ]

    operations = [
        migrations.RunPython(migrate_uom_to_allowed_sale_uoms, reverse_migration),
    ]
