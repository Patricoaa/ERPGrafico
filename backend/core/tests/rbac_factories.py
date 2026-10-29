from django.contrib.auth.models import Group, Permission

from core.models import User


def make_user(username: str, *perms: str, groups: tuple[str, ...] = ()) -> User:
    """Create a user with direct permissions ("app_label.codename") and groups.

    Missing groups are created. If a codename maps to several Permission rows
    (duplicates across content types), all of them are assigned.
    """
    user = User.objects.create_user(username=username, password="x")
    for name in groups:
        group, _ = Group.objects.get_or_create(name=name)
        user.groups.add(group)
    for perm in perms:
        app_label, codename = perm.split(".", 1)
        found = Permission.objects.filter(
            content_type__app_label=app_label, codename=codename
        )
        if not found.exists():
            raise ValueError(f"Permission not found: {perm}")
        user.user_permissions.add(*found)
    return user
