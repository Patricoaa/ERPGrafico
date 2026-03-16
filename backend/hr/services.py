"""
HR Services: Logic for payroll calculations and accounting entries.
"""
from decimal import Decimal
from django.utils.translation import gettext_lazy as _
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Sum
import re


class PayrollService:
    
    @staticmethod
    def update_payroll_totals(payroll):
        """Calcula totales de haberes, descuentos y líquido."""
        from .models import PayrollItem, PayrollConcept, Payroll
        
        haberes = payroll.items.filter(
            concept__category__in=[
                PayrollConcept.Category.HABER_IMPONIBLE, 
                PayrollConcept.Category.HABER_NO_IMPONIBLE
            ]
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        descuentos = payroll.items.filter(
            concept__category__in=[
                PayrollConcept.Category.DESCUENTO_LEGAL_TRABAJADOR, 
                PayrollConcept.Category.OTRO_DESCUENTO
            ]
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        payroll.total_haberes = haberes
        payroll.total_descuentos = descuentos
        payroll.net_salary = haberes - descuentos
        
        # Guardar directamente en DB para evitar recursión de save() si se llama desde ahí
        Payroll.objects.filter(pk=payroll.pk).update(
            total_haberes=payroll.total_haberes,
            total_descuentos=payroll.total_descuentos,
            net_salary=payroll.net_salary
        )

    @staticmethod
    def evaluate_formula(formula, context):
        """
        Evalúa una fórmula matemática simple de forma segura.
        Variables soportadas en contexto: BASE, IMPONIBLE, UF, UTM, MIN_WAGE, AFP_PERCENT, ISAPRE_UF, CONTRATO_INDEFINIDO
        """
        if not formula:
            return Decimal('0')
            
        try:
            # Limpiar formula de caracteres no permitidos (básico para seguridad)
            # Añadimos soporte para min/max
            eval_globals = {
                "__builtins__": {},
                "min": min,
                "max": max,
                "abs": abs,
            }
            
            # Permitir letras, números y operadores comunes para evitar truncamiento por error
            allowed_chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.+-*/()[],_<>!=% "
            sanitized = "".join([c for c in formula if c in allowed_chars]).strip()
            
            # Reemplazar variables por sus valores (Insensible a mayúsculas y palabras completas)
            for var in sorted(context.keys(), key=len, reverse=True):
                val = float(context[var]) if context[var] is not None else 0.0
                # Regex para reemplazar solo palabras completas (evita sub-strings) e ignorar mayúsculas
                pattern = re.compile(r'\b' + re.escape(var) + r'\b', re.IGNORECASE)
                sanitized = pattern.sub(str(val), sanitized)
            
            # Limpieza final: eliminar operadores al final que causan invalid syntax (ej: "10 * 2 /")
            sanitized = sanitized.strip()
            while sanitized and sanitized[-1] in "+-*/%":
                sanitized = sanitized[:-1].strip()
            
            # Evaluar (restringido)
            try:
                result = eval(sanitized, eval_globals, {})
                return Decimal(str(result)).quantize(Decimal('1'))
            except Exception as e:
                print(f"Error evaluando sanitized '{sanitized}': {e}")
                raise e
        except Exception as e:
            print(f"Error evaluando fórmula '{formula}': {e}")
            return Decimal('0')

    @staticmethod
    @transaction.atomic
    def generate_proforma_payroll(employee_id=None, year=None, month=None, payroll=None):
        """
        Genera una propuesta de liquidación basada en legislación chilena y fórmulas dinámicas.
        Puede recibir un payroll ya creado o los parámetros para buscar/crear uno.
        """
        from .models import Employee, Payroll, PayrollItem, PayrollConcept, GlobalHRSettings, AFP, EmployeeConceptAmount
        
        if payroll:
            employee = payroll.employee
            year = payroll.period_year
            month = payroll.period_month
            created = False
        else:
            employee = Employee.objects.get(pk=employee_id)
            settings, _ = GlobalHRSettings.objects.get_or_create(pk=1)
            
            # 1. Crear o limpiar Payroll borrador
            payroll, created = Payroll.objects.get_or_create(
                employee=employee,
                period_year=year,
                period_month=month,
                defaults={'status': Payroll.Status.DRAFT, 'base_salary': employee.base_salary}
            )
        
        settings, _ = GlobalHRSettings.objects.get_or_create(pk=1)
        
        if not created:
            if payroll.status == Payroll.Status.POSTED:
                raise ValidationError(_("No se puede regenerar una liquidación ya contabilizada."))
            payroll.items.all().delete()
            payroll.base_salary = employee.base_salary
            payroll.save()
            
        # --- MOTOR DE CÁLCULO ---
        from .models import Absence
        from django.db.models import Sum
        
        # Determine absent days for the period
        # Absences in this period
        absences = Absence.objects.filter(
            employee=employee,
            start_date__year=year,
            start_date__month=month
        )
        total_absent = absences.aggregate(total=Sum('days'))['total'] or Decimal('0')
        
        dias_pactados = Decimal(str(employee.dias_pactados))
        dias_trabajados = dias_pactados - total_absent
        if dias_trabajados < Decimal('0'):
            dias_trabajados = Decimal('0')
            
        # Prorrateo del sueldo base
        sueldo_base_prorrateado = (employee.base_salary / dias_pactados) * dias_trabajados
        sueldo_base_prorrateado = sueldo_base_prorrateado.quantize(Decimal('1'))
        
        # Save snapshots in payroll
        payroll.agreed_days = employee.dias_pactados
        payroll.absent_days = total_absent
        payroll.worked_days = dias_trabajados
        payroll.save(update_fields=['agreed_days', 'absent_days', 'worked_days'])

        # Contexto base para fórmulas
        context = {
            'BASE': sueldo_base_prorrateado,
            'BASE_PACTADO': employee.base_salary,
            'DIAS_PACTADOS': dias_pactados,
            'DIAS_TRABAJADOS': dias_trabajados,
            'UF': settings.uf_current_value,
            'UTM': settings.utm_current_value,
            'MIN_WAGE': settings.min_wage_value,
            'AFP_PERCENT': (employee.afp.percentage / Decimal('100')) if employee.afp else Decimal('0'),
            'ISAPRE_UF': employee.isapre_amount_uf,
            'CONTRATO_INDEFINIDO': 1 if employee.contract_type == Employee.ContractType.INDEFINIDO else 0,
            'IMPONIBLE': Decimal('0'), # Se actualizará después de la primera pasada
        }

        # PASS 1: Haberes (Para determinar el IMPONIBLE)
        concepts = PayrollConcept.objects.all()
        haberes_imponibles = []
        haberes_no_imponibles = []
        
        # Primero, el Sueldo Base si no está como concepto explícito
        # Buscamos si existe un concepto de sistema para Sueldo Base
        sb_concept = concepts.filter(name__icontains="Sueldo Base", is_system=True).first()
        if not sb_concept:
            # Buscar una cuenta contable apropiada (Gasto de Sueldos/Remuneraciones)
            from accounting.models import Account
            sb_account = Account.objects.filter(name__icontains="Sueldo").first() or \
                         Account.objects.filter(name__icontains="Remuneración").first() or \
                         Account.objects.first()
            
            if not sb_account:
                raise ValidationError(_("No se encontró ninguna cuenta contable para asignar al Sueldo Base. Por favor cree una cuenta primero."))

            sb_concept, _ = PayrollConcept.objects.get_or_create(
                name="Sueldo Base",
                defaults={
                    'category': PayrollConcept.Category.HABER_IMPONIBLE,
                    'is_system': True,
                    'formula_type': PayrollConcept.FormulaType.FIXED,
                    'account': sb_account
                }
            )
        haberes_imponibles.append({'concept': sb_concept, 'amount': sueldo_base_prorrateado})
        context['IMPONIBLE'] = sueldo_base_prorrateado

        # Otros haberes dinámicos o de ficha
        for concept in concepts.filter(category__in=[PayrollConcept.Category.HABER_IMPONIBLE, PayrollConcept.Category.HABER_NO_IMPONIBLE]):
            if concept == sb_concept: continue
            
            amount = Decimal('0')
            if concept.formula_type == PayrollConcept.FormulaType.FIXED:
                amount = concept.default_amount
            elif concept.formula_type == PayrollConcept.FormulaType.EMPLOYEE_SPECIFIC:
                emp_amount = EmployeeConceptAmount.objects.filter(employee=employee, concept=concept).first()
                if emp_amount:
                    amount = emp_amount.amount
            elif concept.formula_type == PayrollConcept.FormulaType.FORMULA:
                amount = PayrollService.evaluate_formula(concept.formula, context)
            
            # Actualizamos contexto si es imponible para que haberes posteriores puedan usarlo
            if amount > 0 and concept.category == PayrollConcept.Category.HABER_IMPONIBLE:
                context['IMPONIBLE'] += amount

            if amount > 0:
                if concept.category == PayrollConcept.Category.HABER_IMPONIBLE:
                    haberes_imponibles.append({'concept': concept, 'amount': amount})
                else:
                    haberes_no_imponibles.append({'concept': concept, 'amount': amount})

        # Calculamos el imponible total para la segunda pasada
        imponible_total = context['IMPONIBLE']
        
        # PASS 2: Descuentos (Legales y Otros)
        descuentos_legales = []
        otros_descuentos = []
        
        for concept in concepts.filter(
            category__in=[
                PayrollConcept.Category.DESCUENTO_LEGAL_TRABAJADOR,
                PayrollConcept.Category.DESCUENTO_LEGAL_EMPLEADOR,
                PayrollConcept.Category.OTRO_DESCUENTO
            ]
        ):
            amount = Decimal('0')
            
            # Lógica estándar de tipos de cálculo
            if concept.formula_type == PayrollConcept.FormulaType.FIXED:
                amount = concept.default_amount
            elif concept.formula_type == PayrollConcept.FormulaType.EMPLOYEE_SPECIFIC:
                emp_amount = EmployeeConceptAmount.objects.filter(employee=employee, concept=concept).first()
                if emp_amount:
                    amount = emp_amount.amount
            elif concept.formula_type == PayrollConcept.FormulaType.FORMULA:
                amount = PayrollService.evaluate_formula(concept.formula, context)
            elif concept.formula_type == PayrollConcept.FormulaType.PERCENTAGE:
                amount = (imponible_total * (concept.default_amount / Decimal('100'))).quantize(Decimal('1'))
            elif concept.formula_type == PayrollConcept.FormulaType.CHILEAN_LAW:
                # Mantenemos por compatibilidad de elección pero sin lógica hardcodeada
                # ya que se espera que usen fórmulas explícitas
                pass

            if amount > 0:
                if concept.category in [PayrollConcept.Category.DESCUENTO_LEGAL_TRABAJADOR, PayrollConcept.Category.DESCUENTO_LEGAL_EMPLEADOR]:
                    descuentos_legales.append({'concept': concept, 'amount': amount})
                else:
                    otros_descuentos.append({'concept': concept, 'amount': amount})

        # PERSISTENCIA: Guardar todos los items
        for item_data in haberes_imponibles + haberes_no_imponibles + descuentos_legales + otros_descuentos:
            PayrollItem.objects.create(
                payroll=payroll,
                concept=item_data['concept'],
                amount=item_data['amount'],
                description=item_data['concept'].name
            )

        # Actualizar totales
        PayrollService.update_payroll_totals(payroll)
        return payroll


def post_payroll(payroll):
    """
    Contabiliza la liquidación usando el asiento de remuneraciones v2.
    """
    from .models import GlobalHRSettings, PayrollItem, Payroll, PayrollConcept
    from accounting.models import JournalEntry, JournalItem
    
    if payroll.status == Payroll.Status.POSTED:
        raise ValidationError(_("La liquidación ya está contabilizada."))
        
    settings, _ = GlobalHRSettings.objects.get_or_create(pk=1)
    
    if not settings.account_remuneraciones_por_pagar or not settings.account_previred_por_pagar:
        raise ValidationError(_("Faltan cuentas globales (Remuneraciones/Previred) por configurar."))
        
    payroll.recalculate_totals()
    employee_name = payroll.employee.contact.name
    period_str = payroll.period_label
    
    with transaction.atomic():
        entry = JournalEntry.objects.create(
            description=f"Centralización Remuneraciones {payroll.display_id} - {employee_name} ({period_str})",
            reference=payroll.display_id,
        )
        
        items = payroll.items.select_related('concept', 'concept__account').all()
        previred_credit = Decimal('0')
        
        for item in items:
            concept = item.concept
            amount = item.amount
            
            if concept.category in [PayrollConcept.Category.HABER_IMPONIBLE, PayrollConcept.Category.HABER_NO_IMPONIBLE]:
                # 1. Haberes -> Gasto (DEBIT)
                if not concept.account:
                    raise ValidationError(_(f"El concepto '{concept.name}' no tiene cuenta de gasto asignada."))
                JournalItem.objects.create(
                    entry=entry, account=concept.account,
                    label=f"{concept.name} - {employee_name}",
                    debit=amount, credit=Decimal('0')
                )
            
            elif concept.category == PayrollConcept.Category.DESCUENTO_LEGAL_EMPLEADOR:
                # 2. Descuento Legal Empleador -> Gasto (DEBIT) y Pasivo Previred (CREDIT)
                if not concept.account:
                    raise ValidationError(_(f"El concepto patronal '{concept.name}' no tiene cuenta de gasto asignada."))
                JournalItem.objects.create(
                    entry=entry, account=concept.account,
                    label=f"Gasto {concept.name} - {employee_name}",
                    debit=amount, credit=Decimal('0')
                )
                previred_credit += amount
            
            elif concept.category == PayrollConcept.Category.DESCUENTO_LEGAL_TRABAJADOR:
                # 3. Descuento Legal Trabajador -> Pasivo Previred (CREDIT)
                # No genera gasto extra porque ya está en el Bruto (Haberes) que ya se debitó
                previred_credit += amount
            
            elif concept.category == PayrollConcept.Category.OTRO_DESCUENTO:
                # 4. Otros descuentos (como Anticipos) -> Haber (CREDIT)
                if not concept.account:
                    raise ValidationError(_(f"El concepto '{concept.name}' no tiene cuenta contable (ej. Anticipos) asignada."))
                JournalItem.objects.create(
                    entry=entry, account=concept.account,
                    label=f"{concept.name} - {employee_name}",
                    debit=Decimal('0'), credit=amount
                )
        
        # 5. Pasivo Consolidado Previred (CREDIT)
        if previred_credit > 0:
            JournalItem.objects.create(
                entry=entry, account=settings.account_previred_por_pagar,
                label=f"Obligaciones Previred - {employee_name}",
                debit=Decimal('0'), credit=previred_credit
            )
            
        # 6. Rebaja de Anticipos (CREDIT) y Ajuste de Remuneraciones por Pagar
        # Si hay anticipos asociados, debemos rebajarlos de la cuenta de Anticipos (Activo)
        # y el saldo a Remuneraciones por Pagar será el Neto - Anticipos.
        total_advances = Decimal('0')
        advances = payroll.advances.all()
        for adv in advances:
            total_advances += adv.amount
            if settings.account_anticipos:
                JournalItem.objects.create(
                    entry=entry, account=settings.account_anticipos,
                    label=f"Rebaja Anticipo {adv.date} - {employee_name}",
                    debit=Decimal('0'), credit=adv.amount
                )
            adv.is_discounted = True
            adv.save(update_fields=['is_discounted'])

        # 7. Pasivo Sueldo Líquido Ajustado (CREDIT)
        # El sueldo líquido ya tiene los descuentos aplicados, pero el asiento contable
        # debe reflejar que una parte ya se pagó (Anticipos) y el resto queda por pagar.
        rem_por_pagar = payroll.net_salary - total_advances
        
        JournalItem.objects.create(
            entry=entry, account=settings.account_remuneraciones_por_pagar,
            label=f"Remuneraciones por Pagar (Saldo) - {employee_name}",
            debit=Decimal('0'), credit=rem_por_pagar
        )
        
        entry.check_balance()
        entry.status = JournalEntry.State.POSTED
        entry.save()
        
        payroll.journal_entry = entry
        payroll.status = Payroll.Status.POSTED
        payroll.save()
        
    return payroll
