from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import InvoiceViewSet
from .note_views import NoteWorkflowViewSet

router = DefaultRouter()
router.register(r'invoices', InvoiceViewSet)
router.register(r'note-workflows', NoteWorkflowViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
