import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import config.settings
config.settings.CACHES = {'default': {'BACKEND': 'django.core.cache.backends.dummy.DummyCache'}}
django.setup()

from django.test import RequestFactory
from rest_framework.test import force_authenticate
from treasury.views import POSSessionViewSet
from treasury.models import POSSession, TreasuryMovement, TreasuryAccount, PaymentMethod
from contacts.models import Contact
from core.models import User
from django.utils import timezone
import traceback

factory = RequestFactory()
request = factory.get('/api/treasury/pos-sessions/current/')
user = User.objects.first()

session = POSSession.objects.filter(user=user, status='OPEN').first()
if not session:
    account = TreasuryAccount.objects.first()
    session = POSSession.objects.create(user=user, treasury_account=account, status='OPEN', opened_at=timezone.now(), opening_balance=100)

movement = TreasuryMovement.objects.filter(pos_session=session).first()
if not movement:
    payment_method = PaymentMethod.objects.first()
    contact = Contact.objects.first()
    TreasuryMovement.objects.create(
        account=session.treasury_account,
        pos_session=session,
        amount=50,
        movement_type='INBOUND',
        payment_method_new=payment_method,
        contact=contact,
        date=timezone.now().date(),
        created_by=user
    )

force_authenticate(request, user=user)
view = POSSessionViewSet.as_view({'get': 'current'})

try:
    response = view(request)
    print("STATUS:", response.status_code)
except Exception as e:
    traceback.print_exc()
