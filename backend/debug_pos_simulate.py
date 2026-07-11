import traceback
from decimal import Decimal
from sales.models import DraftCart
from sales.draft_cart_service import DraftCartService
from contacts.models import Contact
from inventory.models import Product
from treasury.models import POSSession
import json

session = POSSession.objects.first()
if not session:
    session = POSSession.objects.create()

customer = Contact.objects.filter(is_customer=True).first()
if not customer:
    customer = Contact.objects.create(name="Debug Customer", is_customer=True)

p = Product.objects.filter(name__icontains="Tinta Offset Magenta").first()

items_json = [{"id": p.id, "quantity": 1, "unit_price": 10.00}]

cart = DraftCart.objects.create(name="Debug POS Cart", customer=customer, pos_session=session, items=items_json)

try:
    DraftCartService.process_withdrawal(cart, None)
    print("Success")
except Exception as e:
    import logging
    print("Failed:")
    traceback.print_exc()
