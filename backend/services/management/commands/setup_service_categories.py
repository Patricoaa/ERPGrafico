from django.core.management.base import BaseCommand
from services.models import ServiceCategory
from accounting.models import Account, AccountType

class Command(BaseCommand):
    help = 'Crea categorías de servicio iniciales'

    def handle(self, *args, **options):
        # Ensure we have default accounts or placeholders
        # In a real scenario, we would lookup specific accounts by code
        # For demo, we'll try to find any suitable account or None
        
        expense_acc = Account.objects.filter(account_type=AccountType.EXPENSE).first()
        payable_acc = Account.objects.filter(account_type=AccountType.LIABILITY).first()
        
        if not expense_acc or not payable_acc:
            self.stdout.write(self.style.WARNING('No se encontraron cuentas de Gasto/Pasivo para asignar por defecto. Se crearán sin cuentas.'))

        categories = [
            {'name': 'Arriendos', 'code': 'ARR'},
            {'name': 'Servicios Básicos', 'code': 'SB'},
            {'name': 'Seguros', 'code': 'SEG', 'requires_provision': True},
            {'name': 'Suscripciones', 'code': 'SUSC'},
            {'name': 'Cotizaciones Previsionales', 'code': 'PREV'},
            {'name': 'Impuestos', 'code': 'IMP', 'is_tax_deductible': False},
            {'name': 'Mantenimiento', 'code': 'MANT'},
            {'name': 'Asesorías', 'code': 'ASES'},
            {'name': 'Telecomunicaciones', 'code': 'TEL'},
        ]

        for cat_data in categories:
            cat, created = ServiceCategory.objects.get_or_create(
                code=cat_data['code'],
                defaults={
                    'name': cat_data['name'],
                    'requires_provision': cat_data.get('requires_provision', False),
                    'is_tax_deductible': cat_data.get('is_tax_deductible', True),
                    'expense_account': expense_acc,
                    'payable_account': payable_acc
                }
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'Categoría creada: {cat.name}'))
            else:
                self.stdout.write(f'Categoría ya existe: {cat.name}')
