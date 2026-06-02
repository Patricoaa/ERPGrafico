"""
Command de convergencia de cuentas de tesorería legacy.

Convierte cuentas ``DEBIT_CARD``/``CHECKBOOK`` en cuentas ``CHECKING`` con su
forma de pago correspondiente (Capa 2). Dry-run por defecto: usar ``--apply``
para persistir. Idempotente y defensivo (omite y reporta lo no convertible).

Uso:
    python manage.py converge_treasury_accounts            # simula (dry-run)
    python manage.py converge_treasury_accounts --apply    # aplica
"""
from django.core.management.base import BaseCommand

from treasury.convergence import converge_accounts


class Command(BaseCommand):
    help = (
        "Converge cuentas DEBIT_CARD/CHECKBOOK a CHECKING + forma de pago. "
        "Dry-run por defecto; use --apply para persistir."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Aplica los cambios. Sin esta bandera solo simula (dry-run).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Fuerza simulación (comportamiento por defecto). Prevalece sobre --apply.",
        )

    def handle(self, *args, **options):
        # dry-run prevalece sobre apply por seguridad.
        apply = options["apply"] and not options["dry_run"]
        report = converge_accounts(apply=apply)

        mode = "APLICADO" if apply else "DRY-RUN (sin cambios)"
        self.stdout.write(self.style.MIGRATE_HEADING(f"Convergencia de cuentas — {mode}"))

        self.stdout.write(f"Convertidas: {len(report.converted)}")
        for line in report.converted:
            self.stdout.write(f"  ✓ {line}")

        self.stdout.write(f"Métodos de pago creados: {len(report.methods_created)}")
        for line in report.methods_created:
            self.stdout.write(f"  + {line}")

        if report.skipped:
            self.stdout.write(self.style.WARNING(f"Omitidas (revisión manual): {len(report.skipped)}"))
            for line in report.skipped:
                self.stdout.write(self.style.WARNING(f"  ! {line}"))

        remaining = report.remaining
        if remaining == 0:
            self.stdout.write(self.style.SUCCESS("0 cuentas legacy restantes."))
        else:
            self.stdout.write(self.style.WARNING(
                f"{remaining} cuenta(s) legacy restante(s) "
                f"({'omitidas' if apply else 'pendientes de aplicar'})."
            ))
