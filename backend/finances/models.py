from django.db import models


class FinancesPermissions(models.Model):
    """Permission-holder model for the finances app.

    ``managed=False`` means Django will never create/alter a table for this
    model, but *will* create the ``auth_permission`` rows declared in
    ``Meta.permissions`` during ``migrate`` (and ``syncdb`` in tests).
    """

    class Meta:
        managed = False
        default_permissions = ()
        permissions = [
            ("view_dashboard_finances", "Can view finances dashboard"),
        ]
