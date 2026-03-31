from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ContactViewSet
from .profit_distribution_views import ProfitDistributionResolutionViewSet

router = DefaultRouter()
router.register(r'profit-distributions', ProfitDistributionResolutionViewSet, basename='profit-distribution')
router.register(r'', ContactViewSet, basename='contact')

urlpatterns = [
    path('', include(router.urls)),
]
