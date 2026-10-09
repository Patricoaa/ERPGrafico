import traceback

from sales.draft_cart_service import DraftCartService
from sales.models import DraftCart

cart = DraftCart.objects.filter(customer__isnull=False).first()
if cart:
    print(f"Processing cart {cart.id}")
    try:
        res = DraftCartService.process_withdrawal(cart, None)
        print(res)
    except Exception:
        traceback.print_exc()
else:
    print("No draft cart with customer found")
