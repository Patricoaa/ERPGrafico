from django.db import migrations


def seed_checklist_templates(apps, schema_editor):
    Template = apps.get_model("accounting", "ClosingChecklistTemplate")
    items = [
        {
            "code": "bank_reconciliation",
            "name": "Conciliación Bancaria",
            "description": "Verificar que todos los movimientos bancarios estén conciliados al cierre del ejercicio.",
            "category": "RECONCILIATION",
            "order": 10,
        },
        {
            "code": "fx_difference",
            "name": "Diferencia Cambiaria",
            "description": "Registrar y ajustar diferencias cambiarias de activos y pasivos en moneda extranjera.",
            "category": "VALUATION",
            "order": 20,
        },
        {
            "code": "inventory_valuation",
            "name": "Valorización de Inventario",
            "description": "Validar la valorización del inventario final y ajustar por obsolescencia o deterioro.",
            "category": "VALUATION",
            "order": 30,
        },
        {
            "code": "accruals_posted",
            "name": "Devengos y Periodificaciones",
            "description": "Registrar devengos de ingresos y gastos que correspondan al ejercicio cerrado.",
            "category": "ADJUSTMENT",
            "order": 40,
        },
        {
            "code": "depreciation_posted",
            "name": "Depreciación del Ejercicio",
            "description": "Calcular y registrar la depreciación y amortización de activos fijos del período.",
            "category": "ADJUSTMENT",
            "order": 50,
        },
        {
            "code": "intercompany_reconciliation",
            "name": "Conciliación Intercompañía",
            "description": "Conciliar saldos y transacciones entre empresas relacionadas del grupo.",
            "category": "RECONCILIATION",
            "order": 60,
        },
        {
            "code": "tax_provision",
            "name": "Provisión Impuesto Renta",
            "description": "Calcular y registrar la provisión del Impuesto a la Renta del ejercicio.",
            "category": "ADJUSTMENT",
            "order": 70,
        },
        {
            "code": "trial_balance_review",
            "name": "Revisión Balance de Comprobación",
            "description": "Revisar el balance de comprobación antes del cierre para detectar saldos anómalos.",
            "category": "DOCUMENT",
            "order": 80,
        },
    ]
    for item in items:
        Template.objects.get_or_create(code=item["code"], defaults=item)


class Migration(migrations.Migration):
    dependencies = [
        ("accounting", "0034_add_closing_checklist_models"),
    ]

    operations = [
        migrations.RunPython(seed_checklist_templates, migrations.RunPython.noop),
    ]
