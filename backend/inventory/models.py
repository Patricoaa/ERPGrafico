from django.utils import timezone
from django.db import models
from django.contrib.contenttypes.fields import GenericRelation
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator
from simple_history.models import HistoricalRecords
from accounting.models import Account, AccountType
from core.validators import validate_file_size, validate_image_extension
from core.utils import generic_upload_path, get_current_date


class ProductCategory(models.Model):
    name = models.CharField(_("Nombre"), max_length=100)
    prefix = models.CharField(_("Prefijo"), max_length=10, null=True, blank=True, help_text=_("Usado para generar el código interno (ej: IMP, DIS)"))
    icon = models.CharField(_("Icono"), max_length=50, null=True, blank=True, help_text=_("Nombre del icono de Lucide (ej: Package, Coffee)"))
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children')
    
    # Default Accounting Config for this category
    asset_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='category_assets',
        limit_choices_to={'account_type': AccountType.ASSET}
    )
    income_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='category_incomes',
        limit_choices_to={'account_type': AccountType.INCOME}
    )
    expense_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='category_expenses',
        limit_choices_to={'account_type': AccountType.EXPENSE}
    )

    class Meta:
        verbose_name = _("Categoría de Producto")
        verbose_name_plural = _("Categorías de Producto")
        ordering = ['-id']

    def __str__(self):
        return self.name

class UoMCategory(models.Model):
    name = models.CharField(_("Nombre"), max_length=100)
    
    class Meta:
        verbose_name = _("Categoría de Medida")
        verbose_name_plural = _("Categorías de Medida")
        ordering = ['-id']

    def __str__(self):
        return self.name

class UoM(models.Model):
    class Type(models.TextChoices):
        REFERENCE = 'REFERENCE', _('Referencia para esta categoría')
        BIGGER = 'BIGGER', _('Más grande que la referencia')
        SMALLER = 'SMALLER', _('Más pequeño que la referencia')

    name = models.CharField(_("Nombre"), max_length=100)
    category = models.ForeignKey(UoMCategory, on_delete=models.CASCADE, related_name='uoms')
    uom_type = models.CharField(_("Tipo"), max_length=20, choices=Type.choices, default=Type.REFERENCE)
    ratio = models.DecimalField(_("Ratio"), max_digits=12, decimal_places=5, default=1.0)
    rounding = models.DecimalField(_("Redondeo"), max_digits=12, decimal_places=5, default=0.01000)
    active = models.BooleanField(default=True)
    
    class Meta:
        verbose_name = _("Unidad de Medida")
        verbose_name_plural = _("Unidades de Medida")
        ordering = ['-id']

    def __str__(self):
        return self.name

class ProductAttribute(models.Model):
    """Atributo maestro (ej: Color, Talla)"""
    name = models.CharField(_("Nombre"), max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("Atributo de Producto")
        verbose_name_plural = _("Atributos de Producto")
        ordering = ['name']

    def __str__(self):
        return self.name

class ProductAttributeValue(models.Model):
    """Valor específico de un atributo (ej: Rojo, XL)"""
    attribute = models.ForeignKey(ProductAttribute, on_delete=models.CASCADE, related_name='values')
    value = models.CharField(_("Valor"), max_length=100)

    class Meta:
        verbose_name = _("Valor de Atributo")
        verbose_name_plural = _("Valores de Atributo")
        unique_together = ['attribute', 'value']

    def __str__(self):
        return f"{self.attribute.name}: {self.value}"

class Product(models.Model):
    class Type(models.TextChoices):
        CONSUMABLE = 'CONSUMABLE', _('Consumible')
        STORABLE = 'STORABLE', _('Almacenable')
        MANUFACTURABLE = 'MANUFACTURABLE', _('Fabricable')
        SERVICE = 'SERVICE', _('Servicio (Único)')
        SUBSCRIPTION = 'SUBSCRIPTION', _('Suscripción (Recurrente)')

    internal_code = models.CharField(_("Código Interno"), max_length=50, unique=True, editable=False, null=True, blank=True)
    code = models.CharField(_("Código/SKU"), max_length=50, unique=True, null=True, blank=True)
    name = models.CharField(_("Nombre"), max_length=255)
    category = models.ForeignKey(ProductCategory, on_delete=models.PROTECT, related_name='products')
    product_type = models.CharField(_("Tipo"), max_length=30, choices=Type.choices, default=Type.STORABLE)
    image = models.ImageField(
        _("Imagen"), 
        upload_to=generic_upload_path('products/'), 
        null=True, blank=True,
        validators=[validate_file_size, validate_image_extension]
    )

    # Variants Integration
    has_variants = models.BooleanField(
        _("Tiene Variantes"),
        default=False,
        help_text=_("Indica si este producto actúa como plantilla para múltiples variantes.")
    )
    parent_template = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='variants',
        verbose_name=_("Plantilla Padre"),
        help_text=_("Si está definido, este producto es una variante de la plantilla seleccionada.")
    )
    attribute_values = models.ManyToManyField(
        ProductAttributeValue,
        blank=True,
        related_name='products',
        verbose_name=_("Valores de Atributos"),
        help_text=_("Valores que definen esta variante (ej: Color Rojo, Talla L)")
    )
    variant_display_name = models.CharField(
        _("Nombre de Variante"),
        max_length=255,
        null=True, blank=True,
        help_text=_("Nombre descriptivo para esta variante específica. Si se deja vacío, se generará automáticamente.")
    )

    attachments = GenericRelation('core.Attachment')
    history = HistoricalRecords()
    
    # Custom Fields Schema for MANUFACTURABLE_CUSTOM
    custom_fields_schema = models.JSONField(
        _("Esquema de Campos Customizados"),
        null=True, blank=True,
        help_text=_("Define campos adicionales requeridos al vender (ej: tamaño, copias, folio inicial)")
    )
    
    # Manufacturing Configuration (for MANUFACTURABLE_STANDARD)
    has_bom = models.BooleanField(
        _("Tiene Lista de Materiales"),
        default=False,
        help_text=_("Indica si este producto tiene componentes definidos que se asignarán a órdenes de trabajo")
    )
    requires_advanced_manufacturing = models.BooleanField(
        _("Requiere Fabricación Avanzada"),
        default=False,
        help_text=_("Habilita campos personalizados al vender este producto desde POS o notas de venta")
    )
    mfg_auto_finalize = models.BooleanField(
        _("Finalizar Automáticamente"),
        default=False,
        help_text=_("Si se activa, la OT se marcará como Terminada automáticamente al generarse (Flujo Express)")
    )
    
    # Print Shop Workflow - Stage Enablers
    mfg_enable_prepress = models.BooleanField(
        _("Habilitar Pre-Impresión"),
        default=False,
        help_text=_("Activa la etapa de pre-impresión en el flujo de fabricación")
    )
    mfg_enable_press = models.BooleanField(
        _("Habilitar Impresión"),
        default=False,
        help_text=_("Activa la etapa de impresión en el flujo de fabricación")
    )
    mfg_enable_postpress = models.BooleanField(
        _("Habilitar Post-Impresión"),
        default=False,
        help_text=_("Activa la etapa de post-impresión en el flujo de fabricación")
    )
    
    # Pre-Press Options
    mfg_prepress_design = models.BooleanField(
        _("Pre-Impresión: Diseño Requerido"),
        default=False,
        help_text=_("Solicitar diseño en la etapa de pre-impresión")
    )
    mfg_prepress_specs = models.BooleanField(
        _("Pre-Impresión: Especificaciones"),
        default=False,
        help_text=_("Solicitar especificaciones en la etapa de pre-impresión")
    )
    mfg_prepress_folio = models.BooleanField(
        _("Pre-Impresión: Folio"),
        default=False,
        help_text=_("Solicitar folio en la etapa de pre-impresión")
    )
    
    # Press Options
    mfg_press_offset = models.BooleanField(
        _("Impresión: Offset"),
        default=False,
        help_text=_("Solicitar información de impresión offset")
    )
    mfg_press_digital = models.BooleanField(
        _("Impresión: Digital"),
        default=False,
        help_text=_("Solicitar información de impresión digital")
    )
    mfg_press_special = models.BooleanField(
        _("Impresión: Especial"),
        default=False,
        help_text=_("Solicitar información de impresión especial")
    )
    
    # Post-Press Options
    mfg_postpress_finishing = models.BooleanField(
        _("Post-Impresión: Acabados"),
        default=False,
        help_text=_("Solicitar información de acabados")
    )
    mfg_postpress_binding = models.BooleanField(
        _("Post-Impresión: Encuadernación/Troquelado"),
        default=False,
        help_text=_("Solicitar información de encuadernación o troquelado")
    )
    
    # Delivery Configuration
    mfg_default_delivery_days = models.IntegerField(
        _("Días de Entrega por Defecto"),
        default=3,
        help_text=_("Días a sumar a la fecha actual para la fecha estimada de entrega")
    )

    # Subscription / Recurrence Configuration
    class RecurrencePeriod(models.TextChoices):
        MONTHLY = 'MONTHLY', _('Mensual')
        QUARTERLY = 'QUARTERLY', _('Trimestral')
        SEMIANNUAL = 'SEMIANNUAL', _('Semestral')
        ANNUAL = 'ANNUAL', _('Anual')
        WEEKLY = 'WEEKLY', _('Semanal')

    recurrence_period = models.CharField(
        _("Período de Recurrencia"),
        max_length=20,
        choices=RecurrencePeriod.choices,
        null=True, blank=True,
        help_text=_("Frecuencia de facturación/renovación para productos de tipo Suscripción")
    )
    renewal_notice_days = models.PositiveIntegerField(
        _("Días de Aviso Renovación"), 
        default=30,
        help_text=_("Días de anticipación para avisar sobre la renovación del servicio")
    )
    is_variable_amount = models.BooleanField(
        _("Monto Variable"),
        default=False,
        help_text=_("Indica si el costo mensual varía (ej: luz, agua)")
    )
    
    # Payment Day Configuration
    class PaymentDayType(models.TextChoices):
        INTERVAL = 'INTERVAL', _('Cada N días')
        FIXED_DAY = 'FIXED_DAY', _('Día fijo del mes')
    
    payment_day_type = models.CharField(
        _("Tipo de Fecha de Pago"),
        max_length=20,
        choices=PaymentDayType.choices,
        null=True, blank=True,
        help_text=_("Define si el pago es cada N días o un día fijo del mes")
    )
    payment_day = models.PositiveIntegerField(
        _("Día de Pago"),
        null=True, blank=True,
        help_text=_("Día del mes para pago (1-31). Solo aplica si payment_day_type es FIXED_DAY")
    )
    payment_interval_days = models.PositiveIntegerField(
        _("Intervalo de Días"),
        null=True, blank=True,
        help_text=_("Cantidad de días entre pagos. Solo aplica si payment_day_type es INTERVAL")
    )
    
    # Invoice Configuration
    class DefaultInvoiceType(models.TextChoices):
        FACTURA = 'FACTURA', _('Factura')
        BOLETA = 'BOLETA', _('Boleta')
    
    default_invoice_type = models.CharField(
        _("Tipo de Documento por Defecto"),
        max_length=20,
        choices=DefaultInvoiceType.choices,
        null=True, blank=True,
        help_text=_("Tipo de documento a usar en renovaciones automáticas")
    )
    
    # Direct Activation Fields
    subscription_supplier = models.ForeignKey(
        'contacts.Contact',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='subscription_products',
        verbose_name=_("Proveedor de Suscripción"),
        help_text=_("Proveedor para activar la suscripción automáticamente")
    )
    subscription_amount = models.DecimalField(
        _("Monto de Suscripción"),
        max_digits=12,
        decimal_places=0,
        null=True, blank=True,
        validators=[MinValueValidator(0)],
        help_text=_("Monto mensual/periódico de la suscripción")
    )
    subscription_start_date = models.DateField(
        _("Fecha de Inicio"),
        null=True, blank=True,
        help_text=_("Fecha de inicio de la suscripción (default: hoy)")
    )
    auto_activate_subscription = models.BooleanField(
        _("Activar Suscripción Automáticamente"),
        default=False,
        help_text=_("Si está activo, crea el registro de suscripción al guardar el producto")
    )
    
    # Contract Duration
    is_indefinite = models.BooleanField(
        _("Suscripción Indefinida"),
        default=True,
        help_text=_("Si está activo, la suscripción no tiene fecha de finalización")
    )
    contract_end_date = models.DateField(
        _("Fecha de Finalización del Contrato"),
        null=True, blank=True,
        help_text=_("Fecha en que finaliza el contrato (solo si no es indefinida)")
    )
    
    
    # Inventory Tracking Control
    track_inventory = models.BooleanField(
        _("Controlar Stock"),
        default=True,
        help_text=_("Desactivar para productos que no requieren control de inventario (fabricables, servicios)")
    )
    
    # Availability Control
    can_be_sold = models.BooleanField(
        _("Puede ser vendido"),
        default=True,
        help_text=_("Si se desactiva, el producto no aparecerá en ventas ni en POS.")
    )
    can_be_purchased = models.BooleanField(
        _("Puede ser comprado"),
        default=True,
        help_text=_("Si se desactiva, el producto no aparecerá en órdenes de compra.")
    )
    
    # Units of Measure
    uom = models.ForeignKey(
        UoM, on_delete=models.PROTECT, related_name='products',
        verbose_name=_("Unidad de Medida Base"), 
        null=True, blank=True,
        help_text=_("Unidad base para gestión de stock. Todas las conversiones se hacen a esta unidad.")
    )
    
    # DEPRECATED FIELDS - Mantener por compatibilidad
    sale_uom = models.ForeignKey(
        UoM, on_delete=models.PROTECT, related_name='products_sale',
        verbose_name=_("UdM Venta (DEPRECATED)"),
        null=True, blank=True,
        help_text=_("⚠️ DEPRECATED: Use 'allowed_sale_uoms' en su lugar. Este campo se mantendrá solo para compatibilidad.")
    )
    purchase_uom = models.ForeignKey(
        UoM, on_delete=models.SET_NULL, related_name='products_purchase',
        verbose_name=_("UdM Compra por Defecto"), 
        null=True, blank=True,
        help_text=_("Unidad sugerida automáticamente al agregar este producto a una orden de compra.")
    )

    allowed_sale_uoms = models.ManyToManyField(
        UoM, related_name='allowed_sale_products',
        blank=True,
        verbose_name=_("Unidades de Venta Permitidas"),
        help_text=_("Unidades de medida permitidas para la venta de este producto (además de la unidad base).")
    )

    receiving_warehouse = models.ForeignKey(
        'Warehouse', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='receiving_products',
        verbose_name=_("Bodega de Recepción por Defecto"),
        help_text=_("Bodega sugerida automáticamente al recibir este producto.")
    )

    preferred_supplier = models.ForeignKey(
        'contacts.Contact',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='preferred_products',
        verbose_name=_("Proveedor Preferido"),
        help_text=_("Proveedor sugerido para reabastecimiento y órdenes de compra.")
    )

    is_dynamic_pricing = models.BooleanField(
        _("Precio Gestionable"),
        default=False,
        help_text=_("Permite asignar el precio manualmente al vender (ignora precio de lista).")
    )
    sale_price = models.DecimalField(
        _("Precio Venta NETO"), 
        max_digits=12, 
        decimal_places=0, 
        default=0, 
        validators=[MinValueValidator(0)],
        help_text=_("Precio de venta sin IVA (referencia)")
    )
    sale_price_gross = models.DecimalField(
        _("Precio Venta BRUTO (c/IVA)"),
        max_digits=12,
        decimal_places=0,
        default=0,
        validators=[MinValueValidator(0)],
        help_text=_("Precio con IVA incluido, usado para cálculos de venta")
    )
    cost_price = models.DecimalField(_("Costo Ponderado"), max_digits=12, decimal_places=0, default=0, editable=False)
    
    # Accounting Overrides
    income_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='product_incomes',
        limit_choices_to={'account_type': AccountType.INCOME},
        verbose_name=_("Cuenta de Ingresos (Personalizada)"),
        help_text=_("Sobreescribe la cuenta de la categoría para este producto.")
    )
    expense_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='product_expenses',
        limit_choices_to={'account_type': AccountType.EXPENSE},
        verbose_name=_("Cuenta de Gastos (Personalizada)"),
        help_text=_("Sobreescribe la cuenta de la categoría para este producto.")
    )

    active = models.BooleanField(_("Activo"), default=True, help_text=_("Desactivar para archivar el producto en lugar de eliminarlo."))

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("Producto")
        verbose_name_plural = _("Productos")
        ordering = ['-id']

    def __str__(self):
        return f"{self.internal_code} - {self.name}"

    def save(self, *args, **kwargs):
        if self.code == "" or (isinstance(self.code, str) and not self.code.strip()):
            self.code = None

        # Logic for track_inventory is now handled by the frontend/API.
        # We default to True for STORABLE if not specified, otherwise respect input.
        if self.pk is None and self.track_inventory is None:
             self.track_inventory = (self.product_type == self.Type.STORABLE)
            
        # Fallback for base UoM if missing but others are present
        if not self.uom:
            if self.sale_uom:
                self.uom = self.sale_uom
            elif self.purchase_uom:
                self.uom = self.purchase_uom
 
        if not self.internal_code:
            prefix = self.category.prefix or "PROD"
            # More robust sequence generation: 
            # 1. Filter products whose internal_code follows the pattern PREFIX-####
            import re
            pattern = rf"^{re.escape(prefix)}-\d+$"
            
            # Find all products with this category and prefix-like codes
            # We fetch all candidates to ensure we don't collide with non-standard codes
            candidates = Product.objects.filter(internal_code__startswith=f"{prefix}-")
            max_num = 0
            
            for p in candidates:
                if p.internal_code and re.match(pattern, p.internal_code):
                    try:
                        num_part = p.internal_code.split('-')[-1]
                        max_num = max(max_num, int(num_part))
                    except (ValueError, IndexError):
                        continue
            
            new_num = str(max_num + 1).zfill(4)
            self.internal_code = f"{prefix}-{new_num}"

        # Synchronize Net and Gross prices
        from decimal import Decimal
        vat_rate = Decimal('1.19')
        
        if self.pk:
            old_instance = Product.objects.get(pk=self.pk)
            # If Net changed, update Gross
            if self.sale_price != old_instance.sale_price:
                self.sale_price_gross = (self.sale_price * vat_rate).quantize(Decimal('1'), rounding='ROUND_HALF_UP')
            # If Gross changed, update Net
            elif self.sale_price_gross != old_instance.sale_price_gross:
                self.sale_price = (self.sale_price_gross / vat_rate).quantize(Decimal('1'), rounding='ROUND_HALF_UP')
        else:
            # New product: ensure Gross is set if only Net is provided, or vice versa
            if self.sale_price and not self.sale_price_gross:
                self.sale_price_gross = (self.sale_price * vat_rate).quantize(Decimal('1'), rounding='ROUND_HALF_UP')
            elif self.sale_price_gross and not self.sale_price:
                self.sale_price = (self.sale_price_gross / vat_rate).quantize(Decimal('1'), rounding='ROUND_HALF_UP')

        # Compress image if added/changed
        if self.image:
            try:
                is_new_image = False
                if not self.pk:
                    is_new_image = True
                else:
                    old_product = Product.objects.filter(pk=self.pk).first()
                    if old_product and old_product.image != self.image:
                        is_new_image = True
                
                if is_new_image:
                    from core.utils import compress_image
                    compressed = compress_image(self.image)
                    if compressed:
                        self.image = compressed
            except Exception as e:
                print(f"Image compression warning: {str(e)}")

        # Variant Restrictions & Logic
        if self.has_variants:
            # Only allow Express or Advanced manufacturing types to have variants
            # Express: mfg_auto_finalize=True
            # Advanced: requires_advanced_manufacturing=True
            is_valid_type = (
                self.product_type == self.Type.MANUFACTURABLE and 
                (self.mfg_auto_finalize or self.requires_advanced_manufacturing)
            )
            if not is_valid_type:
                # If it's not a valid type, force has_variants to False
                self.has_variants = False

        # Automatic variant display name generation if empty
        if self.parent_template and not self.variant_display_name:
            # We can't access ManyToMany (attribute_values) before saving for the first time
            # So if it's already saved, we can try to build it
            if self.pk:
                attrs = ", ".join([str(v.value) for v in self.attribute_values.all()])
                if attrs:
                    self.variant_display_name = f"{self.parent_template.name} ({attrs})"
                else:
                    self.variant_display_name = self.parent_template.name
            else:
                self.variant_display_name = f"{self.parent_template.name} (Variante)"

        # BOM Requirement for Express Products
        # Express products (mfg_auto_finalize=True) without variants MUST have a BOM
        if self.mfg_auto_finalize and not self.has_variants and not self.parent_template:
            self.has_bom = True

        super().save(*args, **kwargs)

    # BOM-related helpers
    @property
    def is_express_variant(self):
        """Check if this is an Express variant (has parent and is Express)."""
        return self.parent_template is not None and self.mfg_auto_finalize

    def has_active_bom(self):
        """Check if this product has an active BOM assigned."""
        if hasattr(self, '_prefetched_objects_cache') and 'boms' in self._prefetched_objects_cache:
            return any(bom.active for bom in self.boms.all())
        return self.boms.filter(active=True).exists()

    @property
    def requires_bom_validation(self):
        """
        Express products/variants require a BOM.
        Returns True if this product should have a BOM but doesn't.
        """
        # Only Express products (auto-finalize) require BOM validation
        if not self.mfg_auto_finalize:
            return False
        
        # Templates with variants don't need their own BOM
        if self.has_variants:
            return False
            
        # Express products and variants without an active BOM need validation
        return not self.has_active_bom()

    # Helpers to get effective accounts (Product override > Category > Type-based > Fallback)
    @property
    def get_asset_account(self):
        """
        Returns the asset account for this product.
        Priority:
        1. Category-specific account (allows customization)
        2. Type-specific account from settings
        3. General inventory account (fallback)
        """
        from accounting.models import AccountingSettings
        
        # 1. Category override (highest priority)
        if self.category and self.category.asset_account:
            return self.category.asset_account
        
        # 2. Type-based account from settings
        settings = AccountingSettings.objects.first()
        if not settings:
            return None
        
        if self.product_type == self.Type.STORABLE:
            return (settings.storable_inventory_account or 
                    settings.default_inventory_account)
        
        elif self.product_type == self.Type.MANUFACTURABLE:
            return (settings.manufacturable_inventory_account or 
                    settings.default_inventory_account)
        
        elif self.product_type == self.Type.CONSUMABLE:
            return settings.default_consumable_account
        
        elif self.product_type in [self.Type.SERVICE, self.Type.SUBSCRIPTION]:
            return None
        
        return None
    
    @property
    def get_income_account(self):
        """
        Returns the income account for this product.
        Priority:
        1. Product-specific override
        2. Category-specific account
        3. Type-specific account from settings
        4. General revenue account (fallback)
        """
        if self.income_account:
            return self.income_account
        if self.category and self.category.income_account:
            return self.category.income_account
            
        from accounting.models import AccountingSettings
        settings = AccountingSettings.objects.first()
        if not settings:
            return None
            
        if self.product_type == self.Type.SERVICE:
            return settings.default_service_revenue_account or settings.default_revenue_account
        elif self.product_type == self.Type.SUBSCRIPTION:
            return settings.default_subscription_revenue_account or settings.default_revenue_account
            
        return settings.default_revenue_account

    @property
    def get_expense_account(self):
        """
        Returns the expense/cost account for this product.
        Priority:
        1. Product-specific override
        2. Category-specific account
        3. Type-specific account from settings
        4. General expense account (fallback)
        """
        if self.expense_account:
            return self.expense_account
        if self.category and self.category.expense_account:
            return self.category.expense_account
            
        from accounting.models import AccountingSettings
        settings = AccountingSettings.objects.first()
        if not settings:
            return None
            
        if self.product_type == self.Type.SERVICE:
            return settings.default_service_expense_account or settings.default_expense_account
        elif self.product_type == self.Type.SUBSCRIPTION:
            return settings.default_subscription_expense_account or settings.default_expense_account
        elif self.product_type == self.Type.CONSUMABLE:
            return settings.default_consumable_account or settings.default_expense_account
        elif self.product_type == self.Type.MANUFACTURABLE:
            return settings.manufactured_cogs_account or settings.default_expense_account
        elif self.product_type == self.Type.STORABLE:
            return settings.merchandise_cogs_account or settings.default_expense_account
            
        return settings.default_expense_account
    
    def get_allowed_sale_uoms(self):
        """
        Retorna QuerySet de UoMs permitidos para venta.
        Usa UoMService para obtener base + allowed_sale_uoms.
        """
        from inventory.services import UoMService
        return UoMService.get_allowed_uoms_for_context(self, 'sale')

    def get_bom_cost(self):
        """
        Calculates the total cost of materials from the active BOM.
        Returns Decimal('0.00') if no active BOM or no lines.
        """
        from production.models import BillOfMaterials
        from inventory.services import UoMService
        from decimal import Decimal

        # Use prefetched BOMs if available
        if hasattr(self, '_prefetched_objects_cache') and 'boms' in self._prefetched_objects_cache:
            active_bom = next((bom for bom in self.boms.all() if bom.active), None)
        else:
            active_bom = BillOfMaterials.objects.filter(product=self, active=True).first()

        if not active_bom:
            return Decimal('0.00')
        
        total_bom_cost = Decimal('0.00')
        # Use prefetched lines if available
        lines = active_bom.lines.all()
        for line in lines:
            qty = line.quantity
            # Convert quantity from BOM Line UoM to Component Base UoM if they differ
            if line.uom and line.component.uom and line.uom != line.component.uom:
                try:
                    qty = UoMService.convert_quantity(line.quantity, line.uom, line.component.uom)
                except Exception:
                    pass

            # Use component's cost_price (weighted average)
            total_bom_cost += qty * line.component.cost_price
            
        return total_bom_cost

    def get_manufacturable_quantity(self):
        """
        Calculate how many units of this product can be manufactured
        based on available component stock.
        Returns None if product is not MANUFACTURABLE or has no active BOM.
        Returns float for the maximum manufacturable quantity.
        """
        if self.product_type != self.Type.MANUFACTURABLE:
            return None
        
        # Get active BOM
        from production.models import BillOfMaterials
        if hasattr(self, '_prefetched_objects_cache') and 'boms' in self._prefetched_objects_cache:
            active_bom = next((bom for bom in self.boms.all() if bom.active), None)
        else:
            active_bom = BillOfMaterials.objects.filter(product=self, active=True).first()
        
        # If no active BOM, treat as "Available" (no constraints)
        if not active_bom or not active_bom.lines.exists():
            return None
        
        # Calculate available quantity for each component
        from django.db.models import Sum
        min_manufacturable = float('inf')
        
        for line in active_bom.lines.all():
            component = line.component
            required_qty = float(line.quantity)
            
            if required_qty <= 0:
                continue
            
            # Get component's current stock (in Base UoM)
            # Use annotated stock if available on the component
            if hasattr(component, 'annotated_current_stock'):
                component_stock = float(component.annotated_current_stock or 0.0)
            else:
                component_stock = component.stock_moves.aggregate(total=Sum('quantity'))['total'] or 0.0
                component_stock = float(component_stock)
            
            # Unit Conversion Logic using UoMService
            # We need to express "required_qty" (which is in line.uom) into Component Base UoM
            required_qty_in_base = required_qty
            
            if line.uom and component.uom:
                if line.uom != component.uom:
                    try:
                        from inventory.services import UoMService
                        from decimal import Decimal
                        from django.core.exceptions import ValidationError
                        required_qty_in_base = float(
                            UoMService.convert_quantity(
                                Decimal(str(required_qty)),
                                line.uom,
                                component.uom
                            )
                        )
                    except (ValidationError, ValueError):
                        # Incompatible categories, skip this component
                        continue
            
            if required_qty_in_base <= 0:
                 continue

            # Calculate how many units we can make with this component
            available_units = component_stock / required_qty_in_base
            
            # Track the minimum (bottleneck component)
            min_manufacturable = min(min_manufacturable, available_units)
        
        # If no valid components found, return 0
        if min_manufacturable == float('inf'):
            return 0.0
        
        # Return floor value (can't manufacture partial units)
        import math
        return math.floor(min_manufacturable)

    @property
    def qty_on_hand(self):
        """Current physical stock (sum of all moves)."""
        if hasattr(self, 'annotated_current_stock'):
            from decimal import Decimal
            return Decimal(str(self.annotated_current_stock or 0.0))
            
        from django.db.models import Sum
        from decimal import Decimal
        return self.stock_moves.aggregate(total=Sum('quantity'))['total'] or Decimal('0.0')

    @property
    def qty_reserved(self):
        """
        Quantity reserved for confirmed sales that haven't been fully delivered.
        """
        from sales.models import SaleOrder, SaleLine
        from decimal import Decimal
        
        # Check sales that are CONFIRMED and NOT fully delivered
        pending_lines = SaleLine.objects.filter(
            product=self,
            order__status=SaleOrder.Status.CONFIRMED
        ).exclude(
            order__delivery_status=SaleOrder.DeliveryStatus.DELIVERED
        )
        
        total_reserved = Decimal('0.0')
        for line in pending_lines:
            total_reserved += line.quantity_pending
            
        return total_reserved

    @property
    def qty_available(self):
        """
        Quantity available for new sales (On Hand - Reserved).
        """
        return self.qty_on_hand - self.qty_reserved


class Warehouse(models.Model):
    name = models.CharField(_("Nombre"), max_length=100)
    code = models.CharField(_("Código"), max_length=20, unique=True)
    address = models.CharField(_("Dirección"), max_length=255, blank=True)

    class Meta:
        verbose_name = _("Almacén/Bodega")
        verbose_name_plural = _("Almacenes")
        ordering = ['-id']

    def __str__(self):
        return self.name

class StockMove(models.Model):
    class Type(models.TextChoices):
        IN = 'IN', _('Entrada')
        OUT = 'OUT', _('Salida')
        ADJUSTMENT = 'ADJ', _('Ajuste')

    class AdjustmentReason(models.TextChoices):
        INITIAL = 'INITIAL', _('Inventario Inicial')
        LOSS = 'LOSS', _('Merma/Pérdida')
        GAIN = 'GAIN', _('Sobrante/Ganancia')
        REVALUATION = 'REVALUATION', _('Revalorización')
        CORRECTION = 'CORRECTION', _('Corrección de Inventario')

    date = models.DateField(_("Fecha"), default=get_current_date)
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='stock_moves')
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name='warehouse_moves')
    uom = models.ForeignKey(UoM, on_delete=models.PROTECT, related_name='stock_moves_uom', null=True, blank=True)
    quantity = models.DecimalField(_("Cantidad"), max_digits=12, decimal_places=4)
    move_type = models.CharField(_("Tipo"), max_length=10, choices=Type.choices)
    adjustment_reason = models.CharField(
        _("Motivo de Ajuste"), 
        max_length=20, 
        choices=AdjustmentReason.choices, 
        null=True, blank=True
    )
    
    description = models.CharField(_("Descripción"), max_length=255, blank=True)
    journal_entry = models.ForeignKey(
        'accounting.JournalEntry',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='stock_moves',
        verbose_name=_("Asiento Contable")
    )
    
    source_uom = models.ForeignKey(UoM, on_delete=models.SET_NULL, null=True, blank=True, related_name='stock_moves_source', help_text=_("Unidad original de la transacción"))
    source_quantity = models.DecimalField(_("Cantidad Original"), max_digits=12, decimal_places=4, null=True, blank=True, help_text=_("Cantidad original en la unidad de la transacción"))
    
    unit_cost = models.DecimalField(
        _("Costo Unitario"),
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text=_("Costo unitario del producto en el momento de este movimiento")
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Movimiento de Stock")
        verbose_name_plural = _("Kardex")
        ordering = ['-id']

    def __str__(self):
        return self.display_id

    @property
    def display_id(self):
        return f"MOV-{str(self.id).zfill(6)}"

class PricingRule(models.Model):
    class RuleType(models.TextChoices):
        FIXED = 'FIXED', _('Precio Fijo (Unitario)')
        PACKAGE_FIXED = 'PACKAGE_FIXED', _('Precio Paquete (Total)')
        DISCOUNT_PERCENTAGE = 'DISCOUNT_PERCENTAGE', _('Porcentaje de Descuento')

    class Operator(models.TextChoices):
        GT = 'GT', _('Mayor que (>)')
        LT = 'LT', _('Menor que (<)')
        EQ = 'EQ', _('Igual a (=)')
        GE = 'GE', _('Mayor o Igual (>=)')
        LE = 'LE', _('Menor o Igual (<=)')
        BT = 'BT', _('Entre (Rango)')

    name = models.CharField(_("Nombre de la Regla"), max_length=100)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, null=True, blank=True, related_name='pricing_rules')
    category = models.ForeignKey(ProductCategory, on_delete=models.CASCADE, null=True, blank=True, related_name='pricing_rules')
    
    uom = models.ForeignKey(UoM, on_delete=models.SET_NULL, null=True, blank=True, verbose_name=_("Unidad de Medida"))
    operator = models.CharField(_("Operador"), max_length=5, choices=Operator.choices, default=Operator.GE)
    min_quantity = models.DecimalField(_("Cantidad Mínima / Desde"), max_digits=12, decimal_places=4, default=1.0, validators=[MinValueValidator(0)])
    max_quantity = models.DecimalField(_("Cantidad Máxima / Hasta"), max_digits=12, decimal_places=4, null=True, blank=True, validators=[MinValueValidator(0)], help_text=_("Solo usado para el operador 'Entre'"))
    
    rule_type = models.CharField(_("Tipo de Regla"), max_length=20, choices=RuleType.choices, default=RuleType.FIXED)
    fixed_price = models.DecimalField(_("Precio Fijo (Neto)"), max_digits=12, decimal_places=0, null=True, blank=True, validators=[MinValueValidator(0)])
    fixed_price_gross = models.DecimalField(_("Precio Fijo (Bruto)"), max_digits=12, decimal_places=0, null=True, blank=True, validators=[MinValueValidator(0)])
    discount_percentage = models.DecimalField(_("Descuento %"), max_digits=5, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)])
    
    start_date = models.DateField(_("Fecha Inicio"), null=True, blank=True)
    end_date = models.DateField(_("Fecha Fin"), null=True, blank=True)
    
    priority = models.IntegerField(_("Prioridad"), default=0, help_text=_("Prioridad más alta se aplica primero"))
    active = models.BooleanField(_("Activo"), default=True)
    
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Regla de Precio")
        verbose_name_plural = _("Reglas de Precio")
        ordering = ['-id']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        from decimal import Decimal
        vat_rate = Decimal('1.19')
        
        if self.fixed_price and not self.fixed_price_gross:
            self.fixed_price_gross = (self.fixed_price * vat_rate).quantize(Decimal('1'), rounding='ROUND_HALF_UP')
        elif self.fixed_price_gross and not self.fixed_price:
            self.fixed_price = (self.fixed_price_gross / vat_rate).quantize(Decimal('1'), rounding='ROUND_HALF_UP')
        elif self.pk:
            try:
                old_instance = PricingRule.objects.get(pk=self.pk)
                if self.fixed_price != old_instance.fixed_price and self.fixed_price_gross == old_instance.fixed_price_gross:
                    self.fixed_price_gross = (self.fixed_price * vat_rate).quantize(Decimal('1'), rounding='ROUND_HALF_UP')
                elif self.fixed_price_gross != old_instance.fixed_price_gross and self.fixed_price == old_instance.fixed_price:
                    self.fixed_price = (self.fixed_price_gross / vat_rate).quantize(Decimal('1'), rounding='ROUND_HALF_UP')
            except Exception:
                pass

        super().save(*args, **kwargs)

class CustomFieldTemplate(models.Model):
    """Reusable custom field definitions for advanced manufacturing products"""
    class FieldType(models.TextChoices):
        TEXT = 'TEXT', _('Texto')
        SELECT_SINGLE = 'SELECT_SINGLE', _('Selección Única')
        SELECT_MULTIPLE = 'SELECT_MULTIPLE', _('Selección Múltiple')
    
    name = models.CharField(_("Nombre del Campo"), max_length=100)
    field_type = models.CharField(_("Tipo"), max_length=20, choices=FieldType.choices)
    description = models.TextField(_("Descripción/Ayuda"), blank=True)
    options = models.JSONField(
        _("Opciones"),
        null=True, blank=True,
        help_text=_("Lista de opciones para campos de selección (ej: ['Opción 1', 'Opción 2'])")
    )
    is_required = models.BooleanField(_("Obligatorio"), default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = _("Plantilla de Campo Personalizado")
        verbose_name_plural = _("Plantillas de Campos Personalizados")
        ordering = ['name']
    
    def __str__(self):
        return f"{self.name} ({self.get_field_type_display()})"

class ProductCustomField(models.Model):
    """Association between products and custom field templates"""
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='product_custom_fields'
    )
    template = models.ForeignKey(
        CustomFieldTemplate,
        on_delete=models.CASCADE,
        related_name='product_associations'
    )
    order = models.IntegerField(_("Orden"), default=0)
    
    class Meta:
        verbose_name = _("Campo Personalizado del Producto")
        verbose_name_plural = _("Campos Personalizados del Producto")
        ordering = ['order', 'template__name']
        unique_together = ['product', 'template']
    
    def __str__(self):
        return f"{self.product.internal_code} - {self.template.name}"

class ReorderingRule(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='reordering_rules')
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name='reordering_rules')
    min_quantity = models.DecimalField(_("Cantidad Mínima"), max_digits=12, decimal_places=4, default=0, validators=[MinValueValidator(0)])
    max_quantity = models.DecimalField(_("Cantidad Máxima"), max_digits=12, decimal_places=4, default=0, validators=[MinValueValidator(0)])
    
    active = models.BooleanField(_("Activo"), default=True)
    
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Regla de Reabastecimiento")
        verbose_name_plural = _("Reglas de Reabastecimiento")
        unique_together = ['product', 'warehouse']

    def __str__(self):
        return f"{self.product.internal_code} - {self.warehouse.name}"


class ReplenishmentProposal(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', _('Pendiente')
        CONVERTED = 'CONVERTED', _('Convertido a OC')
        IGNORED = 'IGNORED', _('Ignorado')

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='replenishment_proposals')
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name='replenishment_proposals')
    qty_to_order = models.DecimalField(_("Cantidad a Pedir"), max_digits=12, decimal_places=4)
    status = models.CharField(_("Estado"), max_length=20, choices=Status.choices, default=Status.PENDING)
    rule = models.ForeignKey(ReorderingRule, on_delete=models.SET_NULL, null=True, blank=True, related_name='proposals')
    supplier = models.ForeignKey(
        'contacts.Contact', 
        on_delete=models.SET_NULL, 
        null=True, blank=True, 
        related_name='replenishment_proposals'
    )
    
    purchase_order = models.ForeignKey(
        'purchasing.PurchaseOrder', 
        on_delete=models.SET_NULL, 
        null=True, blank=True, 
        related_name='replenishment_proposals'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("Propuesta de Reabastecimiento")
        verbose_name_plural = _("Propuestas de Reabastecimiento")
        ordering = ['-created_at']

    def __str__(self):
        return f"Propuesta: {self.product.internal_code} ({self.qty_to_order})"


class Subscription(models.Model):
    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', _('Activa')
        PAUSED = 'PAUSED', _('Pausada')
        CANCELLED = 'CANCELLED', _('Cancelada')
        EXPIRED = 'EXPIRED', _('Vencida')

    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='subscriptions')
    supplier = models.ForeignKey('contacts.Contact', on_delete=models.PROTECT, related_name='subscriptions')
    
    start_date = models.DateField(_("Fecha Inicio"))
    end_date = models.DateField(_("Fecha Fin"), null=True, blank=True)
    next_payment_date = models.DateField(_("Próximo Pago"), null=True, blank=True)
    
    amount = models.DecimalField(_("Monto Recurrente"), max_digits=12, decimal_places=2)
    currency = models.CharField(_("Moneda"), max_length=10, default="CLP")
    
    status = models.CharField(_("Estado"), max_length=20, choices=Status.choices, default=Status.ACTIVE)
    notes = models.TextField(_("Notas"), blank=True)
    
    # Snapshot of configuration at time of creation? Or always use product's?
    # Better to store instance specific config if it differs from product defaults
    recurrence_period = models.CharField(
        _("Frecuencia"), 
        max_length=20, 
        choices=Product.RecurrencePeriod.choices,
        default=Product.RecurrencePeriod.MONTHLY
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("Suscripción")
        verbose_name_plural = _("Suscripciones")
        ordering = ['-next_payment_date']

    def __str__(self):
        return f"{self.product.name} - {self.supplier.name}"
