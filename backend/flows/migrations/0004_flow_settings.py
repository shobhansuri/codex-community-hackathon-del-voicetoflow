from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('flows', '0003_flowdoc'),
    ]

    operations = [
        migrations.AddField(
            model_name='flow',
            name='settings',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
