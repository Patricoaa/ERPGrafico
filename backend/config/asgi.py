import os

from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# Initialize Django BEFORE importing any app modules
# (get_asgi_application calls django.setup())
django_asgi_app = get_asgi_application()

# App imports must come AFTER django.setup() — they reference models
import core.routing  # noqa: E402
import sales.routing  # noqa: E402
import workflow.routing  # noqa: E402
from core.ws_auth import JWTAuthMiddleware  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": JWTAuthMiddleware(
            URLRouter(
                core.routing.websocket_urlpatterns
                + sales.routing.websocket_urlpatterns
                + workflow.routing.websocket_urlpatterns
            )
        ),
    }
)
