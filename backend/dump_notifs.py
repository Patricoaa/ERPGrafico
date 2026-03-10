from workflow.models import Notification
notifs = Notification.objects.all().order_by('-id')[:10]
for n in notifs:
    print(f"ID: {n.id} | Link: {n.link}")
