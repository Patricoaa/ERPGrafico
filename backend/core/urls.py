from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet, CompanySettingsViewSet

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'company', CompanySettingsViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
