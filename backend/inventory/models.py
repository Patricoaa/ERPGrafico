from django.db import models
from django.utils.translation import gettext_lazy as _
from accounting.models import Account, AccountType

class ProductCategory(models.Model):
    name = models.CharField(_("Nombre"), max_length=100)
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
        STORABLE = 'STORABLE', _('Almacenable')
        CONSUMABLE = 'CONSUMABLE', _('Consumible')
        SERVICE = 'SERVICE', _('Servicio')
        MANUFACTURABLE = 'MANUFACTURABLE', _('Fabricable')

    code = models.CharField(_("Código/SKU"), max_length=50, unique=True)
    name = models.CharField(_("Nombre"), max_length=255)
    category = models.ForeignKey(ProductCategory, on_delete=models.PROTECT, related_name='products')
    product_type = models.CharField(_("Tipo"), max_length=20, choices=Type.choices, default=Type.STORABLE)
    image = models.ImageField(_("Imagen"), upload_to='products/', null=True, blank=True)
    
    # Units of Measure
    uom = models.ForeignKey(
        UoM, on_delete=models.PROTECT, related_name='products',
        verbose_name=_("Unidad de Medida"), 
        null=True, blank=True,
        help_text=_("Unidad base para gestión de stock")
    )
    purchase_uom = models.ForeignKey(
        UoM, on_delete=models.PROTECT, related_name='products_purchase',
        verbose_name=_("UdM Compra"), 
        null=True, blank=True,
        help_text=_("Unidad por defecto para compras")
    )

    sale_price = models.DecimalField(_("Precio Venta"), max_digits=12, decimal_places=2, default=0)
    cost_price = models.DecimalField(_("Costo Ponderado"), max_digits=12, decimal_places=2, default=0, editable=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("Producto")
        verbose_name_plural = _("Productos")

    def __str__(self):
        return f"[{self.code}] {self.name}"

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

    name = models.CharField(_("Nombre de la Regla"), max_length=100)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, null=True, blank=True, related_name='pricing_rules')
    category = models.ForeignKey(ProductCategory, on_delete=models.CASCADE, null=True, blank=True, related_name='pricing_rules')
    
    min_quantity = models.DecimalField(_("Cantidad Mínima"), max_digits=12, decimal_places=4, default=1.0)
    
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
