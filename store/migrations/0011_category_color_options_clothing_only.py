from django.db import migrations


def set_has_color_options(apps, schema_editor):
    """Lock color options to Clothing only (overrides any earlier flag drift)."""
    Category = apps.get_model("store", "Category")
    Category.objects.filter(slug="clothing").update(has_color_options=True)
    Category.objects.exclude(slug="clothing").update(has_color_options=False)


def unset_has_color_options(apps, schema_editor):
    Category = apps.get_model("store", "Category")
    Category.objects.all().update(has_color_options=False)


class Migration(migrations.Migration):
    dependencies = [
        ("store", "0010_category_has_color_options"),
    ]

    operations = [
        migrations.RunPython(set_has_color_options, unset_has_color_options),
    ]
