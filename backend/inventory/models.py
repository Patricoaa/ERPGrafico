from django.db import models
from django.utils.translation import gettext_lazy as _
from accounting.models import Account, AccountType

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

    def __str__(self):
        return self.name

class UoMCategory(models.Model):
    name = models.CharField(_("Nombre"), max_length=100)
    
    class Meta:
        verbose_name = _("Categoría de Medida")
        verbose_name_plural = _("Categorías de Medida")

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

    def __str__(self):
        return self.name

class Product(models.Model):
    class Type(models.TextChoices):
        CONSUMABLE = 'CONSUMABLE', _('Consumible')
        STORABLE = 'STORABLE', _('Almacenable')
        MANUFACTURABLE = 'MANUFACTURABLE', _('Fabricable')
        SERVICE = 'SERVICE', _('Servicio')

    internal_code = models.CharField(_("Código Interno"), max_length=50, unique=True, editable=False, null=True, blank=True)
    code = models.CharField(_("Código/SKU"), max_length=50, unique=True, null=True, blank=True)
    name = models.CharField(_("Nombre"), max_length=255)
    category = models.ForeignKey(ProductCategory, on_delete=models.PROTECT, related_name='products')
    product_type = models.CharField(_("Tipo"), max_length=30, choices=Type.choices, default=Type.STORABLE)
    image = models.ImageField(_("Imagen"), upload_to='products/', null=True, blank=True)
    
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
    
    # Inventory Tracking Control
    track_inventory = models.BooleanField(
        _("Controlar Stock"),
        default=True,
        help_text=_("Desactivar para productos que no requieren control de inventario (fabricables, servicios)")
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
        UoM, on_delete=models.PROTECT, related_name='products_purchase',
        verbose_name=_("UdM Compra (DEPRECATED)"), 
        null=True, blank=True,
        help_text=_("⚠️ DEPRECATED: Use 'allowed_sale_uoms' en su lugar. Este campo se mantendrá solo para compatibilidad.")
    )

    allowed_sale_uoms = models.ManyToManyField(
        UoM, related_name='allowed_sale_products',
        blank=True,
        verbose_name=_("Unidades de Venta Permitidas"),
        help_text=_("Unidades de medida permitidas para la venta de este producto (además de la unidad base).")
    )

    sale_price = models.DecimalField(_("Precio Venta"), max_digits=12, decimal_places=2, default=0)
    cost_price = models.DecimalField(_("Costo Ponderado"), max_digits=12, decimal_places=2, default=0, editable=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("Producto")
        verbose_name_plural = _("Productos")

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
            
        super().save(*args, **kwargs)

    # Helpers to get effective accounts (Product override > Category > None)
    @property
    def get_asset_account(self):
        return self.category.asset_account
    
    @property
    def get_income_account(self):
        return self.category.income_account

    @property
    def get_expense_account(self):
        return self.category.expense_account
    
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
        from decimal import Decimal
        active_bom = BillOfMaterials.objects.filter(product=self, active=True).first()
        if not active_bom:
            return Decimal('0.00')
        
        total_bom_cost = Decimal('0.00')
        for line in active_bom.lines.all():
            # Use component's cost_price (weighted average)
            total_bom_cost += line.quantity * line.component.cost_price
            
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
            component_stock = component.moves.aggregate(total=Sum('quantity'))['total'] or 0.0
            component_stock = float(component_stock)
            
            # Unit Conversion Logic using UoMService
            # We need to express "required_qty" (which is in line.uom) into Component Base UoM
            required_qty_in_base = required_qty
            
            if line.uom and component.uom:
                if line.uom != component.uom:
                    try:
                        from inventory.services import UoMService
                        from decimal import Decimal
                        required_qty_in_base = float(
                            UoMService.convert_quantity(
                                Decimal(str(required_qty)),
                                line.uom,
                                component.uom
                            )
                        )
                    except ValidationError:
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

class Warehouse(models.Model):
    name = models.CharField(_("Nombre"), max_length=100)
    code = models.CharField(_("Código"), max_length=20, unique=True)
    address = models.CharField(_("Dirección"), max_length=255, blank=True)

    class Meta:
        verbose_name = _("Almacén/Bodega")
        verbose_name_plural = _("Almacenes")

    def __str__(self):
        return self.name

class StockMove(models.Model):
    class Type(models.TextChoices):
        IN = 'IN', _('Entrada')
        OUT = 'OUT', _('Salida')
        ADJUSTMENT = 'ADJ', _('Ajuste')

    date = models.DateField(_("Fecha"))
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='moves')
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name='moves')
    quantity = models.DecimalField(_("Cantidad"), max_digits=12, decimal_places=4) # Pos for Add, Neg for Remove
    move_type = models.CharField(_("Tipo"), max_length=10, choices=Type.choices)
    
    description = models.CharField(_("Descripción"), max_length=255, blank=True)
    
    # Link to Accounting
    journal_entry = models.ForeignKey(
        'accounting.JournalEntry', 
        on_delete=models.SET_NULL, 
        null=True, blank=True,
        related_name='stock_moves'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("Movimiento de Stock")
        verbose_name_plural = _("Kardex")
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"{self.date} - {self.product.code} ({self.quantity})"

class PricingRule(models.Model):
    class RuleType(models.TextChoices):
        FIXED = 'FIXED', _('Precio Fijo')
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
    min_quantity = models.DecimalField(_("Cantidad Mínima / Desde"), max_digits=12, decimal_places=4, default=1.0)
    max_quantity = models.DecimalField(_("Cantidad Máxima / Hasta"), max_digits=12, decimal_places=4, null=True, blank=True, help_text=_("Solo usado para el operador 'Entre'"))
    
    rule_type = models.CharField(_("Tipo de Regla"), max_length=20, choices=RuleType.choices, default=RuleType.FIXED)
    fixed_price = models.DecimalField(_("Precio Fijo"), max_digits=12, decimal_places=2, null=True, blank=True)
    discount_percentage = models.DecimalField(_("Descuento %"), max_digits=5, decimal_places=2, null=True, blank=True)
    
    start_date = models.DateField(_("Fecha Inicio"), null=True, blank=True)
    end_date = models.DateField(_("Fecha Fin"), null=True, blank=True)
    
    priority = models.IntegerField(_("Prioridad"), default=0, help_text=_("Prioridad más alta se aplica primero"))
    active = models.BooleanField(_("Activo"), default=True)

    class Meta:
        verbose_name = _("Regla de Precio")
        verbose_name_plural = _("Reglas de Precio")
        ordering = ['-priority', 'min_quantity']

    def __str__(self):
        return self.name

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
        return f"{self.product.code} - {self.template.name}"


