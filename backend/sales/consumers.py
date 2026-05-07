import json
from channels.generic.websocket import AsyncWebsocketConsumer

class POSDraftConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.session_id = self.scope['url_route']['kwargs']['session_id']
        self.group_name = f'pos_session_{self.session_id}'

        # Unirse al grupo de la sesión de POS
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Salir del grupo
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    # Recibir mensaje del grupo
    async def pos_draft_update(self, event):
        # Enviar mensaje al WebSocket
        await self.send(text_data=json.dumps(event['data']))
