from rest_framework import serializers

class PayrollValidator:
    @staticmethod
    def validate_payroll(instance, data):
        from .models import Payroll
        emp, py, pm = data.get('employee'), data.get('period_year'), data.get('period_month')
        if instance:
            emp = emp or instance.employee
            py = py or instance.period_year
            pm = pm or instance.period_month
        qs = Payroll.objects.filter(employee=emp, period_year=py, period_month=pm)
        if instance: qs = qs.exclude(pk=instance.pk)
        if qs.exists(): raise serializers.ValidationError({'detail': f'Ya existe liquidación para {emp.contact.name} en {pm}/{py}.'})
        return data
