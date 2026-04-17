from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver


@receiver(pre_save, sender='treasury.PaymentTerminalProvider')
def _capture_provider_previous_bridge(sender, instance, **kwargs):
    """Captura bank_treasury_account anterior para detectar cambio en post_save."""
    if instance.pk:
        try:
            from treasury.models import PaymentTerminalProvider
            prev = PaymentTerminalProvider.objects.filter(pk=instance.pk).values_list(
                'bank_treasury_account_id', flat=True
            ).first()
            instance._prev_bridge_id = prev
        except Exception:
            instance._prev_bridge_id = None
    else:
        instance._prev_bridge_id = None


@receiver(post_save, sender='treasury.PaymentTerminalProvider')
def sync_settlement_on_provider_bridge_change(sender, instance, **kwargs):
    """
    Cuando cambia PaymentTerminalProvider.bank_treasury_account,
    propagar la nueva cuenta puente a todos los PaymentMethod CARD_TERMINAL
    vinculados a dispositivos de este proveedor.

    Esto mantiene el invariante: settlement_account del método = cuenta puente del proveedor.
    """
    prev_bridge_id = getattr(instance, '_prev_bridge_id', None)
    new_bridge = instance.bank_treasury_account

    if new_bridge is None:
        return
    if prev_bridge_id == new_bridge.pk:
        return  # Sin cambio

    from treasury.models import PaymentMethod
    affected = PaymentMethod.objects.filter(
        method_type=PaymentMethod.Type.CARD_TERMINAL,
        linked_terminal_device__provider=instance,
    )
    # Usar update() directo para evitar clean() que re-validaría en loop
    affected.update(settlement_account=new_bridge)


@receiver(post_save, sender='treasury.POSTerminal')
def sync_card_terminal_payment_method(sender, instance, **kwargs):
    """
    Auto-crea un PaymentMethod de tipo CARD_TERMINAL cuando una caja POS
    se vincula a un PaymentTerminalDevice (maquinita TUU).

    - Si se vincula un device → crea o reactiva el método CARD_TERMINAL.
    - Si se desvincula el device → desactiva el método CARD_TERMINAL asociado.
    - El método auto-creado se agrega a allowed_payment_methods de la caja.
    """
    from treasury.models import PaymentMethod

    if not instance.payment_terminal_device_id:
        # Device desvinculado → desactivar métodos CARD_TERMINAL de esta caja
        stale = PaymentMethod.objects.filter(
            method_type=PaymentMethod.Type.CARD_TERMINAL,
            linked_terminal_device__pos_terminals=instance,
        )
        stale.update(is_active=False)
        return

    # Hacer select_related para evitar N+1 queries
    from treasury.models import PaymentTerminalDevice
    device = (
        PaymentTerminalDevice.objects
        .select_related('provider__bank_treasury_account')
        .get(pk=instance.payment_terminal_device_id)
    )

    # Usar la cuenta puente del proveedor ("Cuenta Destino Liquidación").
    # Los pagos con tarjeta no van a la caja de efectivo — van al bridge account
    # del proveedor TUU, que se reconcilia con el TerminalBatch posterior.
    provider = device.provider if device.provider_id else None
    treasury_account = provider.bank_treasury_account if provider else None
    if not treasury_account:
        # Sin cuenta puente configurada en el proveedor no podemos crear el método
        return

    method, created = PaymentMethod.objects.get_or_create(
        method_type=PaymentMethod.Type.CARD_TERMINAL,
        linked_terminal_device=device,
        defaults={
            'name': f'Tarjeta — {device.name}',
            'treasury_account': treasury_account,
            'allow_for_sales': True,
            'allow_for_purchases': False,
            'is_active': True,
        },
    )

    if not created and not method.is_active:
        method.is_active = True
        method.save(update_fields=['is_active'])

    # Asegurar que el método está en allowed_payment_methods de la caja
    instance.allowed_payment_methods.add(method)
