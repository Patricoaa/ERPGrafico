"""
Management command: audit_terminal_provider_links

Audita la integridad de los vínculos entre PaymentTerminalProvider y sus
cuentas puente (TreasuryAccount.account_type = BRIDGE).

Casos que detecta:

  1. Bridge sin proveedor
     → Cuentas tipo BRIDGE que ningún PaymentTerminalProvider
       tiene como bank_treasury_account.

  2. Proveedor sin cuenta puente
     → PaymentTerminalProvider con bank_treasury_account NULL.
       En el modelo actual esto no debería ocurrir (FK NOT NULL), pero
       puede haber quedado NULL si el provider se insertó vía SQL o
       desde una versión previa del esquema.

  3. Proveedor con cuenta puente de tipo incorrecto
     → PaymentTerminalProvider.bank_treasury_account.account_type
       ∉ {BRIDGE}. La liquidación debería caer en una
       cuenta puente, no en una cuenta corriente o de caja.

  4. Duplicados por (provider, bank_treasury_account)
     → (informativo) Más de un provider con exactamente el mismo
       par name+type apuntando a la misma cuenta puente.

Uso:
    python manage.py audit_terminal_provider_links
    python manage.py audit_terminal_provider_links --json
"""
from django.core.management.base import BaseCommand
from django.db.models import Count

from treasury.models import PaymentTerminalProvider, TreasuryAccount


BRIDGE_LIKE = {TreasuryAccount.Type.BRIDGE}


class Command(BaseCommand):
    help = "Audita la integridad de los vínculos proveedor↔cuenta puente."

    def add_arguments(self, parser):
        parser.add_argument(
            '--json',
            action='store_true',
            help='Salida en formato JSON (útil para scripts).',
        )

    def handle(self, *args, **options):
        findings = {
            'orphan_bridges': [],
            'providers_without_bridge': [],
            'providers_with_wrong_bridge_type': [],
            'duplicate_provider_links': [],
        }

        # 1. Cuentas puente sin proveedor apuntando a ellas
        bridges = TreasuryAccount.objects.filter(account_type__in=BRIDGE_LIKE)
        for acc in bridges:
            qs = acc.terminal_providers.all()
            if not qs.exists():
                findings['orphan_bridges'].append({
                    'id': acc.id,
                    'code': acc.code,
                    'name': acc.name,
                    'type': acc.account_type,
                })

        # 2 + 3. Proveedores con/sin bank_treasury_account, o con tipo incorrecto
        for prov in PaymentTerminalProvider.objects.select_related('bank_treasury_account'):
            bridge = prov.bank_treasury_account
            if bridge is None:
                findings['providers_without_bridge'].append({
                    'id': prov.id,
                    'name': prov.name,
                    'provider_type': prov.provider_type,
                })
                continue
            if bridge.account_type not in BRIDGE_LIKE:
                findings['providers_with_wrong_bridge_type'].append({
                    'id': prov.id,
                    'name': prov.name,
                    'provider_type': prov.provider_type,
                    'bridge_id': bridge.id,
                    'bridge_name': bridge.name,
                    'bridge_type': bridge.account_type,
                })

        # 4. Duplicados: el mismo par (bank_treasury_account, name) más de una vez
        dupes = (
            PaymentTerminalProvider.objects
            .values('name', 'provider_type', 'bank_treasury_account_id')
            .annotate(c=Count('id'))
            .filter(c__gt=1)
        )
        for d in dupes:
            findings['duplicate_provider_links'].append(d)

        if options['json']:
            import json
            self.stdout.write(json.dumps(findings, indent=2, ensure_ascii=False, default=str))
            return

        # Salida humana
        def section(title, items, empty_msg):
            self.stdout.write(self.style.NOTICE(f"\n=== {title} ({len(items)}) ==="))
            if not items:
                self.stdout.write(self.style.SUCCESS(f"  {empty_msg}"))
                return
            for it in items:
                self.stdout.write(f"  - {it}")

        section(
            'Cuentas puente SIN proveedor',
            findings['orphan_bridges'],
            'OK: todas las cuentas puente tienen al menos un proveedor.',
        )
        section(
            'Proveedores SIN cuenta puente (bank_treasury_account=NULL)',
            findings['providers_without_bridge'],
            'OK: todos los proveedores tienen cuenta puente asignada.',
        )
        section(
            'Proveedores con cuenta puente de TIPO incorrecto',
            findings['providers_with_wrong_bridge_type'],
            'OK: la cuenta puente de todos los proveedores es BRIDGE.',
        )
        section(
            'Duplicados proveedor↔cuenta puente',
            findings['duplicate_provider_links'],
            'OK: no hay duplicados.',
        )

        any_problem = any(
            findings[k] for k in (
                'orphan_bridges',
                'providers_without_bridge',
                'providers_with_wrong_bridge_type',
                'duplicate_provider_links',
            )
        )
        if any_problem:
            self.stdout.write(self.style.WARNING(
                "\n→ Para reparar la vinculación TUU, re-ejecuta: "
                "python manage.py setup_demo_data --purge"
            ))
        else:
            self.stdout.write(self.style.SUCCESS("\nAuditoría OK."))
