from rest_framework import permissions

class StandardizedModelPermissions(permissions.DjangoModelPermissions):
    """
    Extends DjangoModelPermissions to ensure strict enforcement.
    
    Default behavior of DjangoModelPermissions:
    - POST -> add_model
    - PUT/PATCH -> change_model
    - DELETE -> delete_model
    - GET -> (No check by default!) 
    
    We override this to ENFORCE 'view_model' permission for GET requests.
    """
    perms_map = {
        'GET': ['%(app_label)s.view_%(model_name)s'],
        'OPTIONS': [],
        'HEAD': [],
        'POST': ['%(app_label)s.add_%(model_name)s'],
        'PUT': ['%(app_label)s.change_%(model_name)s'],
        'PATCH': ['%(app_label)s.change_%(model_name)s'],
        'DELETE': ['%(app_label)s.delete_%(model_name)s'],
    }

class HasActionPermission(permissions.BasePermission):
    """
    Checks for a specific, explicit permission string required by a view.
    Usage:
        class MyView(APIView):
            permission_classes = [HasActionPermission]
            required_permission = 'sales.approve_large_orders'
    """
    def has_permission(self, request, view):
        required_perm = getattr(view, 'required_permission', None)
        if not required_perm:
            return True # No specific permission required
        
        return request.user.has_perm(required_perm)
