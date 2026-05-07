from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    # Ruta: ws/sales/pos/<session_id>/
    re_path(r'ws/sales/pos/(?P<session_id>\d+)/$', consumers.POSDraftConsumer.as_asgi()),
]
