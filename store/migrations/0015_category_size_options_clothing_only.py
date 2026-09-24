from django.db import migrations


def set_has_size_options(apps, schema_editor):
    """Lock size options to Clothing only (overrides any earlier flag drift)."""
    Category = apps.get_model("store", "Category")
    Category.objects.filter(slug="clothing").update(has_size_options=True)
    Category.objects.exclude(slug="clothing").update(has_size_options=False)


def unset_has_size_options(apps, schema_editor):
    Category = apps.get_model("store", "Category")
    Category.objects.all().update(has_size_options=False)


class Migration(migrations.Migration):
    dependencies = [
        ("store", "0014_category_has_size_options"),
    ]

    operations = [
        migrations.RunPython(set_has_size_options, unset_has_size_options),
    ]
