from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from inventory.services import PricingService


class PricingViewSet(viewsets.ViewSet):
    @action(detail=False, methods=["get"], url_path="effective-sale-price")
    def effective_sale_price(self, request):
        product_id = request.query_params.get("product_id")
        quantity = request.query_params.get("quantity", 1)
        uom_id = request.query_params.get("uom_id")

        if not product_id:
            return Response({"error": "product_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = PricingService.get_effective_sale_price(product_id, quantity, uom_id)
            return Response(result)
        except PricingService.ProductNotFound:
            return Response({"error": "Product not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
