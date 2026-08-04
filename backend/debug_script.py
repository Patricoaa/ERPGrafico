from inventory.models import *
from inventory.services import InventoryService
p = Product.objects.filter(name__icontains="Tinta Offset Magenta").first()
loc_cap = Location.objects.filter(name="Capital de Socios").first()
w = Warehouse.objects.first()
internal_loc = Location.objects.filter(location_type="INTERNAL", warehouse=w).first()

print("P:", p, "Asset:", p.get_asset_account)
print("Internal:", internal_loc, internal_loc.location_type)
print("Capital:", loc_cap, loc_cap.location_type, loc_cap.account)

credit_account = p.get_asset_account if internal_loc.location_type == 'INTERNAL' else internal_loc.account
debit_account = p.get_asset_account if loc_cap.location_type == 'INTERNAL' else loc_cap.account

print("Credit:", credit_account)
print("Debit:", debit_account)
print("Not credit or not debit:", not credit_account or not debit_account)
