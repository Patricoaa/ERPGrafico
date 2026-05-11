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

    async def receive(self, text_data):
        """
        Recibe mensajes del cliente.
        Usado para heartbeats eficientes vía WebSocket.
        """
        from .draft_cart_service import DraftCartService
        from asgiref.sync import sync_to_async
        
        try:
            data = json.loads(text_data)
            event = data.get('event')
            
            if event == 'HEARTBEAT':
                draft_id = data.get('draft_id')
                session_key = data.get('session_key')
                user = self.scope.get('user')
                
                if draft_id and session_key and user and user.is_authenticated:
                    # Renovar el lock en la base de datos
                    success = await sync_to_async(DraftCartService.refresh_lock)(
                        draft_id=int(draft_id),
                        pos_session_id=int(self.session_id),
                        user=user,
                        session_key=session_key
                    )
                    
                    if not success:
                        # Informar al cliente que perdió el lock
                        await self.send(text_data=json.dumps({
                            'event': 'LOCK_LOST',
                            'draft_id': draft_id,
                            'error': 'El bloqueo ha expirado o fue tomado por otro terminal.'
                        }))
        except Exception as e:
            print(f"Error en WebSocket receive: {e}")

    # Recibir mensaje del grupo (broadcast)
    async def pos_draft_update(self, event):
        # Enviar mensaje al WebSocket
        await self.send(text_data=json.dumps(event['data']))
