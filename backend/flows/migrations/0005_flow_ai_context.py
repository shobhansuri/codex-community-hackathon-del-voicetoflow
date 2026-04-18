from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('flows', '0004_flow_settings'),
    ]

    operations = [
        migrations.AddField(
            model_name='flow',
            name='ai_context',
            field=models.TextField(blank=True),
        ),
    ]
