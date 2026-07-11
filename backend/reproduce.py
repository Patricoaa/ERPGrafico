import traceback
from decimal import Decimal
from sales.models import DraftCart
from sales.draft_cart_service import DraftCartService
from contacts.models import Contact
from inventory.models import Product, Warehouse, Location
from treasury.models import POSSession
from core.models import User
import json
import logging

logging.basicConfig(level=logging.ERROR)

user = User.objects.first()
session = POSSession.objects.first()

customer = Contact.objects.filter(is_partner=True).first()

p = Product.objects.filter(name__icontains="Tinta Offset Magenta").first()
wh, _ = Warehouse.objects.get_or_create(name="Main WH")
Location.objects.get_or_create(location_type="INTERNAL", warehouse=wh, name="Main Internal")

items_json = [{"id": p.id, "quantity": 1, "unit_price": 10.00}]

cart = DraftCart.objects.create(name="Debug POS Cart 2", customer=customer, pos_session=session, session_local_id=998, items=items_json)

try:
    DraftCartService.process_withdrawal(draft_id=cart.id, pos_session_id=session.id, user=user)
    print("Success")
except Exception as e:
    print("Failed with Exception:")
    traceback.print_exc()
