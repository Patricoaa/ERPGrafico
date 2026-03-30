from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
from typing import List, Optional, Dict, Any
from .models import DraftCart
from treasury.models import POSSession

# Lock expires after this many seconds without heartbeat
LOCK_TIMEOUT_SECONDS = 15


class DraftCartService:
    """
    Servicio para gestionar borradores de carrito POS por sesión.
    Borradores compartidos entre todos los usuarios de una sesión.
    Incluye bloqueo optimista con heartbeat para evitar edición concurrente.
    """
    
    # ── Lock Management ──────────────────────────────────────────────

    @staticmethod
    def acquire_lock(draft_id: int, pos_session_id: int, user, session_key: str) -> Dict[str, Any]:
        """
        Intenta adquirir el lock de un borrador.
        Si el lock existe pero ha expirado (sin heartbeat), lo toma.
        
        Returns:
            dict: {acquired: bool, locked_by_name: str|None, locked_at: datetime|None}
        """
        try:
            draft = DraftCart.objects.get(id=draft_id, pos_session_id=pos_session_id)
        except DraftCart.DoesNotExist:
            return {'acquired': False, 'error': 'Borrador no encontrado'}
        
        now = timezone.now()
        lock_expired = (
            draft.locked_at is None or
            (now - draft.locked_at).total_seconds() > LOCK_TIMEOUT_SECONDS
        )
        
        # Lock is free or expired
        if not draft.locked_by or lock_expired:
            draft.locked_by = user
            draft.locked_at = now
            draft.lock_session_key = session_key
            draft.save(update_fields=['locked_by', 'locked_at', 'lock_session_key'])
            return {'acquired': True}
        
        # Already locked by same user+session
        if draft.locked_by == user and draft.lock_session_key == session_key:
            draft.locked_at = now  # Refresh heartbeat
            draft.save(update_fields=['locked_at'])
            return {'acquired': True}
        
        # Locked by someone else
        locked_name = draft.locked_by.get_full_name() or draft.locked_by.username
        return {
            'acquired': False,
            'locked_by_name': locked_name,
            'locked_at': draft.locked_at.isoformat() if draft.locked_at else None,
        }

    @staticmethod
    def release_lock(draft_id: int, pos_session_id: int, user, session_key: str = '') -> bool:
        """
        Libera el lock de un borrador.
        Solo el usuario+sesión que tiene el lock puede liberarlo.
        Si session_key es vacío, libera cualquier lock del usuario.
        
        Returns:
            True si se liberó correctamente
        """
        try:
            draft = DraftCart.objects.get(id=draft_id, pos_session_id=pos_session_id)
        except DraftCart.DoesNotExist:
            return False
        
        if not draft.locked_by:
            return True  # Already unlocked
        
        can_unlock = (
            draft.locked_by == user and
            (not session_key or draft.lock_session_key == session_key)
        )
        
        if can_unlock:
            draft.locked_by = None
            draft.locked_at = None
            draft.lock_session_key = ''
            draft.save(update_fields=['locked_by', 'locked_at', 'lock_session_key'])
            return True
        
        return False

    @staticmethod
    def refresh_lock(draft_id: int, pos_session_id: int, user, session_key: str) -> bool:
        """
        Renueva el heartbeat del lock.
        Solo el owner del lock puede renovarlo.
        
        Returns:
            True si se renovó correctamente
        """
        try:
            draft = DraftCart.objects.get(
                id=draft_id,
                pos_session_id=pos_session_id,
                locked_by=user,
                lock_session_key=session_key,
            )
            draft.locked_at = timezone.now()
            draft.save(update_fields=['locked_at'])
            return True
        except DraftCart.DoesNotExist:
            return False

    @staticmethod
    def cleanup_stale_locks():
        """
        Libera locks que no han tenido heartbeat en LOCK_TIMEOUT_SECONDS.
        Llamado desde el endpoint de sync para mantener locks limpios.
        """
        cutoff = timezone.now() - timedelta(seconds=LOCK_TIMEOUT_SECONDS)
        stale = DraftCart.objects.filter(
            locked_by__isnull=False,
            locked_at__lt=cutoff,
        )
        count = stale.update(locked_by=None, locked_at=None, lock_session_key='')
        return count
    
    # ── Sync ─────────────────────────────────────────────────────────

    @staticmethod
    def get_sync_data(pos_session_id: int, since: Optional[str] = None) -> Dict[str, Any]:
        """
        Retorna estado ligero de todos los borradores de la sesión.
        Si se proporciona `since`, solo los modificados después de esa fecha.
        
        Respuesta diseñada para ser lo más liviana posible (sin items del carrito).
        """
        # Limpiar locks expirados antes de responder
        DraftCartService.cleanup_stale_locks()
        
        qs = DraftCart.objects.filter(
            pos_session_id=pos_session_id,
        ).select_related('customer', 'locked_by', 'created_by', 'last_modified_by')
        
        drafts = []
        for d in qs.order_by('-updated_at'):
            locked_name = None
            if d.locked_by:
                locked_name = d.locked_by.get_full_name() or d.locked_by.username
            
            created_name = None
            if d.created_by:
                created_name = d.created_by.get_full_name() or d.created_by.username
            
            modified_name = None
            if d.last_modified_by:
                modified_name = d.last_modified_by.get_full_name() or d.last_modified_by.username

            drafts.append({
                'id': d.id,
                'name': d.name,
                'customer_name': d.customer.name if d.customer else None,
                'item_count': len(d.items) if d.items else 0,
                'total_gross': float(d.total_gross),
                'is_locked': d.locked_by is not None,
                'locked_by_name': locked_name,
                'locked_by_id': d.locked_by_id,
                'lock_session_key': d.lock_session_key,
                'locked_at': d.locked_at.isoformat() if d.locked_at else None,
                'created_by_full_name': created_name,
                'last_modified_by_full_name': modified_name,
                'wizard_state': d.wizard_state,
                'updated_at': d.updated_at.isoformat(),
                'created_at': d.created_at.isoformat(),
            })
        
        # Include Session Status for real-time synchronization
        session_status = 'OPEN'
        closed_by_name = None
        try:
            session = POSSession.objects.select_related('closed_by').get(id=pos_session_id)
            session_status = session.status
            if session_status == 'CLOSED' and session.closed_by:
                closed_by_name = session.closed_by.get_full_name() or session.closed_by.username
        except POSSession.DoesNotExist:
            session_status = 'CLOSED'
        
        return {
            'drafts': drafts,
            'session_status': session_status,
            'closed_by_name': closed_by_name,
            'server_time': timezone.now().isoformat(),
        }
    
    # ── CRUD Original ────────────────────────────────────────────────

    @staticmethod
    def save_draft(
        pos_session_id: int,
        user,
        items: List[Dict[str, Any]],
        customer_id: Optional[int] = None,
        name: str = "",
        notes: str = "",
        wizard_state: Optional[Dict[str, Any]] = None,
        total_discount_amount: Decimal = Decimal('0.00'),
        draft_id: Optional[int] = None,
        session_key: str = "",
    ) -> DraftCart:
        """
        Guarda o actualiza un borrador de carrito.
        La sesión debe estar OPEN.
        Valida ownership del lock si el borrador está bloqueado.
        """
        # Validar que la sesión existe y está abierta
        try:
            session = POSSession.objects.get(
                id=pos_session_id,
                status=POSSession.Status.OPEN
            )
        except POSSession.DoesNotExist:
            raise ValueError("La sesión POS no existe o está cerrada")
        
        # Calcular totales
        total_net = Decimal('0.00')
        total_gross = Decimal('0.00')
        
        for item in items:
            qty = Decimal(str(item.get('quantity', 0)))
            
            item_total_net = item.get('total_net')
            if item_total_net is None:
                item_total_net = Decimal(str(item.get('unit_price_net', 0))) * qty
            total_net += Decimal(str(item_total_net))
            
            item_total_gross = item.get('total_gross')
            if item_total_gross is None:
                item_total_gross = Decimal(str(item.get('unit_price_gross', 0))) * qty
            total_gross += Decimal(str(item_total_gross))
        
        if draft_id:
            # Actualizar borrador existente
            draft = DraftCart.objects.get(
                id=draft_id,
                pos_session_id=pos_session_id
            )
            
            # Validar lock ownership si está bloqueado por otro
            if draft.locked_by and draft.locked_by != user:
                now = timezone.now()
                lock_expired = (
                    draft.locked_at and 
                    (now - draft.locked_at).total_seconds() > LOCK_TIMEOUT_SECONDS
                )
                if not lock_expired:
                    locked_name = draft.locked_by.get_full_name() or draft.locked_by.username
                    raise ValueError(f"Este borrador está siendo editado por {locked_name}")
            
            # Refrescar heartbeat al guardar si tiene el lock
            if session_key and draft.locked_by == user and draft.lock_session_key == session_key:
                draft.locked_at = timezone.now()
            
            draft.items = items
            draft.total_net = total_net
            draft.total_gross = total_gross
            draft.customer_id = customer_id
            draft.name = name or draft.name
            draft.notes = notes
            draft.wizard_state = wizard_state
            draft.total_discount_amount = total_discount_amount
            draft.last_modified_by = user
        else:
            # Crear nuevo borrador
            if not name:
                name = f"Borrador {timezone.now().strftime('%d/%m/%Y %H:%M')}"
            
            draft = DraftCart(
                pos_session=session,
                created_by=user,
                last_modified_by=user,
                customer_id=customer_id,
                name=name,
                notes=notes,
                items=items,
                wizard_state=wizard_state,
                total_net=total_net,
                total_discount_amount=total_discount_amount,
                total_gross=total_gross,
                locked_by=user if session_key else None,
                locked_at=timezone.now() if session_key else None,
                lock_session_key=session_key,
            )
        
        draft.save()
        return draft
    
    @staticmethod
    def load_draft(draft_id: int, pos_session_id: int) -> Optional[DraftCart]:
        """
        Carga un borrador de la sesión actual.
        """
        try:
            return DraftCart.objects.get(
                id=draft_id,
                pos_session_id=pos_session_id
            )
        except DraftCart.DoesNotExist:
            return None
    
    @staticmethod
    def list_drafts(pos_session_id: int) -> List[DraftCart]:
        """
        Lista TODOS los borradores de una sesión (multi-usuario).
        """
        return list(
            DraftCart.objects.filter(pos_session_id=pos_session_id)
            .select_related('customer', 'created_by', 'last_modified_by', 'locked_by')
            .order_by('-updated_at')
        )
    
    @staticmethod
    def delete_draft(draft_id: int, pos_session_id: int) -> bool:
        """
        Elimina un borrador de la sesión.
        """
        try:
            draft = DraftCart.objects.get(
                id=draft_id,
                pos_session_id=pos_session_id
            )
            draft.delete()
            return True
        except DraftCart.DoesNotExist:
            return False
    
    @staticmethod
    def cleanup_on_session_close(session_id: int) -> int:
        """
        Elimina TODOS los borradores al cerrar la sesión.
        """
        deleted_count, _ = DraftCart.objects.filter(
            pos_session_id=session_id
        ).delete()
        return deleted_count
    
    @staticmethod
    def cleanup_old_drafts(days: int = 1) -> int:
        """
        Elimina borradores más antiguos que X días.
        """
        cutoff_date = timezone.now() - timedelta(days=days)
        deleted_count, _ = DraftCart.objects.filter(
            updated_at__lt=cutoff_date
        ).delete()
        return deleted_count
