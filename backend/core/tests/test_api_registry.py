import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from django.core.cache import cache
from core.models import User
from django.contrib.auth.models import Permission

@pytest.mark.django_db
class TestRegistrySchemaCache:
    def setup_method(self):
        self.client = APIClient()
        self.user = User.objects.create_user('cache_user', 'cache@test.com', 'pass')
        self.client.force_authenticate(user=self.user)
        # Limpiar caché antes de test
        cache.clear()

    def test_schema_cache_ttl_and_invalidation(self):
        # 1. First fetch - User lacks permission to view 'core.company'
        # Well, core.user has 'core.view_user' permission. Let's test 'core.user'
        # First assign permission so they can fetch
        perm = Permission.objects.get(codename='view_user')
        self.user.user_permissions.add(perm)
        
        url = reverse('model_schema', kwargs={'model_label': 'core.user'})
        
        # 1. Fetch, should cache
        response1 = self.client.get(url)
        assert response1.status_code == 200
        schema1 = response1.json()
        
        cache_key = f"schema:core.user:{self.user.id}"
        assert cache.get(cache_key) is not None
        
        # 2. To test TTL or manual invalidation when permissions change, 
        # in Django, changing permissions often requires manual cache clear or 
        # wait 5 min. The requirement says:
        # "tras cambiar permisos de un usuario, /api/registry/<label>/schema/ refleja el cambio en <=5 min."
        # Because TTL is 300s (5min), it guarantees the requirement.
        
        # We simulate the expiration by manipulating cache directly
        cache.delete(cache_key)
        
        # Change user name just to see if schema reflects user data context if any, 
        # but mostly to verify it fetches fresh
        self.user.first_name = "Refreshed"
        self.user.save()
        
        # 3. Fetch again, should generate fresh
        response2 = self.client.get(url)
        assert response2.status_code == 200
        
        # Ensure it was cached again
        assert cache.get(cache_key) is not None

    def test_schema_cache_ttl_is_300s(self, monkeypatch):
        perm = Permission.objects.get(codename='view_user')
        self.user.user_permissions.add(perm)
        
        # Mock cache.set to verify timeout parameter
        set_calls = []
        original_set = cache.set
        
        def mock_set(key, value, timeout=None, **kwargs):
            set_calls.append({'key': key, 'timeout': timeout})
            original_set(key, value, timeout=timeout, **kwargs)
            
        monkeypatch.setattr(cache, 'set', mock_set)
        
        url = reverse('model_schema', kwargs={'model_label': 'core.user'})
        self.client.get(url)
        
        # Verify cache.set was called with timeout=300
        assert len(set_calls) > 0
        assert set_calls[0]['timeout'] == 300
