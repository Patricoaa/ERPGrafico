from django.contrib.auth.signals import user_logged_in, user_logged_out
from django.dispatch import receiver
from .models import ActionLog
from .services import ActionLoggingService

@receiver(user_logged_in)
def on_user_login(sender, request, user, **kwargs):
    ActionLoggingService.log_action(
        user=user,
        action_type=ActionLog.Type.LOGIN,
        description=f"Usuario {user.username} ha iniciado sesión.",
        request=request
    )

@receiver(user_logged_out)
def on_user_logout(sender, request, user, **kwargs):
    if user:
        ActionLoggingService.log_action(
            user=user,
            action_type=ActionLog.Type.LOGOUT,
            description=f"Usuario {user.username} ha cerrado sesión.",
            request=request
        )
