from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0030_missing_created_by"),
    ]

    operations = [
        migrations.AddField(
            model_name="uom",
            name="name_singular",
            field=models.CharField(
                blank=True,
                default="",
                max_length=20,
                verbose_name="Nombre singular",
            ),
        ),
        migrations.AddField(
            model_name="uom",
            name="name_plural",
            field=models.CharField(
                blank=True,
                default="",
                max_length=20,
                verbose_name="Nombre plural",
            ),
        ),
        migrations.AddField(
            model_name="uom",
            name="abbreviation",
            field=models.CharField(
                blank=True,
                default="",
                max_length=10,
                verbose_name="Abreviación",
            ),
        ),
        migrations.AddField(
            model_name="historicaluom",
            name="name_singular",
            field=models.CharField(
                blank=True,
                default="",
                max_length=20,
                verbose_name="Nombre singular",
            ),
        ),
        migrations.AddField(
            model_name="historicaluom",
            name="name_plural",
            field=models.CharField(
                blank=True,
                default="",
                max_length=20,
                verbose_name="Nombre plural",
            ),
        ),
        migrations.AddField(
            model_name="historicaluom",
            name="abbreviation",
            field=models.CharField(
                blank=True,
                default="",
                max_length=10,
                verbose_name="Abreviación",
            ),
        ),
    ]
