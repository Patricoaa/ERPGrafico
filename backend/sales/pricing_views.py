from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from decimal import Decimal
from inventory.models import Product, UoM
from inventory.services import PricingService

class PricingViewSet(viewsets.ViewSet):
    """
    ViewSet para consultas de precios y promociones.
    """
    
    @action(detail=False, methods=['get'], url_path='effective-sale-price')
    def effective_sale_price(self, request):
        """
        Calcula el precio efectivo de un producto considerando reglas de precios.
        GET /api/sales/pricing/effective-sale-price/?product_id=X&quantity=Y&uom_id=Z
        """
        product_id = request.query_params.get('product_id')
        quantity = Decimal(request.query_params.get('quantity', 1))
        uom_id = request.query_params.get('uom_id')
        
        if not product_id:
            return Response(
                {"error": "product_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            product = Product.objects.get(pk=product_id)
        except Product.DoesNotExist:
            return Response(
                {"error": "Product not found"},
                status=status.HTTP_404_NOT_FOUND
            )
            
        uom = None
        if uom_id:
            try:
                uom = UoM.objects.get(pk=uom_id)
            except UoM.DoesNotExist:
                pass
                
        price_gross = PricingService.get_product_price(product, quantity, uom=uom)
        # Assuming 19% VAT (IVA) as per inventory view logic
        price_net = (price_gross / Decimal('1.19')).quantize(Decimal('1'), rounding='ROUND_HALF_UP')
        
        return Response({
            'price': float(price_net),
            'price_gross': float(price_gross),
            'price_net': float(price_net)
        })
