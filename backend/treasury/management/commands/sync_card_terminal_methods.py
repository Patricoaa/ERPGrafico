"""
Management command: sync_card_terminal_methods

Backfills CARD_TERMINAL PaymentMethod instances for all POSTerminals
that have a linked PaymentTerminalDevice but no CARD_TERMINAL method yet.

Run once after deploying the CARD_TERMINAL feature, or any time
a terminal device was linked before the auto-signal existed.

Usage:
    python manage.py sync_card_terminal_methods
    python manage.py sync_card_terminal_methods --dry-run
"""

from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = "Auto-crea métodos CARD_TERMINAL para terminales POS con device vinculado."

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Muestra qué se crearía sin escribir nada en DB.',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        from treasury.models import POSTerminal, PaymentMethod

        dry_run = options['dry_run']

        terminals = POSTerminal.objects.filter(
            payment_terminal_device__isnull=False,
            is_active=True,
        ).select_related(
            'payment_terminal_device__provider__bank_treasury_account',
        )

        created_count = 0
        skipped_count = 0
        error_count = 0

        for terminal in terminals:
            device = terminal.payment_terminal_device
            provider = device.provider if device.provider_id else None

            # Cuenta puente del proveedor — no la cuenta de caja del terminal
            treasury_account = provider.bank_treasury_account if provider else None

            if not treasury_account:
                self.stdout.write(
                    self.style.WARNING(
                        f"  SKIP {terminal.code} — proveedor sin bank_treasury_account configurado."
                    )
                )
                skipped_count += 1
                continue

            existing = PaymentMethod.objects.filter(
                method_type=PaymentMethod.Type.CARD_TERMINAL,
                linked_terminal_device=device,
            ).first()

            if existing:
                # Asegurar que está en allowed_payment_methods
                if not terminal.allowed_payment_methods.filter(id=existing.id).exists():
                    if not dry_run:
                        terminal.allowed_payment_methods.add(existing)
                    self.stdout.write(
                        self.style.WARNING(
                            f"  LINK {terminal.code} → método existente '{existing.name}' re-vinculado."
                        )
                    )
                else:
                    self.stdout.write(
                        f"  OK   {terminal.code} — '{existing.name}' ya está configurado."
                    )
                skipped_count += 1
                continue

            # Crear método CARD_TERMINAL
            method_name = f'Tarjeta — {device.name}'
            if dry_run:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"  [DRY] {terminal.code} → crearía '{method_name}' "
                        f"(cuenta: {treasury_account.name})."
                    )
                )
                created_count += 1
                continue

            try:
                method = PaymentMethod.objects.create(
                    name=method_name,
                    method_type=PaymentMethod.Type.CARD_TERMINAL,
                    treasury_account=treasury_account,
                    linked_terminal_device=device,
                    allow_for_sales=True,
                    allow_for_purchases=False,
                    is_active=True,
                )
                terminal.allowed_payment_methods.add(method)
                self.stdout.write(
                    self.style.SUCCESS(
                        f"  CREATED {terminal.code} → '{method.name}' (id={method.id})."
                    )
                )
                created_count += 1
            except Exception as exc:
                self.stdout.write(
                    self.style.ERROR(f"  ERROR {terminal.code}: {exc}")
                )
                error_count += 1

        self.stdout.write("")
        self.stdout.write(
            f"Terminales procesados: {terminals.count()} | "
            f"Creados: {created_count} | Saltados: {skipped_count} | Errores: {error_count}"
        )
        if dry_run:
            self.stdout.write(self.style.WARNING("Modo --dry-run: ningún cambio fue escrito."))
