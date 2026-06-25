from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .note_views import NoteWorkflowViewSet
from .views import InvoiceViewSet

router = DefaultRouter()
router.register(r"invoices", InvoiceViewSet, basename="invoice")
router.register(r"note-workflows", NoteWorkflowViewSet, basename="noteworkflow")

urlpatterns = [
    path("", include(router.urls)),
]
