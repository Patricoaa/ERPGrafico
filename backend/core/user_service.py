class UserServiceExt:
    @staticmethod
    def get_my_profile_data(user):
        from .serializers import UserSerializer
        from hr.serializers import ContactMiniSerializer, EmployeeSerializer, PayrollListSerializer, PayrollPaymentSerializer, SalaryAdvanceSerializer
        from hr.models import Employee, Payroll, SalaryAdvance, PayrollPayment
        res = {'user': UserSerializer(user).data, 'contact_detail': None, 'employee': None, 'payrolls': [], 'advances': [], 'payments': []}
        if user.contact:
            res['contact_detail'] = ContactMiniSerializer(user.contact).data
            emp = Employee.objects.filter(contact=user.contact).select_related('contact', 'afp').first()
            if emp:
                res['employee'] = EmployeeSerializer(emp).data
                payrolls = Payroll.objects.filter(employee=emp, status=Payroll.Status.POSTED).select_related('employee', 'employee__contact', 'journal_entry', 'previred_journal_entry').prefetch_related('items', 'items__concept', 'advances', 'payments').order_by('-period_year', '-period_month')
                res['payrolls'] = PayrollListSerializer(payrolls, many=True).data
                advances = SalaryAdvance.objects.filter(employee=emp).select_related('employee', 'employee__contact', 'payroll').order_by('-date')
                res['advances'] = SalaryAdvanceSerializer(advances, many=True).data
                payments = PayrollPayment.objects.filter(payroll__employee=emp).select_related('payroll', 'payroll__employee', 'payroll__employee__contact').order_by('-date')
                res['payments'] = PayrollPaymentSerializer(payments, many=True).data
        return res

    @staticmethod
    def change_password_from_request(request):
        from .user_services import UserService
        from rest_framework.exceptions import ValidationError
        cur = request.data.get('current_password', '')
        new = request.data.get('new_password', '')
        if not cur or not new: raise ValidationError('Debe proporcionar la contraseña actual y la nueva contraseña.')
        if not request.user.check_password(cur): raise ValidationError('La contraseña actual es incorrecta.')
        if len(new) < 6: raise ValidationError('La nueva contraseña debe tener al menos 6 caracteres.')
        UserService.change_password(user=request.user, new_password=new, request=request)
        return {'detail': 'Contraseña actualizada exitosamente.'}

    @staticmethod
    def change_pin_from_request(request):
        from .user_services import UserService
        from rest_framework.exceptions import ValidationError
        cur = request.data.get('current_password', '')
        pin = request.data.get('new_pin', '')
        if not cur or not pin: raise ValidationError('Debe proporcionar la contraseña actual y el nuevo PIN.')
        if not request.user.check_password(cur): raise ValidationError('La contraseña actual es incorrecta.')
        if not pin.isdigit() or len(pin) > 4: raise ValidationError('El PIN debe ser numérico y tener un máximo de 4 dígitos.')
        UserService.change_pin(user=request.user, new_pin=pin, request=request)
        return {'detail': 'PIN de POS actualizado exitosamente.'}
