# docker compose exec backend python manage.py run_beat_tasks --local
import importlib
from django.core.management.base import BaseCommand
from django.conf import settings
from django.utils import timezone

class Command(BaseCommand):
    help = 'Executes all tasks defined in CELERY_BEAT_SCHEDULE immediately.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--task',
            type=str,
            help='Name of a specific task to run (key in CELERY_BEAT_SCHEDULE)',
        )
        parser.add_argument(
            '--local',
            action='store_true',
            help='Run tasks locally (synchronously) instead of sending to Celery worker',
        )

    def handle(self, *args, **options):
        beat_schedule = getattr(settings, 'CELERY_BEAT_SCHEDULE', {})
        
        if not beat_schedule:
            self.stdout.write(self.style.WARNING("No tasks found in CELERY_BEAT_SCHEDULE."))
            return

        specific_task = options.get('task')
        run_local = options.get('local')

        tasks_to_run = []
        if specific_task:
            if specific_task in beat_schedule:
                tasks_to_run = [(specific_task, beat_schedule[specific_task])]
            else:
                self.stdout.write(self.style.ERROR(f"Task '{specific_task}' not found in schedule."))
                return
        else:
            tasks_to_run = beat_schedule.items()

        self.stdout.write(self.style.SUCCESS(f"Starting execution of {len(tasks_to_run)} tasks..."))
        self.stdout.write(f"Current System Time: {timezone.now()}\n")

        for name, info in tasks_to_run:
            task_path = info.get('task')
            self.stdout.write(f"Executing: {name} ({task_path})...", ending="")
            
            try:
                # Import the task dynamically
                module_path, function_name = task_path.rsplit('.', 1)
                module = importlib.import_module(module_path)
                task_func = getattr(module, function_name)

                if run_local:
                    # Execute locally (synchronously)
                    task_func()
                    self.stdout.write(self.style.SUCCESS(" [OK - Local]"))
                else:
                    # Trigger via Celery (asynchronously)
                    task_func.delay()
                    self.stdout.write(self.style.SUCCESS(" [OK - Triggered]"))

            except Exception as e:
                self.stdout.write(self.style.ERROR(f" [FAILED]"))
                self.stdout.write(self.style.ERROR(f"Error: {str(e)}"))

        self.stdout.write(self.style.SUCCESS("\nDone."))
