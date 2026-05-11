"""
T-45..T-49: ProductTypeStrategy — polimorfismo por tipo de producto.

Reemplaza el patrón `if product_type in [...]` disperso en vistas y servicios.
Cada subclase declara:
  - tracks_inventory: bool
  - can_have_bom: bool
  - requires_manufacturing_profile: bool
  - allows_stock_moves: bool
  - costing_method: str  ('average', 'none')
  - get_asset_account(product) -> Account | None
  - get_income_account(product) -> Account | None
  - get_expense_account(product) -> Account | None
  - validate(product) -> None  — lanza ValidationError si el producto es inválido para este tipo

Uso:
    strategy = get_product_type_strategy(product.product_type)
    strategy.validate(product)
    account = strategy.get_asset_account(product)
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _


class ProductTypeStrategy(ABC):
    """ABC que define el contrato de comportamiento por tipo de producto."""

    tracks_inventory: bool = False
    can_have_bom: bool = False
    requires_manufacturing_profile: bool = False
    allows_stock_moves: bool = False
    costing_method: str = 'none'

    @abstractmethod
    def get_asset_account(self, product):
        """Retorna la cuenta de activo/inventario para este producto, o None."""
        ...

    @abstractmethod
    def get_income_account(self, product):
        """Retorna la cuenta de ingresos por defecto, o None."""
        ...

    @abstractmethod
    def get_expense_account(self, product):
        """Retorna la cuenta de costos/gastos por defecto, o None."""
        ...

    def validate(self, product) -> None:
        """Lanza ValidationError si el producto tiene datos inconsistentes para su tipo."""
        pass  # Por defecto sin restricciones; subclases pueden sobreescribir.

    @staticmethod
    def _get_settings():
        from accounting.models import AccountingSettings
        return AccountingSettings.get_solo()


# ─── Implementaciones ───────────────────────────────────────────────────────

class ConsumableStrategy(ProductTypeStrategy):
    """
    T-45: Consumible.
    No controla stock, no tiene BOM, cuenta de gasto al comprar.
    """
    tracks_inventory = False
    can_have_bom = False
    requires_manufacturing_profile = False
    allows_stock_moves = False
    costing_method = 'none'

    def get_asset_account(self, product):
        settings = self._get_settings()
        if product.category and product.category.asset_account:
            return product.category.asset_account
        return settings.default_consumable_account if settings else None

    def get_income_account(self, product):
        settings = self._get_settings()
        if product.income_account:
            return product.income_account
        if product.category and product.category.income_account:
            return product.category.income_account
        return settings.default_revenue_account if settings else None

    def get_expense_account(self, product):
        settings = self._get_settings()
        if product.expense_account:
            return product.expense_account
        if product.category and product.category.expense_account:
            return product.category.expense_account
        return (settings.default_consumable_account or settings.default_expense_account) if settings else None


class StorableStrategy(ProductTypeStrategy):
    """
    T-46: Almacenable.
    Controla stock con valoración promedio ponderado.
    """
    tracks_inventory = True
    can_have_bom = False
    requires_manufacturing_profile = False
    allows_stock_moves = True
    costing_method = 'average'

    def get_asset_account(self, product):
        settings = self._get_settings()
        if product.category and product.category.asset_account:
            return product.category.asset_account
        return (settings.storable_inventory_account or settings.default_inventory_account) if settings else None

    def get_income_account(self, product):
        settings = self._get_settings()
        if product.income_account:
            return product.income_account
        if product.category and product.category.income_account:
            return product.category.income_account
        return settings.default_revenue_account if settings else None

    def get_expense_account(self, product):
        settings = self._get_settings()
        if product.expense_account:
            return product.expense_account
        if product.category and product.category.expense_account:
            return product.category.expense_account
        return (settings.merchandise_cogs_account or settings.default_expense_account) if settings else None


class ManufacturableStrategy(ProductTypeStrategy):
    """
    T-47: Fabricable.
    Controla stock, puede tener BOM, requiere perfil de fabricación.
    """
    tracks_inventory = True
    can_have_bom = True
    requires_manufacturing_profile = True
    allows_stock_moves = True
    costing_method = 'average'

    def get_asset_account(self, product):
        settings = self._get_settings()
        if product.category and product.category.asset_account:
            return product.category.asset_account
        return (settings.manufacturable_inventory_account or settings.default_inventory_account) if settings else None

    def get_income_account(self, product):
        settings = self._get_settings()
        if product.income_account:
            return product.income_account
        if product.category and product.category.income_account:
            return product.category.income_account
        return settings.default_revenue_account if settings else None

    def get_expense_account(self, product):
        settings = self._get_settings()
        if product.expense_account:
            return product.expense_account
        if product.category and product.category.expense_account:
            return product.category.expense_account
        return (settings.manufactured_cogs_account or settings.default_expense_account) if settings else None

    def validate(self, product) -> None:
        # Express MANUFACTURABLE (mfg_auto_finalize) sin variantes necesita BOM
        if product.mfg_auto_finalize and not product.has_variants and not product.parent_template:
            if not product.has_active_bom():
                raise ValidationError(
                    _("Un producto Fabricable Express (Finalizar Automáticamente) debe tener una Lista de Materiales activa.")
                )


class ServiceStrategy(ProductTypeStrategy):
    """
    T-48: Servicio.
    Sin control de stock. Cuentas de ingreso/gasto de servicio.
    """
    tracks_inventory = False
    can_have_bom = False
    requires_manufacturing_profile = False
    allows_stock_moves = False
    costing_method = 'none'

    def get_asset_account(self, product):
        return None  # Servicios no tienen cuenta de activo

    def get_income_account(self, product):
        settings = self._get_settings()
        if product.income_account:
            return product.income_account
        if product.category and product.category.income_account:
            return product.category.income_account
        return (settings.default_service_revenue_account or settings.default_revenue_account) if settings else None

    def get_expense_account(self, product):
        settings = self._get_settings()
        if product.expense_account:
            return product.expense_account
        if product.category and product.category.expense_account:
            return product.category.expense_account
        return (settings.default_service_expense_account or settings.default_expense_account) if settings else None


class SubscriptionStrategy(ProductTypeStrategy):
    """
    T-49: Suscripción recurrente.
    Sin control de stock. Cuentas de suscripción.
    """
    tracks_inventory = False
    can_have_bom = False
    requires_manufacturing_profile = False
    allows_stock_moves = False
    costing_method = 'none'

    def get_asset_account(self, product):
        return None

    def get_income_account(self, product):
        settings = self._get_settings()
        if product.income_account:
            return product.income_account
        if product.category and product.category.income_account:
            return product.category.income_account
        return (settings.default_subscription_revenue_account or settings.default_revenue_account) if settings else None

    def get_expense_account(self, product):
        settings = self._get_settings()
        if product.expense_account:
            return product.expense_account
        if product.category and product.category.expense_account:
            return product.category.expense_account
        return (settings.default_subscription_expense_account or settings.default_expense_account) if settings else None

    def validate(self, product) -> None:
        if not product.recurrence_period:
            raise ValidationError(
                _("Un producto de tipo Suscripción debe tener un Período de Recurrencia definido.")
            )


# ─── Registry ───────────────────────────────────────────────────────────────

PRODUCT_TYPE_STRATEGIES: dict[str, ProductTypeStrategy] = {
    'CONSUMABLE': ConsumableStrategy(),
    'STORABLE': StorableStrategy(),
    'MANUFACTURABLE': ManufacturableStrategy(),
    'SERVICE': ServiceStrategy(),
    'SUBSCRIPTION': SubscriptionStrategy(),
}


def get_product_type_strategy(product_type: str) -> ProductTypeStrategy:
    """
    Retorna la estrategia correspondiente al tipo de producto.
    Lanza KeyError si el tipo no está registrado.
    """
    try:
        return PRODUCT_TYPE_STRATEGIES[product_type]
    except KeyError:
        raise NotImplementedError(
            f"No ProductTypeStrategy registered for type: '{product_type}'. "
            f"Available: {list(PRODUCT_TYPE_STRATEGIES.keys())}"
        )
