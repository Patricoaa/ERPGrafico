import pytest
from core.registry import UniversalRegistry

@pytest.mark.django_db(transaction=True)
class TestSearchPerformance:
    """
    To run this benchmark realistically, the database MUST be seeded first.
    Use: python manage.py seed_benchmark_data
    Then: pytest test_performance.py --benchmark-only
    """
    
    def test_search_latency_carlos(self, benchmark, django_user_model):
        user = django_user_model.objects.create_superuser('perf_user', 'perf@example.com', 'pass')
        
        # We benchmark the search across all registered entities
        # Query: 'Carlos' (matches Contacts)
        def run_search():
            return UniversalRegistry.search('Carlos', user=user)
            
        result = benchmark(run_search)
        assert result is not None

    def test_search_latency_nv001(self, benchmark, django_user_model):
        user = django_user_model.objects.get_or_create(username='perf_user')[0]
        
        # Query: 'NV-001' (matches SaleOrders)
        def run_search():
            return UniversalRegistry.search('NV-001', user=user)
            
        result = benchmark(run_search)
        assert result is not None

    def test_search_latency_rut(self, benchmark, django_user_model):
        user = django_user_model.objects.get_or_create(username='perf_user')[0]
        
        # Query: '76.' (matches tax_ids)
        def run_search():
            return UniversalRegistry.search('76.', user=user)
            
        result = benchmark(run_search)
        assert result is not None
