import itertools
from decimal import Decimal
from typing import Tuple

from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.db.models import Q, QuerySet
from django.utils import timezone

from accounting.models import Account, AccountType, JournalEntry, JournalItem
from accounting.services import JournalEntryService

from .models import (
    PricingRule,
    Product,
    ProductAttributeValue,
    ProductUoMPrice,
    StockMove,
    UoM,
    Warehouse,
    Subscription,
)


class SubscriptionService:
    @staticmethod
    def pause_subscription(subscription: Subscription) -> Subscription:
        if subscription.status != Subscription.Status.ACTIVE:
            raise ValidationError("Solo se pueden pausar suscripciones activas")
        subscription.status = Subscription.Status.PAUSED
        subscription.save()
        return subscription

    @staticmethod
    def cancel_subscription(subscription: Subscription) -> Subscription:
        subscription.status = Subscription.Status.CANCELLED
        subscription.end_date = timezone.now().date()
        subscription.save()
        return subscription

    @staticmethod
    def resume_subscription(subscription: Subscription) -> Subscription:
        if subscription.status != Subscription.Status.PAUSED:
            raise ValidationError("Solo se pueden reanudar suscripciones pausadas")
        subscription.status = Subscription.Status.ACTIVE
        subscription.save()
        return subscription


class StockService:
    @staticmethod
    @transaction.atomic
    def adjust_stock_from_payload(payload: dict) -> "StockMove":
        """
        Parses payload, validates references (product, warehouse, partner),
        and delegates to adjust_stock.
        """
        from decimal import Decimal
        from django.core.exceptions import ValidationError
        from contacts.models import Contact
        from .models import Product, Warehouse, UoM, StockMove

        product_id = payload.get("product_id")
        warehouse_id = payload.get("warehouse_id")
        quantity = Decimal(str(payload.get("quantity", "0")))
        unit_cost = Decimal(str(payload.get("unit_cost", "0")))
        description = payload.get("description", "Manual Adjustment")
        adjustment_reason = payload.get("adjustment_reason")
        uom_id = payload.get("uom_id")
        partner_contact_id = payload.get("partner_contact_id")

        if not product_id or not warehouse_id:
            raise ValidationError("Producto y bodega son requeridos.")

        try:
            product = Product.objects.get(pk=product_id)
            warehouse = Warehouse.objects.get(pk=warehouse_id)
        except (Product.DoesNotExist, Warehouse.DoesNotExist) as e:
            raise ValidationError(str(e))

        uom = None
        if uom_id:
            try:
                uom = UoM.objects.get(pk=uom_id)
            except UoM.DoesNotExist:
                pass

        partner_contact = None
        partner_reasons = [
            StockMove.AdjustmentReason.PARTNER_CONTRIBUTION,
            StockMove.AdjustmentReason.PARTNER_WITHDRAWAL,
        ]
        if adjustment_reason in partner_reasons:
            if not partner_contact_id:
                raise ValidationError(
                    "Debe seleccionar un socio para aportes o retiros de capital en inventario."
                )
            try:
                partner_contact = Contact.objects.get(pk=partner_contact_id)
            except Contact.DoesNotExist:
                raise ValidationError("Socio no encontrado.")
            if not partner_contact.is_partner:
                raise ValidationError("El contacto seleccionado no es un socio.")

        return StockService.adjust_stock(
            product=product,
            warehouse=warehouse,
            quantity=quantity,
            unit_cost=unit_cost,
            description=description,
            adjustment_reason=adjustment_reason,
            uom=uom,
            partner_contact=partner_contact,
        )

    @staticmethod
    @transaction.atomic
    def adjust_stock(
        product: Product,
        warehouse: Warehouse,
        quantity: Decimal,
        unit_cost: Decimal,
        description: str,
        adjustment_reason: str = None,
        uom: UoM = None,
        partner_contact=None,
    ):
        """
        Creates a Stock Move (Adjustment) and the corresponding Journal Entry.
        Handles cost ponderation for entries and uses specific accounts from AccountingSettings.
        """
        if quantity == 0:
            return None

        quantity_orig = quantity

        from accounting.models import AccountingSettings

        settings = AccountingSettings.get_solo()
        if not settings:
            raise ValidationError("No se encontró la configuración contable global.")

        # UoM Conversion Logic
        if uom and product.uom and uom != product.uom:
            # Validate compatibility
            if uom.category != product.uom.category:
                raise ValidationError(
                    f"La unidad {uom.name} no es compatible con la unidad base del producto {product.uom.name}"
                )

            # Convert Quantity
            qty_in_base = StockService.convert_quantity(quantity, uom, product.uom)

            # Convert Unit Cost (Inverse of quantity conversion)
            # CostBase = CostInput * (QtyInput / QtyBase) ???
            # Total Value = QtyInput * CostInput
            # Total Value = QtyBase * CostBase
            # CostBase = (QtyInput * CostInput) / QtyBase
            # CostBase = (QtyInput * CostInput) / (QtyInput * Factor) = CostInput / Factor

            # Factor = FromRatio / ToRatio
            factor = Decimal(str(uom.ratio)) / Decimal(str(product.uom.ratio))
            cost_in_base = unit_cost / factor

            # Append to description for traceability
            description += f" (Conv: {quantity} {uom.name} @ {unit_cost})"

            # Reassign for processing
            quantity = qty_in_base
            unit_cost = cost_in_base

        # Validation: Negative Stock
        current_stock = product.qty_on_hand
        future_stock = current_stock + quantity

        # Allow negative stock ONLY if the system explicitly allows it (not implemented yet, so strict by default)
        # Note: 'quantity' is signed here. If it's an OUT move, quantity is negative.
        if future_stock < 0:
            raise ValidationError(
                f"No hay suficiente stock para realizar este ajuste. Stock actual: {current_stock}, Solicitado: {abs(quantity)}."
            )

        # Validation: Revaluation logic
        # Interpretation: Revaluation implies adjusting value of existing stock.
        # If stock is 0, it should be 'INITIAL' or 'CORRECTION' not 'REVALUATION'.
        if adjustment_reason == StockMove.AdjustmentReason.REVALUATION and current_stock <= 0:
            raise ValidationError(
                "No se puede realizar una revalorización sobre un stock nulo o negativo. Use 'Inventario Inicial' o 'Corrección'."
            )

        # 1. Logic for unit_cost and cost pondering
        if unit_cost is None or unit_cost == 0:
            if quantity > 0 and product.cost_price == 0:
                raise ValidationError(
                    f"Debe especificar un costo unitario para esta entrada de stock del producto {product.name}."
                )
            unit_cost = product.cost_price

        # Update product weighted average cost for entries
        if quantity > 0:
            old_qty = product.qty_on_hand
            old_cost = product.cost_price
            new_qty = old_qty + quantity

            if new_qty > 0:
                # Weighted Average Formula: (old_stock * old_cost + new_stock * new_cost) / total_stock
                # But only if new_qty > 0 to avoid division by zero
                # If we were at 0 or negative, the new unit_cost becomes the reference
                if old_qty <= 0:
                    product.cost_price = unit_cost
                else:
                    new_cost = ((old_qty * old_cost) + (quantity * unit_cost)) / new_qty
                    product.cost_price = new_cost.quantize(Decimal("0.01"))
                product.save()

        # 2. Create Stock Move
        move_type = StockMove.Type.ADJUSTMENT
        # Even if tagged as ADJ, we check direction for move_type logic if needed (though ADJ is valid)
        # We'll use ADJ but keep the direction in quantity

        move = StockMove.objects.create(
            date=timezone.now().date(),
            product=product,
            warehouse=warehouse,
            uom=product.uom,
            quantity=quantity,
            move_type=move_type,
            adjustment_reason=adjustment_reason,
            description=description,
            source_uom=uom or product.uom,
            source_quantity=quantity_orig,
            unit_cost=unit_cost,  # Frozen at creation time
        )

        # 3. Accounting Logic
        asset_account = product.get_asset_account
        if not asset_account:
            raise ValidationError(
                f"El producto {product.name} (o su categoría) no tiene configurada una Cuenta de Activo."
            )

        # Determine Counterpart Account based on reason
        contra_account = None

        if adjustment_reason == StockMove.AdjustmentReason.PARTNER_CONTRIBUTION:
            # Smart Contribution: Priority Capital Receivable > Equity
            if partner_contact:
                if partner_contact.partner_pending_capital > 0:
                    # Clear pending debt first (Asset reduction)
                    contra_account = settings.partner_capital_receivable_account
                else:
                    # Direct Equity increase
                    contra_account = settings.partner_capital_contribution_account

            # Fallback
            if not contra_account:
                contra_account = settings.partner_capital_contribution_account

        elif adjustment_reason == StockMove.AdjustmentReason.PARTNER_WITHDRAWAL:
            # Smart Withdrawal: Priority Dividends Payable > Provisional Withdrawal
            if partner_contact:
                if partner_contact.partner_dividends_payable_balance > 0:
                    # Pay out dividends (Liability reduction)
                    contra_account = settings.partner_dividends_payable_account
                else:
                    # Record provisional withdrawal (Equity contra)
                    contra_account = settings.partner_provisional_withdrawal_account

            # Fallback
            if not contra_account:
                contra_account = (
                    settings.partner_withdrawal_account or settings.pos_partner_withdrawal_account
                )
        # INITIAL was removed — legacy records with INITIAL will fall through to generic gain/loss
        elif adjustment_reason == StockMove.AdjustmentReason.REVALUATION:
            contra_account = settings.revaluation_account
        elif quantity > 0:
            # Gain/Sobrante
            contra_account = (
                settings.adjustment_income_account
                or Account.objects.filter(account_type=AccountType.INCOME).first()
            )
        else:
            # Loss/Merma
            contra_account = (
                settings.adjustment_expense_account
                or Account.objects.filter(account_type=AccountType.EXPENSE).first()
            )

        if not contra_account:
            raise ValidationError(
                f"No se encontró una cuenta de contrapartida configurada para el motivo: {adjustment_reason or 'Ajuste Genérico'}."
            )

        total_value = abs(quantity * unit_cost)

        entry = JournalEntry.objects.create(
            date=timezone.now().date(),
            description=f"Ajuste Stock {product.internal_code}: {description} ({adjustment_reason or 'Manual'})",
            reference=f"STK-{move.id}",
            status=JournalEntry.State.DRAFT,
            source_content_type=ContentType.objects.get_for_model(StockMove),
            source_object_id=move.id,
        )

        if quantity > 0:
            # Entry: Debit Asset, Credit Counterpart
            JournalItem.objects.create(
                entry=entry,
                account=asset_account,
                debit=total_value,
                credit=0,
                label=description,
                partner=partner_contact,
            )
            JournalItem.objects.create(
                entry=entry,
                account=contra_account,
                debit=0,
                credit=total_value,
                label=description,
                partner=partner_contact,
            )
        else:
            # Exit: Debit Counterpart, Credit Asset
            JournalItem.objects.create(
                entry=entry,
                account=contra_account,
                debit=total_value,
                credit=0,
                label=description,
                partner=partner_contact,
            )
            JournalItem.objects.create(
                entry=entry,
                account=asset_account,
                debit=0,
                credit=total_value,
                label=description,
                partner=partner_contact,
            )

        JournalEntryService.post_entry(entry)

        move.journal_entry = entry
        move.save()

        # Create PartnerTransaction if this is a partner-related adjustment
        if partner_contact and adjustment_reason in [
            StockMove.AdjustmentReason.PARTNER_CONTRIBUTION,
            StockMove.AdjustmentReason.PARTNER_WITHDRAWAL,
        ]:
            from contacts.partner_models import PartnerTransaction

            # Determine appropriate transaction type based on the smart logic above
            target_tx_type = PartnerTransaction.Type.OTHER
            if adjustment_reason == StockMove.AdjustmentReason.PARTNER_CONTRIBUTION:
                if contra_account == settings.partner_capital_receivable_account:
                    # If we used the receivable account, it's technically a "Capital Payment" in goods
                    # But for simplicity we use the Inventory Contribution type
                    target_tx_type = PartnerTransaction.Type.CAPITAL_CONTRIBUTION_INVENTORY
                else:
                    target_tx_type = PartnerTransaction.Type.CAPITAL_CONTRIBUTION_INVENTORY
            else:
                # Withdrawal side: Smart Type Selection
                if contra_account == settings.partner_dividends_payable_account:
                    target_tx_type = PartnerTransaction.Type.DIVIDEND_PAYMENT
                else:
                    target_tx_type = PartnerTransaction.Type.PROVISIONAL_WITHDRAWAL

            PartnerTransaction.objects.create(
                partner=partner_contact,
                transaction_type=target_tx_type,
                amount=total_value,
                date=timezone.now().date(),
                description=f"{description} - {product.internal_code}",
                journal_entry=entry,
                stock_move=move,
            )

        return move

    @staticmethod
    def convert_quantity(quantity: Decimal, from_uom, to_uom) -> Decimal:
        """
        Converts quantity from one UoM to another.
        """
        if not from_uom or not to_uom:
            return quantity

        if from_uom == to_uom:
            return quantity

        if from_uom.category_id != to_uom.category_id:
            # Fallback or error? For now we will assume if categories match we convert, else we might return as is or error
            # But models constraints should prevent this.
            if from_uom.category != to_uom.category:
                raise ValidationError(
                    f"No se puede convertir de {from_uom.name} a {to_uom.name} (Categorías distintas)"
                )

        # Conversion: Qty * (FromRatio / ToRatio)
        converted_qty = (quantity * from_uom.ratio) / to_uom.ratio

        # Apply rounding if to_uom has it
        if hasattr(to_uom, "rounding") and to_uom.rounding:
            rounding = Decimal(str(to_uom.rounding))
            return converted_qty.quantize(rounding)

        return converted_qty


class PricingService:
    @staticmethod
    def get_product_price(
        product: Product, quantity: Decimal, date=None, uom: UoM = None
    ) -> Decimal:
        """
        Calculates the best price for a product given a quantity, date and specific UoM.
        """
        if date is None:
            date = timezone.now().date()

        if uom is None:
            uom = product.uom if hasattr(product, "uom") else None

        if uom is None:
            # If still no UoM, we can't do advanced pricing rules that depend on it
            from accounting.utils import get_vat_multiplier

            return product.sale_price_gross or (product.sale_price * get_vat_multiplier()).quantize(
                Decimal("1")
            )

        # Check for an explicit per-UoM price before falling back to proportional conversion
        uom_price_obj = ProductUoMPrice.objects.filter(product=product, uom=uom).first()
        if uom_price_obj:
            base_price = uom_price_obj.price_gross
        else:
            _, base_price = PricingService.resolve_variant_price(product)

        # Build product filters including parent template if it's a variant
        product_filters = Q(product=product) | Q(category=product.category)
        if hasattr(product, "parent_template_id") and product.parent_template_id:
            if product.price_inheritance_mode in ["INHERIT", "SURCHARGE"]:
                product_filters |= Q(product_id=product.parent_template_id)

        # Find active rules
        rules = (
            PricingRule.objects.filter(active=True)
            .filter(Q(start_date__isnull=True) | Q(start_date__lte=date))
            .filter(Q(end_date__isnull=True) | Q(end_date__gte=date))
            .filter(product_filters)
            .order_by("-priority")
        )

        best_price = base_price

        for rule in rules:
            # Convert objective quantity to rule's UoM if specified
            # Otherwise we use the provided quantity as is (assuming it's in product.uom if not specified)
            check_qty = quantity
            if rule.uom:
                try:
                    # Convert from provided UoM to Rule UoM
                    check_qty = StockService.convert_quantity(quantity, uom, rule.uom)
                except ValidationError:
                    # If conversion fails (different categories), skip this rule
                    continue
            else:
                # If rule doesn't specify UoM, we assume it's in the product's base UoM
                # So we convert the provided quantity to base UoM
                if uom != product.uom:
                    try:
                        check_qty = StockService.convert_quantity(quantity, uom, product.uom)
                    except ValidationError:
                        continue

            # Check if quantity satisfies the rule operator
            matches = False
            op = rule.operator
            min_q = rule.min_quantity
            max_q = rule.max_quantity

            if op == PricingRule.Operator.GE:
                matches = check_qty >= min_q
            elif op == PricingRule.Operator.GT:
                matches = check_qty > min_q
            elif op == PricingRule.Operator.LE:
                matches = check_qty <= min_q
            elif op == PricingRule.Operator.LT:
                matches = check_qty < min_q
            elif op == PricingRule.Operator.EQ:
                matches = check_qty == min_q
            elif op == PricingRule.Operator.BT:
                if max_q is not None:
                    matches = min_q <= check_qty <= max_q
                else:
                    matches = check_qty >= min_q  # Fallback if max is null

            if matches:
                # Calculate price
                if rule.rule_type == PricingRule.RuleType.FIXED:
                    if rule.fixed_price_gross is not None:
                        rule_base = rule.fixed_price_gross
                    elif rule.fixed_price is not None:
                        from accounting.utils import get_vat_multiplier

                        rule_base = (rule.fixed_price * get_vat_multiplier()).quantize(
                            Decimal("1"), rounding="ROUND_HALF_UP"
                        )

                    if (
                        getattr(product, "parent_template_id", None)
                        and product.price_inheritance_mode == "SURCHARGE"
                        and rule.product_id == product.parent_template_id
                    ):
                        surcharge = product.price_surcharge or Decimal("0")
                        surcharge_gross = (surcharge * get_vat_multiplier()).quantize(
                            Decimal("1"), rounding="ROUND_HALF_UP"
                        )
                        rule_base += surcharge_gross

                    best_price = rule_base
                elif rule.rule_type == PricingRule.RuleType.PACKAGE_FIXED:
                    # Package fixed price is also usually interpreted as Gross
                    p_price = (
                        rule.fixed_price_gross
                        if rule.fixed_price_gross is not None
                        else (rule.fixed_price * get_vat_multiplier() if rule.fixed_price else None)
                    )
                    if p_price is not None:
                        # We need to return UNIT price, so we divide by quantity
                        if quantity > 0:
                            unit_price = (p_price / quantity).quantize(
                                Decimal("1"), rounding="ROUND_HALF_UP"
                            )
                        else:
                            unit_price = p_price

                        if (
                            getattr(product, "parent_template_id", None)
                            and product.price_inheritance_mode == "SURCHARGE"
                            and rule.product_id == product.parent_template_id
                        ):
                            surcharge = product.price_surcharge or Decimal("0")
                            surcharge_gross = (surcharge * get_vat_multiplier()).quantize(
                                Decimal("1"), rounding="ROUND_HALF_UP"
                            )
                            unit_price += surcharge_gross

                        best_price = unit_price
                else:
                    if rule.discount_percentage is not None:
                        best_price = (base_price * (1 - (rule.discount_percentage / 100))).quantize(
                            Decimal("1"), rounding="ROUND_HALF_UP"
                        )

                # Rule applied, stop (rules are ordered by priority)
                break

        return best_price

    @staticmethod
    def resolve_variant_price(variant: "Product") -> tuple:
        """
        Devuelve (price_net, price_gross) resolviendo el modo de herencia de precio.

        - INHERIT:   usa los precios del template padre directamente.
        - SURCHARGE: precio_template + price_surcharge (neto); recalcula bruto.
        - OVERRIDE:  precio propio de la variante (comportamiento anterior).

        Si la variante no tiene parent_template, devuelve su precio propio.
        """
        from accounting.utils import get_vat_multiplier

        vat = get_vat_multiplier()
        if not variant.parent_template_id:
            return variant.sale_price, variant.sale_price_gross

        mode = variant.price_inheritance_mode
        if mode == "INHERIT":
            t = variant.parent_template
            return t.sale_price, t.sale_price_gross
        elif mode == "SURCHARGE":
            t = variant.parent_template
            surcharge = variant.price_surcharge or Decimal("0")
            net = t.sale_price + surcharge
            gross = (net * vat).quantize(Decimal("1"), rounding="ROUND_HALF_UP")
            return net, gross

        # OVERRIDE — precio propio
        return variant.sale_price, variant.sale_price_gross

    class ProductNotFound(Exception):
        pass

    @staticmethod
    def get_effective_sale_price(product_id, quantity, uom_id=None):
        from decimal import Decimal
        from inventory.models import Product, UoM
        from accounting.utils import get_vat_multiplier

        try:
            product = Product.objects.get(pk=product_id)
        except Product.DoesNotExist:
            raise PricingService.ProductNotFound(f"Product {product_id} not found")

        uom = None
        if uom_id:
            try:
                uom = UoM.objects.get(pk=uom_id)
            except UoM.DoesNotExist:
                pass

        price_gross = PricingService.get_product_price(product, Decimal(str(quantity)), uom=uom)
        price_net = (price_gross / get_vat_multiplier()).quantize(
            Decimal("1"), rounding="ROUND_HALF_UP"
        )
        return {
            "price": float(price_net),
            "price_gross": float(price_gross),
            "price_net": float(price_net),
        }

    @staticmethod
    def get_effective_price(product, quantity, uom_id):
        return PricingService.get_effective_sale_price(product.id, quantity, uom_id)


class UoMService:
    """
    Servicio centralizado para gestión de Unidades de Medida (UoM).

    Proporciona funcionalidades de:
    - Conversión entre unidades de la misma categoría
    - Validación de compatibilidad de UoMs
    - Obtención de UoMs permitidos según contexto
    - Formateo inteligente de cantidades para display
    """

    @staticmethod
    def get_cached_uom_name(uid: int) -> str | None:
        """
        Retorna el nombre de la Unidad de Medida (UoM) usando caché en memoria
        para evitar N+1 (Mecánicamente extraído fuera de los serializadores).
        """
        from functools import lru_cache
        from inventory.models import UoM

        @lru_cache(maxsize=32)
        def _get_uom_name(uom_id):
            try:
                return UoM.objects.get(pk=int(uom_id)).name
            except (UoM.DoesNotExist, TypeError, ValueError):
                return None
                
        return _get_uom_name(uid)

    @staticmethod
    def convert_quantity(qty: Decimal, from_uom: UoM, to_uom: UoM) -> Decimal:
        """
        Convierte cantidad entre UoMs de la misma categoría.

        Args:
            qty: Cantidad en unidad origen
            from_uom: UoM origen
            to_uom: UoM destino

        Returns:
            Cantidad convertida en unidad destino

        Raises:
            ValidationError: Si las UoMs son de categorías diferentes

        Examples:
            >>> convert_quantity(Decimal('1.5'), kg_uom, g_uom)
            Decimal('1500')
            >>> convert_quantity(Decimal('2'), rollo_uom, metro_uom)  # 1 rollo = 50m
            Decimal('100')
        """
        if not UoMService.validate_uom_compatibility(from_uom, to_uom):
            raise ValidationError(
                f"No se puede convertir de '{from_uom.name}' ({from_uom.category.name}) "
                f"a '{to_uom.name}' ({to_uom.category.name}). "
                f"Las unidades deben pertenecer a la misma categoría."
            )

        # Si son la misma UoM, no hay conversión
        if from_uom.id == to_uom.id:
            return qty

        # Conversión usando ratios
        # Fórmula: qty_to = qty_from * (ratio_from / ratio_to)
        # Ejemplo: 1.5 kg a g -> 1.5 * (1.0 / 0.001) = 1500 g
        from_ratio = Decimal(str(from_uom.ratio))
        to_ratio = Decimal(str(to_uom.ratio))

        if to_ratio == 0:
            raise ValidationError(f"La UoM '{to_uom.name}' tiene un ratio inválido (0).")

        converted_qty = qty * (from_ratio / to_ratio)

        # Aplicar redondeo de la UoM destino
        rounding = Decimal(str(to_uom.rounding))
        return converted_qty.quantize(rounding)

    @staticmethod
    def validate_uom_compatibility(uom1: UoM, uom2: UoM) -> bool:
        """
        Valida que dos UoMs pertenezcan a la misma categoría.

        Args:
            uom1: Primera UoM
            uom2: Segunda UoM

        Returns:
            True si son compatibles (misma categoría), False en caso contrario
        """
        return uom1.category_id == uom2.category_id

    @staticmethod
    def get_allowed_uoms_for_context(product: Product, context: str) -> QuerySet:
        """
        Retorna UoMs permitidos según contexto.

        Args:
            product: Producto para el cual obtener UoMs
            context: Contexto de uso ('sale', 'purchase', 'bom', 'stock')

        Returns:
            QuerySet de UoMs permitidos

        Context behaviors:
            - 'sale': uom base + allowed_sale_uoms (restrictivo)
            - 'purchase': TODA la categoría del uom base (flexible)
            - 'bom': TODA la categoría del uom base (flexible)
            - 'stock': solo uom base
        """
        if not product.uom:
            return UoM.objects.none()

        if context == "stock":
            # Solo la unidad base
            return UoM.objects.filter(id=product.uom.id)

        elif context == "sale":
            # Base + allowed_sale_uoms (restrictivo)
            allowed_ids = [product.uom.id]
            allowed_ids.extend(product.allowed_sale_uoms.values_list("id", flat=True))
            return UoM.objects.filter(id__in=allowed_ids, is_active=True)

        elif context in ["purchase", "bom"]:
            # Toda la categoría (flexible)
            return UoM.objects.filter(category=product.uom.category, is_active=True).order_by(
                "ratio"
            )

        else:
            raise ValueError(
                f"Contexto inválido: '{context}'. Use: 'sale', 'purchase', 'bom', o 'stock'"
            )

    @staticmethod
    def get_smart_display_uom(qty: Decimal, base_uom: UoM) -> Tuple[Decimal, UoM]:
        """
        Determina la mejor UoM para mostrar una cantidad.

        Lógica:
        1. Si qty >= 1 en base_uom -> retorna (qty, base_uom)
        2. Si qty < 1 -> busca UoM más pequeño donde qty >= 1
        3. Si no encuentra -> retorna (qty, base_uom) en decimales

        Args:
            qty: Cantidad en unidad base
            base_uom: UoM base del producto

        Returns:
            Tupla (cantidad_convertida, uom_display)

        Examples:
            >>> get_smart_display_uom(Decimal('0.5'), kg_uom)
            (Decimal('500'), g_uom)
            >>> get_smart_display_uom(Decimal('100'), kg_uom)
            (Decimal('100'), kg_uom)
        """
        # Si qty >= 1, usar la unidad base
        if qty >= 1:
            return (qty, base_uom)

        # Buscar UoMs más pequeños de la misma categoría
        smaller_uoms = UoM.objects.filter(
            category=base_uom.category, ratio__lt=base_uom.ratio, is_active=True
        ).order_by("-ratio")  # De mayor a menor (más cercano a base primero)

        for smaller_uom in smaller_uoms:
            try:
                converted_qty = UoMService.convert_quantity(qty, base_uom, smaller_uom)
                # Si la cantidad convertida es >= 1, usar esta UoM
                if converted_qty >= 1:
                    return (converted_qty, smaller_uom)
            except ValidationError:
                continue

        # Fallback: retornar en base con decimales
        return (qty, base_uom)

    @staticmethod
    def format_quantity_display(qty: Decimal, base_uom: UoM, smart_convert: bool = True) -> str:
        """
        Formatea cantidad con unidad para display.

        Args:
            qty: Cantidad en unidad base
            base_uom: UoM base del producto
            smart_convert: Si True, convierte cantidades < 1 a unidad menor

        Returns:
            String formateado con cantidad y unidad

        Examples:
            >>> format_quantity_display(Decimal('100'), kg_uom)
            '100 kg'
            >>> format_quantity_display(Decimal('0.5'), kg_uom, smart_convert=True)
            '500 g'
            >>> format_quantity_display(Decimal('0.5'), kg_uom, smart_convert=False)
            '0.5 kg'
        """
        if smart_convert and qty < 1:
            display_qty, display_uom = UoMService.get_smart_display_uom(qty, base_uom)
        else:
            display_qty, display_uom = qty, base_uom

        # Formatear cantidad (eliminar ceros innecesarios)
        qty_str = str(display_qty.normalize())

        return f"{qty_str} {display_uom.name}"

    @staticmethod
    def get_conversion_hint(qty: Decimal, from_uom: UoM, to_uom: UoM) -> str:
        """
        Genera un hint de conversión para mostrar al usuario.

        Args:
            qty: Cantidad en unidad origen
            from_uom: UoM origen
            to_uom: UoM destino (típicamente la base)

        Returns:
            String con hint de conversión

        Example:
            >>> get_conversion_hint(Decimal('2'), rollo_uom, metro_uom)
            '2 Rollos = 100 Metros (stock)'
        """
        if from_uom.id == to_uom.id:
            return ""

        try:
            converted_qty = UoMService.convert_quantity(qty, from_uom, to_uom)
            from_str = f"{qty.normalize()} {from_uom.name}"
            to_str = f"{converted_qty.normalize()} {to_uom.name}"
            return f"{from_str} = {to_str} (stock)"
        except ValidationError:
            return ""


class ProductService:
    @staticmethod
    @transaction.atomic
    def create_product(validated_data: dict) -> "Product":
        """
        Creates a Product and its related graph (BOMs, UoM prices, attribute values,
        allowed sale UoMs, and initial variant generation) atomically.

        The serializer must extract all nested/M2M fields before calling this method,
        passing them as part of ``validated_data``.
        """
        from production.models import BillOfMaterials, BillOfMaterialsLine

        boms_data = validated_data.pop("boms", [])
        allowed_sale_uoms = validated_data.pop("allowed_sale_uoms", [])
        attribute_values = validated_data.pop("attribute_values", [])
        variant_generation_selection = validated_data.pop("variant_generation_selection", None)
        uom_prices_data = validated_data.pop("uom_prices", [])

        product = Product.objects.create(**validated_data)

        if allowed_sale_uoms:
            product.allowed_sale_uoms.set(allowed_sale_uoms)

        if attribute_values:
            product.attribute_values.set(attribute_values)

        for bom_data in boms_data:
            lines_data = bom_data.pop("lines", [])
            bom = BillOfMaterials.objects.create(product=product, **bom_data)
            for line_data in lines_data:
                line_data.pop("id", None)
                BillOfMaterialsLine.objects.create(bom=bom, **line_data)

        for uom_price in uom_prices_data:
            ProductUoMPrice.objects.create(product=product, **uom_price)

        if variant_generation_selection and product.has_variants:
            ProductService.generate_variants(product, variant_generation_selection)

        return product

    @staticmethod
    @transaction.atomic
    def update_product(instance: "Product", validated_data: dict) -> "Product":
        """
        Updates a Product and its related graph atomically.

        Handles:
        - Standard scalar field updates
        - M2M sync (allowed_sale_uoms, attribute_values)
        - Variant field propagation to child variants
        - BOM sync (create/update/delete)
        - UoM price replacement
        - Inline variant_updates (price, BOM cloning, etc.)
        """
        from production.models import BillOfMaterials, BillOfMaterialsLine

        boms_data = validated_data.pop("boms", None)
        allowed_sale_uoms = validated_data.pop("allowed_sale_uoms", None)
        attribute_values = validated_data.pop("attribute_values", None)
        variant_updates = validated_data.pop("variant_updates", None)
        uom_prices_data = validated_data.pop("uom_prices", None)

        # Standard scalar update
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if allowed_sale_uoms is not None:
            instance.allowed_sale_uoms.set(allowed_sale_uoms)

        if attribute_values is not None:
            instance.attribute_values.set(attribute_values)

        # Propagate parent-level fields to child variants (only for template products)
        _VARIANT_SYNC_FIELDS = {
            "uom",
            "purchase_uom",
            "can_be_sold",
            "can_be_purchased",
            "category",
            "track_inventory",
        }
        _changed_sync = {k: v for k, v in validated_data.items() if k in _VARIANT_SYNC_FIELDS}
        if (_changed_sync or allowed_sale_uoms is not None) and not instance.parent_template_id:
            _children = list(instance.variants.all())
            if _children:
                for _child in _children:
                    for _field, _value in _changed_sync.items():
                        setattr(_child, _field, _value)
                    _child.save()
                if allowed_sale_uoms is not None:
                    for _child in _children:
                        _child.allowed_sale_uoms.set(instance.allowed_sale_uoms.all())

        # BOM sync: delete missing, update existing, create new
        if boms_data is not None:
            existing_boms = {b.id: b for b in instance.boms.all()}
            incoming_ids = [b.get("id") for b in boms_data if b.get("id")]

            for bom_id, bom_obj in existing_boms.items():
                if bom_id not in incoming_ids:
                    bom_obj.delete()

            for bom_item in boms_data:
                bom_id = bom_item.get("id")
                lines_data = bom_item.pop("lines", [])
                bom_item.pop("id", None)

                if bom_id and bom_id in existing_boms:
                    bom = existing_boms[bom_id]
                    for attr, value in bom_item.items():
                        setattr(bom, attr, value)
                    bom.save()
                    bom.lines.all().delete()
                    for line_data in lines_data:
                        line_data.pop("id", None)
                        BillOfMaterialsLine.objects.create(bom=bom, **line_data)
                else:
                    bom = BillOfMaterials.objects.create(product=instance, **bom_item)
                    for line_data in lines_data:
                        line_data.pop("id", None)
                        BillOfMaterialsLine.objects.create(bom=bom, **line_data)

        # Replace UoM prices
        if uom_prices_data is not None:
            instance.uom_prices.all().delete()
            for uom_price in uom_prices_data:
                ProductUoMPrice.objects.create(product=instance, **uom_price)

        # Inline variant updates (price, BOM cloning, etc.)
        if variant_updates:
            for update_data in variant_updates:
                variant_id = update_data.get("id")
                if not variant_id:
                    continue

                try:
                    variant_product = Product.objects.get(id=variant_id, parent_template=instance)

                    for field in [
                        "sale_price",
                        "code",
                        "has_bom",
                        "product_type",
                        "price_inheritance_mode",
                        "price_surcharge",
                    ]:
                        if field in update_data:
                            setattr(variant_product, field, update_data[field])

                    mode = update_data.get("price_inheritance_mode")
                    if mode == "INHERIT":
                        variant_product.price_surcharge = None

                    if "sale_uom" in update_data:
                        uom_id = update_data["sale_uom"]
                        if uom_id:
                            variant_product.sale_uom_id = uom_id
                        else:
                            variant_product.sale_uom = None

                    copy_bom_from_raw = update_data.get("copy_bom_from")
                    if copy_bom_from_raw:
                        try:
                            if str(copy_bom_from_raw) == "template":
                                source_product = instance
                            else:
                                source_product = Product.objects.get(id=copy_bom_from_raw)
                            source_bom = source_product.boms.filter(active=True).first()

                            if source_bom:
                                variant_product.boms.all().delete()
                                new_bom = BillOfMaterials.objects.create(
                                    product=variant_product,
                                    name=source_bom.name,
                                    active=True,
                                    yield_quantity=source_bom.yield_quantity,
                                    yield_uom=source_bom.yield_uom,
                                )
                                for line in source_bom.lines.all():
                                    BillOfMaterialsLine.objects.create(
                                        bom=new_bom,
                                        component=line.component,
                                        quantity=line.quantity,
                                        uom=line.uom,
                                        is_outsourced=line.is_outsourced,
                                        supplier=line.supplier,
                                        unit_price=line.unit_price,
                                        document_type=line.document_type,
                                    )
                                variant_product.has_bom = True
                                if not variant_product.strategy.can_have_bom:
                                    variant_product.product_type = Product.Type.MANUFACTURABLE

                        except (Product.DoesNotExist, ValueError):
                            pass

                    variant_product.save()
                except Product.DoesNotExist:
                    pass

        return instance

    @staticmethod
    def bulk_annotate_reserved_qty(products):
        """
        Calculates reserved quantity for a list of products in bulk to avoid N+1 queries.
        Injects an 'annotated_qty_reserved' attribute into each product instance.
        Performs exactly 3 queries regardless of the number of products.
        """
        if not products:
            return

        from decimal import Decimal
        from production.models import WorkOrder, WorkOrderMaterial
        from sales.models import DraftCart, SaleLine, SaleOrder

        product_ids = [p.id for p in products]
        reserved_map = {p.id: Decimal("0.0") for p in products}

        # 1. Confirmed Sales (excluding fully delivered)
        pending_sales = SaleLine.objects.filter(
            product_id__in=product_ids, order__status=SaleOrder.Status.CONFIRMED
        ).exclude(order__delivery_status=SaleOrder.DeliveryStatus.DELIVERED)
        
        for line in pending_sales:
            # We calculate quantity_pending in Python, but only for lines matching the criteria
            reserved_map[line.product_id] += line.quantity_pending

        # 2. POS Drafts (only OPEN sessions)
        active_drafts = DraftCart.objects.filter(pos_session__status="OPEN")
        for draft in active_drafts:
            if draft.items and isinstance(draft.items, list):
                for item in draft.items:
                    item_p_id = item.get("id") or item.get("product_id")
                    if item_p_id and int(item_p_id) in reserved_map:
                        reserved_map[int(item_p_id)] += Decimal(str(item.get("quantity", 0)))

        # 3. Work Orders
        pending_ot_materials = WorkOrderMaterial.objects.filter(
            component_id__in=product_ids,
            work_order__status__in=[WorkOrder.Status.DRAFT, WorkOrder.Status.IN_PROGRESS],
        )
        for material in pending_ot_materials:
            remaining = material.quantity_planned - material.quantity_consumed
            if remaining > 0:
                reserved_map[material.component_id] += remaining

        # Inject into products
        for p in products:
            p.annotated_qty_reserved = reserved_map[p.id]

    @staticmethod
    def check_archiving_restrictions(product: Product):
        """
        Checks for dependencies that prevent archiving a product.
        Returns a list of dicts with {type, label, description, count, link} for feedback.
        """
        restrictions = []

        # 1. Stock
        on_hand = product.qty_on_hand
        if on_hand > 0:
            restrictions.append(
                {
                    "type": "stock",
                    "label": "Stock Activo",
                    "description": f"El producto tiene {on_hand} {product.uom.name if product.uom else ''} en inventario.",
                    "action_hint": "Ajuste el stock a cero para proceder.",
                    "count": float(on_hand),
                    "link": "/inventory/stock",
                }
            )

        # 2. BOM as component
        from production.models import BillOfMaterialsLine

        bom_lines = BillOfMaterialsLine.objects.filter(component=product, bom__active=True)
        if bom_lines.exists():
            restrictions.append(
                {
                    "type": "bom_component",
                    "label": "Componente de BOM",
                    "description": f"Este producto es parte de {bom_lines.count()} Lista(s) de Materiales activa(s).",
                    "action_hint": "Elimine el producto de los BOMs o desactive los BOMs para proceder.",
                    "count": bom_lines.count(),
                    "link": "/production/boms",
                }
            )

        # 3. BOM as finished product
        from production.models import BillOfMaterials

        boms = BillOfMaterials.objects.filter(product=product, active=True)
        if boms.exists():
            restrictions.append(
                {
                    "type": "bom_parent",
                    "label": "Producto con BOM",
                    "description": "Este producto tiene una Lista de Materiales activa.",
                    "action_hint": "Desactive el BOM del producto para proceder.",
                    "count": boms.count(),
                    "link": "/production/boms",
                }
            )

        # 4. Pending Work Orders
        from production.models import WorkOrder

        pending_ots = WorkOrder.objects.filter(
            models.Q(product=product)
            | models.Q(sale_line__product=product)
            | models.Q(materials__component=product),
            status__in=[WorkOrder.Status.DRAFT, WorkOrder.Status.IN_PROGRESS],
        ).distinct()
        if pending_ots.exists():
            restrictions.append(
                {
                    "type": "work_order",
                    "label": "Órdenes de Trabajo Pendientes",
                    "description": f"Hay {pending_ots.count()} OT(s) en proceso que requieren o fabrican este producto.",
                    "action_hint": "Finalice, cierre o anule las OTs pendientes para proceder.",
                    "count": pending_ots.count(),
                    "link": "/production/orders",
                }
            )

        # 5. Pending Sale Orders
        from sales.models import SaleLine, SaleOrder

        pending_sales = (
            SaleLine.objects.filter(
                product=product,
                order__status__in=[SaleOrder.Status.DRAFT, SaleOrder.Status.CONFIRMED],
            )
            .exclude(order__delivery_status=SaleOrder.DeliveryStatus.DELIVERED)
            .distinct()
        )
        if pending_sales.exists():
            restrictions.append(
                {
                    "type": "sale_order",
                    "label": "Notas de Venta Pendientes",
                    "description": f"Hay {pending_sales.count()} Nota(s) de Venta con despachos pendientes.",
                    "action_hint": "Complete los despachos o anule las Notas de Venta para proceder.",
                    "count": pending_sales.count(),
                    "link": "/billing/sales",
                }
            )

        # 6. Pending Purchase Orders
        from purchasing.models import PurchaseLine, PurchaseOrder

        pending_purchases = (
            PurchaseLine.objects.filter(
                product=product,
                order__status__in=[PurchaseOrder.Status.DRAFT, PurchaseOrder.Status.CONFIRMED],
            )
            .exclude(order__receiving_status=PurchaseOrder.ReceivingStatus.RECEIVED)
            .distinct()
        )
        if pending_purchases.exists():
            restrictions.append(
                {
                    "type": "purchase_order",
                    "label": "Órdenes de Compra en Proceso",
                    "description": f"Hay {pending_purchases.count()} Orden(es) de Compra pendientes de recepción.",
                    "action_hint": "Finalice las recepciones o anule las órdenes para proceder.",
                    "count": pending_purchases.count(),
                    "link": "/billing/purchases",
                }
            )

        # 7. Active Subscriptions
        from .models import Subscription

        active_subs = Subscription.objects.filter(
            product=product, status=Subscription.Status.ACTIVE
        )
        if active_subs.exists():
            restrictions.append(
                {
                    "type": "subscription",
                    "label": "Suscripciones Activas",
                    "description": f"Este producto tiene {active_subs.count()} suscripción(es) activa(s).",
                    "action_hint": "Pause o cancele las suscripciones para proceder.",
                    "count": active_subs.count(),
                    "link": "/subscriptions",
                }
            )

        return restrictions

    @staticmethod
    def check_availability(lines: list) -> dict:
        from decimal import Decimal
        from inventory.models import Product, UoM

        details = []
        all_available = True

        for line in lines:
            product_id = line.get("product_id")
            requested_qty = Decimal(str(line.get("quantity", 0)))
            uom_id = line.get("uom_id")

            try:
                product = Product.objects.get(pk=product_id)
            except Product.DoesNotExist:
                continue

            if uom_id and product.uom_id != uom_id:
                try:
                    uom = UoM.objects.get(pk=uom_id)
                    requested_qty = requested_qty * uom.ratio
                except UoM.DoesNotExist:
                    pass

            line_detail = {
                "product_id": product.id,
                "product_name": product.name,
                "requested_qty": float(requested_qty),
                "product_type": product.product_type,
                "missing_components": [],
            }

            if product.strategy.can_have_bom:
                if product.has_bom:
                    manufacturable_qty = product.manufacturable_quantity or 0
                    line_detail["manufacturable_qty"] = float(manufacturable_qty)
                    line_detail["is_available"] = requested_qty <= manufacturable_qty

                    if not line_detail["is_available"]:
                        all_available = False

                        from production.models import BillOfMaterials
                        try:
                            bom = BillOfMaterials.objects.get(product=product, active=True)
                            for component in bom.components.all():
                                comp_product = component.component
                                required_qty = component.quantity * requested_qty
                                available_qty = comp_product.qty_available

                                if required_qty > available_qty:
                                    line_detail["missing_components"].append(
                                        {
                                            "component_id": comp_product.id,
                                            "component_name": comp_product.name,
                                            "required_qty": float(required_qty),
                                            "available_qty": float(available_qty),
                                            "missing_qty": float(required_qty - available_qty),
                                        }
                                    )
                        except BillOfMaterials.DoesNotExist:
                            pass

            elif product.strategy.tracks_inventory:
                available_qty = product.qty_available
                line_detail["available_qty"] = float(available_qty)
                line_detail["is_available"] = requested_qty <= available_qty

                if not line_detail["is_available"]:
                    all_available = False

            else:
                line_detail["is_available"] = True
                line_detail["available_qty"] = float("inf")

            details.append(line_detail)

        return {"available": all_available, "details": details}

    @staticmethod
    def generate_variants(template: Product, selection: list) -> dict:
        """
        Generates product variants for a given template and attribute selection.
        selection: List of {attribute: id, values: [ids]}
        """
        if not template.has_variants:
            return {
                "error": "El producto no tiene activada la opción de variantes.",
                "success": False,
            }

        # Prepare lists of values for each attribute
        attr_values_lists = []
        for item in selection:
            attr_id = item.get("attribute")
            val_ids = item.get("values", [])
            if val_ids:
                attr_values_lists.append(
                    list(ProductAttributeValue.objects.filter(id__in=val_ids, attribute_id=attr_id))
                )

        if not attr_values_lists:
            return {"error": "Debe seleccionar valores de atributos.", "success": False}

        # Cartesian product of attribute values
        combinations = list(itertools.product(*attr_values_lists))

        created_count = 0
        skipped_count = 0

        with transaction.atomic():
            for combo in combinations:
                # Check if variant already exists
                existing_variants = Product.objects.filter(parent_template=template)
                for val in combo:
                    existing_variants = existing_variants.filter(attribute_values=val)

                # Ensure it has exactly the same number of attributes to avoid partial matches
                existing_variants = [
                    v for v in existing_variants if v.attribute_values.count() == len(combo)
                ]

                if existing_variants:
                    skipped_count += 1
                    continue

                # Create the variant
                variant = Product.objects.create(
                    name=template.name,
                    category=template.category,
                    product_type=template.product_type,
                    uom=template.uom,
                    sale_uom=template.sale_uom,
                    purchase_uom=template.purchase_uom,
                    receiving_warehouse=template.receiving_warehouse,
                    track_inventory=template.track_inventory,
                    can_be_sold=template.can_be_sold,
                    can_be_purchased=template.can_be_purchased,
                    parent_template=template,
                    sale_price=template.sale_price,
                    cost_price=template.cost_price,
                    requires_advanced_manufacturing=template.requires_advanced_manufacturing,
                    mfg_auto_finalize=template.mfg_auto_finalize,
                    mfg_enable_prepress=template.mfg_enable_prepress,
                    mfg_enable_press=template.mfg_enable_press,
                    mfg_enable_postpress=template.mfg_enable_postpress,
                    price_inheritance_mode=Product.PriceInheritance.INHERIT,
                )
                variant.attribute_values.set(combo)
                variant.save()  # Triggers display name generation

                if getattr(template, "manufacturing_profile", None):
                    from inventory.models import ProductManufacturingProfile

                    profile = ProductManufacturingProfile.objects.get(product=template)
                    profile.pk = None
                    profile.product = variant
                    profile.save()

                created_count += 1

        return {"success": True, "created": created_count, "skipped": skipped_count}

    @staticmethod
    @transaction.atomic
    def bulk_clone_bom(template: Product, variant_ids: list = None) -> dict:
        """
        Clones the active BOM from a template product onto the specified variants
        (or all active variants if variant_ids is empty).
        """
        from production.models import BillOfMaterials, BillOfMaterialsLine

        source_bom = template.boms.filter(active=True).first()
        if not source_bom:
            raise ValidationError(
                "El template no tiene una Lista de Materiales activa para clonar."
            )

        variants_qs = template.variants.filter(is_active=True)
        if variant_ids:
            variants_qs = variants_qs.filter(id__in=variant_ids)

        cloned_count = 0
        for variant in variants_qs:
            variant.boms.all().delete()

            new_bom = BillOfMaterials.objects.create(
                product=variant,
                name=source_bom.name,
                active=True,
                yield_quantity=source_bom.yield_quantity,
                yield_uom=source_bom.yield_uom,
            )
            for line in source_bom.lines.all():
                BillOfMaterialsLine.objects.create(
                    bom=new_bom,
                    component=line.component,
                    quantity=line.quantity,
                    uom=line.uom,
                    is_outsourced=line.is_outsourced,
                    supplier=line.supplier,
                    unit_price=line.unit_price,
                    document_type=line.document_type,
                )
            variant.has_bom = True
            variant.product_type = Product.Type.MANUFACTURABLE
            variant.save(update_fields=["has_bom", "product_type"])
            cloned_count += 1

        return {
            "message": f"BOM clonada en {cloned_count} variante(s).",
            "cloned": cloned_count,
        }

    @staticmethod
    def bulk_set_surcharge(template, variant_ids, surcharge):
        from decimal import Decimal
        from .models import Product

        variants_qs = template.variants.filter(is_active=True)
        if variant_ids:
            variants_qs = variants_qs.filter(id__in=variant_ids)

        updated = variants_qs.update(
            price_inheritance_mode=Product.PriceInheritance.SURCHARGE,
            price_surcharge=Decimal(str(surcharge)),
        )
        return updated
