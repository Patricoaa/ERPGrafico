from django.db import models
from django.utils.translation import gettext_lazy as _
from accounting.models import Account, AccountType

class ProductCategory(models.Model):
    name = models.CharField(_("Nombre"), max_length=100)
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

class ProductAttribute(models.Model):
    name = models.CharField(_("Nombre"), max_length=100) # ej: Color, Size
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("Atributo de Producto")
        verbose_name_plural = _("Atributos de Producto")

    def __str__(self):
        return self.name

class ProductAttributeValue(models.Model):
    attribute = models.ForeignKey(ProductAttribute, on_delete=models.CASCADE, related_name='values')
    value = models.CharField(_("Valor"), max_length=100) # ej: Red, XL
    
    class Meta:
        verbose_name = _("Valor de Atributo")
        verbose_name_plural = _("Valores de Atributo")
        unique_together = ('attribute', 'value')

    def __str__(self):
        return f"{self.attribute.name}: {self.value}"

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
    
    sale_price = models.DecimalField(_("Precio Venta"), max_digits=12, decimal_places=2, default=0)
    cost_price = models.DecimalField(_("Costo Ponderado"), max_digits=12, decimal_places=2, default=0, editable=False)

    # Variant Logic
    variant_of = models.ForeignKey(
        'self', on_delete=models.CASCADE, null=True, blank=True, related_name='variants',
        help_text=_("Producto padre (plantilla). Si está vacío, es un producto principal.")
    )
    attribute_values = models.ManyToManyField(
        ProductAttributeValue, blank=True, related_name='products',
        help_text=_("Valores de atributos que definen esta variante.")
    )

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
