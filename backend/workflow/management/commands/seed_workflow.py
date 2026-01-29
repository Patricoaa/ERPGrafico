from django.core.management.base import BaseCommand
from workflow.models import TaskAssignmentRule
from core.models import User

class Command(BaseCommand):
    help = 'Seeds default workflow assignment rules'

    def handle(self, *args, **options):
        # Let's pick the first superuser as default assignee for tests
        admin = User.objects.filter(is_superuser=True).first()
        
        rules = [
            {
                'task_type': 'OT_PREPRESS_APPROVAL',
                'description': 'Aprobación de diseño y pre-impresión',
            },
            {
                'task_type': 'OT_MATERIAL_REQUISITION',
                'description': 'Aprobación de compra/salida de materiales',
            },
            {
                'task_type': 'SALE_NOTE_VERIFICATION',
                'description': 'Verificación de notas de venta críticas',
            }
        ]
        
        for rule_data in rules:
            rule, created = TaskAssignmentRule.objects.get_or_create(
                task_type=rule_data['task_type'],
                defaults={
                    'description': rule_data['description'],
                    'assigned_user': admin
                }
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'Regla creada: {rule.task_type}'))
            else:
                self.stdout.write(f'Regla ya existe: {rule.task_type}')
