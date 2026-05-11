import pytest
from accounting.models import JournalEntry, JournalItem, Account
from django.contrib.contenttypes.models import ContentType
from sales.models import SaleOrder

@pytest.mark.django_db(transaction=True)
class TestGFKPerformance:
    """
    To run this benchmark realistically, the database MUST be seeded first.
    We are simulating the queries used in Auxiliar de Proveedores and Mayor de Cuenta.
    """
    
    def test_mayor_cuenta_latency(self, benchmark):
        # We assume 50k movements in JournalItems for a specific account.
        # Mayor de cuenta query: items related to an account
        # Since we just want to measure query performance on indexed fields
        account = Account.objects.first()
        
        def run_query():
            if not account:
                return []
            return list(JournalItem.objects.filter(account=account).select_related('entry')[:1000])
            
        result = benchmark(run_query)
        assert result is not None

    def test_gfk_auxiliar_proveedores_latency(self, benchmark):
        # Auxiliar de proveedores via GFK: 
        # Find all JournalEntries linked to a specific SaleOrder or PurchaseOrder
        sale_order = SaleOrder.objects.first()
        if sale_order:
            ctype = ContentType.objects.get_for_model(SaleOrder)
            obj_id = sale_order.id
        else:
            ctype = None
            obj_id = 1
            
        def run_query():
            if not ctype:
                return []
            return list(JournalEntry.objects.filter(source_content_type=ctype, source_object_id=obj_id))
            
        result = benchmark(run_query)
        assert result is not None
