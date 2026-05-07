import json
from channels.generic.websocket import AsyncWebsocketConsumer

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        
        if self.user.is_anonymous:
            await self.close()
            return

        self.group_name = f"notifications_user_{self.user.id}"
        
        # Join user group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        
        await self.accept()
        print(f"[Notifications] User {self.user.id} connected to WebSocket")

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            # Leave user group
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )
            print(f"[Notifications] User {self.user.id} disconnected from WebSocket")

    # Receive message from room group
    async def send_notification(self, event):
        notification = event["notification"]
        
        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            "type": "notification",
            "notification": notification
        }))
