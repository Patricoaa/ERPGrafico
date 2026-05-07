"""
Channels middleware: JWT authentication for WebSocket connections.

The WebSocket protocol does not support custom headers during the handshake,
so we extract the JWT from the query string: ws://host/ws/path/?token=<jwt>

This is the industry-standard approach used by Discord, Slack, Firebase, etc.
Over WSS (TLS), the query string is encrypted in transit.
"""
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from core.models import User
from urllib.parse import parse_qs


class JWTAuthMiddleware(BaseMiddleware):
    """
    Extracts JWT access token from WebSocket query string and
    populates scope["user"] for downstream consumers.

    Usage in asgi.py:
        JWTAuthMiddleware(URLRouter(...))

    Client connects with:
        new WebSocket("ws://host/ws/notifications/?token=<access_token>")
    """

    async def __call__(self, scope, receive, send):
        query_string = scope.get("query_string", b"").decode()
        query_params = parse_qs(query_string)
        token = query_params.get("token", [None])[0]

        if token:
            scope["user"] = await self.get_user_from_token(token)
        else:
            scope["user"] = AnonymousUser()

        return await super().__call__(scope, receive, send)

    @database_sync_to_async
    def get_user_from_token(self, token_str):
        """Validate JWT and return the corresponding User, or AnonymousUser on failure."""
        try:
            access_token = AccessToken(token_str)
            return User.objects.get(id=access_token["user_id"])
        except Exception:
            return AnonymousUser()
