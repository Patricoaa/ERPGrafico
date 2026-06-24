from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .profit_distribution_views import ProfitDistributionResolutionViewSet
from .views import ContactViewSet

router = DefaultRouter()
router.register(
    r"profit-distributions", ProfitDistributionResolutionViewSet, basename="profit-distribution"
)
router.register(r"", ContactViewSet, basename="contact")

urlpatterns = [
    path("", include(router.urls)),
]
