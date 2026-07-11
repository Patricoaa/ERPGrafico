import traceback
from decimal import Decimal
from sales.models import DraftCart
from sales.draft_cart_service import DraftCartService

cart = DraftCart.objects.filter(customer__isnull=False).first()
if cart:
    print(f"Processing cart {cart.id}")
    try:
        res = DraftCartService.process_withdrawal(cart, None)
        print(res)
    except Exception as e:
        traceback.print_exc()
else:
    print("No draft cart with customer found")
