from django.core.management.base import BaseCommand

from core.models import User
from workflow.models import TaskAssignmentRule


class Command(BaseCommand):
    help = "Seeds default workflow assignment rules"

    def handle(self, *args, **options):
        # Let's pick the first superuser as default assignee for tests
        admin = User.objects.filter(is_superuser=True).first()

        rules = [
            {
                "task_type": "OT_MATERIAL_APPROVAL",
                "description": "Aprobación de disponibilidad de materiales",
            },
            {
                "task_type": "OT_PREPRESS_APPROVAL",
                "description": "Aprobación de diseño y pre-impresión",
            },
            {
                "task_type": "OT_PRESS_APPROVAL",
                "description": "Supervisión de inicio de impresión",
            },
            {
                "task_type": "OT_POSTPRESS_APPROVAL",
                "description": "Supervisión de terminaciones y empaque",
            },
            {
                "task_type": "OT_OUTSOURCING_VERIFICATION_APPROVAL",
                "description": "Verificación de recepción de servicios externos",
            },
            {
                "task_type": "OT_RECTIFICATION_APPROVAL",
                "description": "Aprobación de rectificación y producción final",
            },
            {
                "task_type": "CREDIT_POS_REQUEST",
                "description": "Aprobación de crédito en POS",
            },
            {"task_type": "HUB_ORIGIN", "description": "Tarea de origen de documento"},
            {"task_type": "HUB_LOGISTICS", "description": "Tarea de logística"},
            {"task_type": "HUB_BILLING", "description": "Tarea de facturación"},
            {"task_type": "HUB_TREASURY", "description": "Tarea de tesorería"},
            {"task_type": "OT_CREATION", "description": "Creación de orden de trabajo"},
            {"task_type": "F29_CREATE", "description": "Creación de declaración F29"},
            {"task_type": "F29_PAY", "description": "Pago de declaración F29"},
            {"task_type": "PERIOD_CLOSE", "description": "Cierre contable mensual"},
        ]

        for rule_data in rules:
            rule, created = TaskAssignmentRule.objects.get_or_create(
                task_type=rule_data["task_type"],
                defaults={"description": rule_data["description"], "assigned_user": admin},
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f"Regla creada: {rule.task_type}"))
            else:
                self.stdout.write(f"Regla ya existe: {rule.task_type}")
