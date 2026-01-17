"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    # TokenRefreshView, # Removed to use custom view
)

from django.conf import settings
from django.conf.urls.static import static
from core.views import CurrentUserView, CustomTokenRefreshView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/accounting/', include('accounting.urls')),
    path('api/contacts/', include('contacts.urls')),
    path('api/sales/', include('sales.urls')),
    path('api/inventory/', include('inventory.urls')),
    path('api/purchasing/', include('purchasing.urls')),
    path('api/production/', include('production.urls')),
    path('api/treasury/', include('treasury.urls')),
    path('api/finances/', include('finances.urls')),
    path('api/core/', include('core.urls')),
    path('api/billing/', include('billing.urls')),
    
    # Auth endpoints
    path('api/auth/user/', CurrentUserView.as_view(), name='current-user'),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

