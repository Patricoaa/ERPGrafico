from django.core.management.base import BaseCommand
from django.db import transaction

from accounting.utils import get_vat_multiplier
from inventory.models import PricingRule, Product, ProductUoMPrice
from inventory.price_rederivation import rederive_sale_prices


class Command(BaseCommand):
    help = "Audita (y con --apply corrige) los netos de precio de venta derivándolos del bruto (ADR-0151)."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Escribe los cambios (por defecto solo informa).")

    def handle(self, *args, **options):
        apply = options["apply"]
        with transaction.atomic():
            summary = rederive_sale_prices(
                product=Product,
                pricing_rule=PricingRule,
                uom_price=ProductUoMPrice,
                multiplier=get_vat_multiplier(),
                apply=apply,
            )
        self.stdout.write("APLICADO" if apply else "DRY-RUN (sin cambios)")
        for name, s in summary.items():
            self.stdout.write(f"{name}: escaneadas={s.scanned} cambian={s.changed}")
            for pk, before, after in s.samples:
                self.stdout.write(f"  #{pk}: {before} -> {after}")
