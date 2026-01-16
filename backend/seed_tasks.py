import os
import django
from django.conf import settings

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django_celery_beat.models import PeriodicTask, CrontabSchedule

def setup_periodic_tasks():
    # 1. Create Crontab Schedule (Daily at 7:00 AM)
    schedule, created = CrontabSchedule.objects.get_or_create(
        hour=7,
        minute=0,
        day_of_week='*',
        month_of_year='*',
        timezone=settings.TIME_ZONE
    )
    
    # 2. Create Periodic Task
    task_name = 'Generate Subscription Orders'
    task_path = 'purchasing.tasks.generate_subscription_orders'
    
    task, created = PeriodicTask.objects.get_or_create(
        name=task_name,
        defaults={
            'crontab': schedule,
            'task': task_path,
            'enabled': True,
        }
    )
    
    if created:
        print(f"Created periodic task: {task.name}")
    else:
        print(f"Periodic task already exists: {task.name}")
        # Update just in case
        task.task = task_path
        task.crontab = schedule
        task.enabled = True
        task.save()
        print(f"Updated periodic task: {task.name}")

if __name__ == '__main__':
    setup_periodic_tasks()
