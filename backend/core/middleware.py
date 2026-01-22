import json
from django.utils.deprecation import MiddlewareMixin
from .services import ActionLoggingService
from .models import ActionLog

class AuditMiddleware(MiddlewareMixin):
    """
    Middleware to automatically audit configuration changes.
    Intercepts successful state-changing requests (POST, PUT, PATCH, DELETE)
    to paths identified as 'settings' or 'configuration'.
    """
    
    # Paths prefixes that are considered "Configuration"
    # We can expand this list or make it dynamic
    CONFIG_PATHS = [
        '/api/company/',
        '/api/users/',
        '/api/accounting/settings/',
        '/api/core/company/', # Just in case
    ]

    def process_response(self, request, response):
        # 1. Filter relevant methods (State changing)
        if request.method not in ['POST', 'PUT', 'PATCH', 'DELETE']:
            return response

        # 2. Filter success responses only (2xx)
        if not (200 <= response.status_code < 300):
            return response
            
        # 3. Filter authenticated users only
        if not request.user.is_authenticated:
            return response

        # 4. Check if path is relevant (Settings/Config)
        path = request.path
        is_config = any(path.startswith(prefix) for prefix in self.CONFIG_PATHS)
        
        # Also catch any path with 'settings' or 'config' in it
        if not is_config and ('settings' in path or 'config' in path):
            is_config = True
            
        if not is_config:
            return response

        # 5. Log the action
        try:
            method_map = {
                'POST': 'Creación',
                'PUT': 'Actualización',
                'PATCH': 'Actualización Parcial',
                'DELETE': 'Eliminación'
            }
            action_verb = method_map.get(request.method, 'Modificación')
            
            description = f"{action_verb} de configuración en: {path}"
            
            # Try to get more info from body for description if possible?
            # Safe enough just to log the endpoint access for now.
            
            ActionLoggingService.log_action(
                user=request.user,
                action_type=ActionLog.Type.SETTINGS_CHANGE,
                description=description,
                request=request,
                metadata={
                    'method': request.method,
                    'path': path,
                    'status_code': response.status_code
                }
            )
        except Exception as e:
            # Never block the response due to logging failure
            print(f"Audit Middleware Error: {e}")

        return response
