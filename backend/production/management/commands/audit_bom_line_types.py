"""
Management command: audit_bom_line_types

Audita las líneas de listas de materiales (BillOfMaterialsLine) contra las
reglas de tipo de producto vigentes para componentes de BOM:

  1. Línea NO tercerizada con componente que no es STORABLE
     → La regla nueva (contexto) restringe materias primas y componentes a
       productos almacenables. Las líneas creadas antes de esa regla pueden
       contener MANUFACTURABLE (subensambles) y siguen siendo editables
       (el validador solo bloquea líneas nuevas), pero deben revisarse.

  2. Línea tercerizada con servicio no comprable
     → Un servicio tercerizado debe ser comprable (can_be_purchased=True).

Uso:
    python manage.py audit_bom_line_types
    python manage.py audit_bom_line_types --json
"""

import json

from django.core.management.base import BaseCommand

from inventory.models import Product
from production.models import BillOfMaterialsLine


class Command(BaseCommand):
    help = "Audita el tipo de producto de los componentes de líneas BOM."

    def add_arguments(self, parser):
        parser.add_argument(
            "--json",
            action="store_true",
            help="Salida en formato JSON (útil para scripts).",
        )

    def handle(self, *args, **options):
        findings = {
            "non_storable_materials": [],
            "non_purchasable_services": [],
        }

        lines = BillOfMaterialsLine.objects.select_related("component", "bom", "bom__product")
        for line in lines.iterator():
            component = line.component
            if line.is_outsourced:
                if component.can_be_purchased is not True:
                    findings["non_purchasable_services"].append(self._row(line))
            elif component.product_type != Product.Type.STORABLE:
                findings["non_storable_materials"].append(self._row(line))

        if options["json"]:
            self.stdout.write(json.dumps(findings, indent=2, ensure_ascii=False, default=str))
            return

        def section(title, items, empty_msg):
            self.stdout.write(self.style.NOTICE(f"\n=== {title} ({len(items)}) ==="))
            if not items:
                self.stdout.write(self.style.SUCCESS(f"  {empty_msg}"))
                return
            for it in items:
                self.stdout.write(f"  - {it}")

        section(
            "Líneas NO tercerizadas con componente que no es STORABLE",
            findings["non_storable_materials"],
            "OK: todos los componentes de líneas no tercerizadas son STORABLE.",
        )
        section(
            "Líneas tercerizadas con servicio NO comprable",
            findings["non_purchasable_services"],
            "OK: todos los servicios tercerizados son comprables.",
        )

        any_problem = any(findings.values())
        if any_problem:
            self.stdout.write(
                self.style.WARNING(
                    "\n→ Revisar: el validador solo bloquea líneas NUEVAS; las "
                    "existentes se reportan aquí para decisión de negocio."
                )
            )
        else:
            self.stdout.write(self.style.SUCCESS("\nAuditoría OK."))

    def _row(self, line):
        return {
            "line_id": line.id,
            "bom_id": line.bom_id,
            "product_id": line.bom.product_id,
            "product_name": line.bom.product.name if line.bom.product_id else None,
            "component_id": line.component_id,
            "component_name": line.component.name,
            "component_type": line.component.product_type,
            "is_outsourced": line.is_outsourced,
        }
