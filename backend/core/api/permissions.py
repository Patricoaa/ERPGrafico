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
        "GET": ["%(app_label)s.view_%(model_name)s"],
        "OPTIONS": [],
        "HEAD": [],
        "POST": ["%(app_label)s.add_%(model_name)s"],
        "PUT": ["%(app_label)s.change_%(model_name)s"],
        "PATCH": ["%(app_label)s.change_%(model_name)s"],
        "DELETE": ["%(app_label)s.delete_%(model_name)s"],
    }

    def has_permission(self, request, view):
        # Explicit per-action permissions (view.action_permissions). Evaluated before
        # the "no queryset" branch so modelless ViewSets are covered too (C4).
        # None means "reviewed, use the HTTP method map below".
        action_permissions = getattr(view, "action_permissions", {})
        action = getattr(view, "action", None)
        if action in action_permissions and action_permissions[action] is not None:
            required = action_permissions[action]
            perms = (required,) if isinstance(required, str) else tuple(required)
            user = request.user
            return bool(user and user.is_authenticated and user.has_perms(perms))

        # If the view doesn't have a queryset, DjangoModelPermissions will blow up.
        # This happens in pure viewsets.ViewSet classes used for reports/actions.
        if not hasattr(view, "queryset") and not hasattr(view, "get_queryset"):
            return request.user and request.user.is_authenticated

        # Check if get_queryset is implemented but returns None or raises error
        try:
            if hasattr(view, "get_queryset"):
                queryset = view.get_queryset()
                if queryset is None:
                    return request.user and request.user.is_authenticated
            elif getattr(view, "queryset", None) is None:
                return request.user and request.user.is_authenticated
        except Exception:
            return request.user and request.user.is_authenticated

        return super().has_permission(request, view)


def require_perms(*perms: str) -> type[permissions.BasePermission]:
    """Build a permission class requiring every given "app_label.codename".

    For views without a model (function views, ViewSets without queryset), where
    DjangoModelPermissions cannot derive the permission.
    Usage: permission_classes = [require_perms("core.view_actionlog")]
    """

    class RequirePerms(permissions.BasePermission):
        required_perms = perms

        def has_permission(self, request, view):
            user = request.user
            return bool(user and user.is_authenticated and user.has_perms(perms))

    return RequirePerms
