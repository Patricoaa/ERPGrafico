from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0016_alter_groupprofile_bundles_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="actionlog",
            name="entity_type",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="actionlog",
            name="entity_id",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="actionlog",
            name="action_type",
            field=models.CharField(
                choices=[
                    ("BUSINESS", "Negocio"),
                    ("EXPORT", "Exportación de Datos"),
                    ("PRINT", "Impresión de Documento"),
                    ("LOGIN", "Inicio de Sesión"),
                    ("LOGOUT", "Cierre de Sesión"),
                    ("SECURITY", "Seguridad/Permisos"),
                    ("TECHNICAL", "Técnico/Sistema"),
                    ("SETTINGS_CHANGE", "Cambio de Configuración"),
                    ("OTHER", "Otro"),
                ],
                default="OTHER",
                max_length=30,
            ),
        ),
    ]
