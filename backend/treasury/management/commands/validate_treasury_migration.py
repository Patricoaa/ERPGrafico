from django.core.management.base import BaseCommand
from django.core.exceptions import ValidationError
from treasury.models import TreasuryAccount, PaymentMethod


class Command(BaseCommand):
    help = 'Valida la migración de tipos de cuenta de tesorería'

    def handle(self, *args, **options):
        issues = []
        warnings = []
        
        print('\n=== Validacion de Migracion de Tipos de Cuenta ===\n')
        
        # 1. Validar cuentas CHECKING sin número
        print('Verificando cuentas corrientes...')
        checking_no_number = TreasuryAccount.objects.filter(
            account_type='CHECKING',
            account_number__isnull=True
        )
        if checking_no_number.exists():
            count = checking_no_number.count()
            warnings.append(f"[WARN] {count} cuentas corrientes sin numero de cuenta")
            for acc in checking_no_number:
                print(f"  - {acc.name} (ID: {acc.id})")
        else:
            print('  OK - Todas las cuentas corrientes tienen numero')
        
        # 2. Validar cuentas CHECKING sin banco
        checking_no_bank = TreasuryAccount.objects.filter(
            account_type='CHECKING',
            bank__isnull=True
        )
        if checking_no_bank.exists():
            count = checking_no_bank.count()
            issues.append(f"[ERROR] {count} cuentas corrientes sin banco asociado")
            for acc in checking_no_bank:
                print(f"  - {acc.name} (ID: {acc.id})")
        else:
            print('  OK - Todas las cuentas corrientes tienen banco')
        
        # 3. Validar tarjetas sin banco
        print('\nVerificando tarjetas...')
        cards_no_bank = TreasuryAccount.objects.filter(
            account_type__in=['CREDIT_CARD', 'DEBIT_CARD'],
            bank__isnull=True
        )
        if cards_no_bank.exists():
            count = cards_no_bank.count()
            issues.append(f"[ERROR] {count} tarjetas sin banco asociado")
            for acc in cards_no_bank:
                print(f"  - {acc.name} (ID: {acc.id})")
        else:
            print('  OK - Todas las tarjetas tienen banco')
        
        # 4. Validar cajas con banco
        print('\nVerificando cajas de efectivo...')
        cash_with_bank = TreasuryAccount.objects.filter(
            account_type='CASH',
            bank__isnull=False
        )
        if cash_with_bank.exists():
            count = cash_with_bank.count()
            issues.append(f"[ERROR] {count} cajas de efectivo con banco asociado (invalido)")
            for acc in cash_with_bank:
                print(f"  - {acc.name} (ID: {acc.id})")
        else:
            print('  OK - Ninguna caja tiene banco asociado')
        
        # 5. Validar métodos de pago incompatibles
        print('\nVerificando compatibilidad de metodos de pago...')
        incompatible_count = 0
        for method in PaymentMethod.objects.select_related('treasury_account').all():
            try:
                method.clean()
            except ValidationError as e:
                incompatible_count += 1
                issues.append(f"[ERROR] Metodo '{method.name}' incompatible con cuenta '{method.treasury_account.name}'")
                print(f"  - {method.name}: {e.message_dict}")
        
        if incompatible_count == 0:
            print('  OK - Todos los metodos de pago son compatibles')
        
        # 6. Resumen de tipos de cuenta
        print('\n=== Resumen de Tipos de Cuenta ===')
        for account_type, display_name in TreasuryAccount.Type.choices:
            count = TreasuryAccount.objects.filter(account_type=account_type).count()
            print(f"  {account_type}: {count}")
        
        # Resumen final
        print('\n=== Resumen de Validacion ===')
        if issues:
            print(f"\n[ERROR] {len(issues)} problemas criticos encontrados:")
            for issue in issues:
                print(f"  {issue}")
        
        if warnings:
            print(f"\n[WARN] {len(warnings)} advertencias:")
            for warning in warnings:
                print(f"  {warning}")
        
        if not issues:
            print("\nOK - Validacion exitosa")
        else:
            print("\nFAIL - Se encontraron problemas")
            return 1
        
        return 0
