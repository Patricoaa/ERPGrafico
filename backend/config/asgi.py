import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Initialize Django BEFORE importing any app modules
# (get_asgi_application calls django.setup())
django_asgi_app = get_asgi_application()

# App imports must come AFTER django.setup() — they reference models
from core.ws_auth import JWTAuthMiddleware  # noqa: E402
import sales.routing  # noqa: E402
import workflow.routing  # noqa: E402

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": JWTAuthMiddleware(
        URLRouter(
            sales.routing.websocket_urlpatterns +
            workflow.routing.websocket_urlpatterns
        )
    ),
})

