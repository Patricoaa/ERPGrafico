from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
from typing import List, Optional, Dict, Any
from .models import DraftCart
from treasury.models import POSSession


class DraftCartService:
    """
    Servicio para gestionar borradores de carrito POS por sesión.
    Borradores compartidos entre todos los usuarios de una sesión.
    """
    
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
        draft_id: Optional[int] = None
    ) -> DraftCart:
        """
        Guarda o actualiza un borrador de carrito.
        La sesión debe estar OPEN.
        
        Args:
            pos_session_id: ID de la sesión POS (requerido)
            user: Usuario que está guardando
            items: Lista de items del carrito
            customer_id: ID del cliente (opcional)
            name: Nombre del borrador
            notes: Notas adicionales
            draft_id: ID del borrador a actualizar (si existe)
        
        Returns:
            DraftCart: Borrador guardado
        
        Raises:
            ValueError: Si la sesión no existe o está cerrada
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
        total_net = sum(item.get('total_net', 0) for item in items)
        total_gross = sum(item.get('total_gross', 0) for item in items)
        
        if draft_id:
            # Actualizar borrador existente
            draft = DraftCart.objects.get(
                id=draft_id,
                pos_session_id=pos_session_id
            )
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
                total_gross=total_gross
            )
        
        draft.save()
        return draft
    
    @staticmethod
    def load_draft(draft_id: int, pos_session_id: int) -> Optional[DraftCart]:
        """
        Carga un borrador de la sesión actual.
        
        Args:
            draft_id: ID del borrador
            pos_session_id: ID de la sesión actual
        
        Returns:
            DraftCart o None si no existe
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
        
        Args:
            pos_session_id: ID de la sesión
        
        Returns:
            Lista de borradores de la sesión
        """
        return list(
            DraftCart.objects.filter(pos_session_id=pos_session_id)
            .select_related('customer', 'created_by', 'last_modified_by', 'pos_session')
            .order_by('-updated_at')
        )
    
    @staticmethod
    def delete_draft(draft_id: int, pos_session_id: int) -> bool:
        """
        Elimina un borrador de la sesión.
        
        Args:
            draft_id: ID del borrador
            pos_session_id: ID de la sesión
        
        Returns:
            True si se eliminó correctamente
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
        Este método debe llamarse desde el servicio de cierre de sesión.
        
        Args:
            session_id: ID de la sesión que se está cerrando
        
        Returns:
            Número de borradores eliminados
        """
        deleted_count, _ = DraftCart.objects.filter(
            pos_session_id=session_id
        ).delete()
        return deleted_count
    
    @staticmethod
    def cleanup_old_drafts(days: int = 1) -> int:
        """
        Elimina borradores más antiguos que X días.
        Por defecto: 1 día.
        
        Args:
            days: Días de antigüedad para eliminar
        
        Returns:
            Número de borradores eliminados
        """
        cutoff_date = timezone.now() - timedelta(days=days)
        deleted_count, _ = DraftCart.objects.filter(
            updated_at__lt=cutoff_date
        ).delete()
        return deleted_count
