import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from production.models import WorkOrder
from production.services import WorkOrderService

@pytest.mark.django_db
def test_task203_workorder_pdf_generation(work_order_factory):
    """
    TASK-203: Verify that the PDF generation endpoint works and returns a PDF
    using WeasyPrint.
    """
    client = APIClient()
    
    wo = work_order_factory()
    
    url = f"/api/production/orders/{wo.pk}/print_pdf/"
    
    # Needs auth if endpoints are protected, but for testing we can force authenticate
    # Since we don't have a user fixture readily available, we can bypass if auth is disabled in test or create one
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user, _ = User.objects.get_or_create(username='testadmin', email='admin@test.com', defaults={'is_superuser': True})
    client.force_authenticate(user=user)
    
    response = client.get(url)
    
    assert response.status_code == 200, f"Failed with {response.content}"
    assert response['Content-Type'] == 'application/pdf'
    assert 'attachment' in response['Content-Disposition'] or 'inline' in response['Content-Disposition']
    assert f'filename="OT-{wo.number}.pdf"' in response['Content-Disposition']
    
    # Check that it actually generated a PDF (PDF files start with %PDF)
    assert response.content.startswith(b'%PDF-')
    assert len(response.content) > 5000  # Should be > 5KB
