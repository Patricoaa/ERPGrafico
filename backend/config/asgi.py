import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from core.ws_auth import JWTAuthMiddleware
import sales.routing
import workflow.routing

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Get the basic ASGI application (for HTTP)
django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": JWTAuthMiddleware(
        URLRouter(
            sales.routing.websocket_urlpatterns +
            workflow.routing.websocket_urlpatterns
        )
    ),
})

