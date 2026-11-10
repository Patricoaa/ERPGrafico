from datetime import timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional

from django.db import models, transaction
from django.utils import timezone

from inventory.models import Product
from inventory.services import StockService
from treasury.models import POSOperatorPass, POSSession
from treasury.pos_operator_service import Actor, POSOperatorRequired, POSOperatorService

from .models import DraftCart
from .tracking_service import SaleTrackingService

# Lock expires after this many seconds without heartbeat
LOCK_TIMEOUT_SECONDS = 15


class DraftCartService:
    """
    Servicio para gestionar borradores de carrito POS por sesión.
    Borradores compartidos entre todos los usuarios de una sesión.
    Incluye bloqueo optimista con heartbeat para evitar edición concurrente.
    """

    @staticmethod
    def validate_pos_session_id(pos_session_id):
        if not pos_session_id:
            raise ValueError("Se requiere una sesión POS activa (pos_session_id)")

    # ── Actor (operador en cajas MULTI) ──────────────────────────────

    @staticmethod
    def _actor_for(request, pos_session_id, *, target_id: Optional[int] = None, purpose: str = "DRAFT") -> Actor:
        """Actor de la acción: el operador del pase en cajas MULTI, la cuenta logueada si no."""
        session = POSSession.objects.filter(id=pos_session_id).first()
        if session is None or not session.is_multi_user_for(request.user):
            return Actor(request.user, request.user, None)
        return POSOperatorService.actor_from_request(request, session, purpose, target_id=target_id)

    @staticmethod
    def _holds_live_lock(draft: DraftCart, operator, session_key: str) -> bool:
        return bool(
            draft.locked_by_id == operator.pk
            and draft.lock_session_key == session_key
            and draft.locked_at
            and (timezone.now() - draft.locked_at).total_seconds() <= LOCK_TIMEOUT_SECONDS
        )

    @staticmethod
    def ensure_operator_holds_lock(draft: DraftCart, actor: Actor, session_key: str) -> None:
        """MULTI: el pase solo vale mientras su pestaña conserva el bloqueo del borrador.

        Si el bloqueo venció, el pase muere con él y se pide identificar de nuevo:
        nunca se atribuye en silencio a quien dejó la pestaña abierta.
        """
        if DraftCartService._holds_live_lock(draft, actor.operator, session_key):
            return
        POSOperatorService.end(actor.operator_pass, POSOperatorPass.EndReason.EXPIRED)
        raise POSOperatorRequired("DRAFT")

    @staticmethod
    def _tab_operator(request, pos_session_id, draft_id: int, session_key: str):
        """(operador, pase) de la pestaña en cajas MULTI; (request.user, None) si no aplica."""
        return DraftCartService._tab_operator_for(request.user, pos_session_id, draft_id, session_key)

    @staticmethod
    def _tab_operator_for(user, pos_session_id, draft_id: int, session_key: str):
        session = POSSession.objects.filter(id=pos_session_id).first()
        if session is None or not session.is_multi_user_for(user):
            return user, None
        op_pass = POSOperatorService.live_pass_for_tab(
            session=session, device_user=user, tab_key=session_key,
            purpose="DRAFT", target_id=draft_id,
        )
        return (op_pass.operator, op_pass) if op_pass else (user, None)

    @staticmethod
    def save_draft_from_request(request, draft_id: Optional[int] = None) -> DraftCart:
        data = request.data
        pos_session_id = data.get("pos_session_id")
        items = data.get("items", [])
        draft_id = draft_id or data.get("draft_id")
        session_key = data.get("session_key", "")
        DraftCartService.validate_pos_session_id(pos_session_id)
        if not items and not draft_id:
            raise ValueError("El carrito está vacío")

        session = POSSession.objects.filter(id=int(pos_session_id)).first()
        actor = DraftCartService._actor_for(request, int(pos_session_id), target_id=draft_id)
        op_pass = actor.operator_pass
        if op_pass is not None:
            if not session_key:
                raise ValueError("Se requiere session_key")
            if draft_id is None and op_pass.target_id is not None:
                raise POSOperatorRequired("DRAFT")  # un pase ligado no crea otro borrador
            if draft_id is not None:
                current = DraftCart.objects.filter(id=draft_id, pos_session_id=session.id).first()
                if current:
                    DraftCartService.ensure_operator_holds_lock(current, actor, session_key)

        with transaction.atomic():
            draft = DraftCartService.save_draft(
                pos_session_id=int(pos_session_id),
                user=actor.operator,
                actor=actor,
                items=items,
                customer_id=data.get("customer_id"),
                name=data.get("name", ""),
                notes=data.get("notes", ""),
                wizard_state=data.get("wizard_state"),
                session_key=session_key,
                draft_id=draft_id,
            )
            if op_pass is not None and draft_id is None:
                POSOperatorService.bind_target(op_pass, "sales.draftcart", draft.id)
        return draft

    @staticmethod
    def acquire_lock_from_request(request, draft_id: int) -> Dict[str, Any]:
        data = request.data
        pos_session_id = data.get("pos_session_id")
        session_key = data.get("session_key", "")
        DraftCartService.validate_pos_session_id(pos_session_id)
        if not session_key:
            raise ValueError("Se requiere session_key")
        actor = DraftCartService._actor_for(request, int(pos_session_id), target_id=draft_id)
        return DraftCartService.acquire_lock(
            draft_id=draft_id,
            pos_session_id=int(pos_session_id),
            user=actor.operator,
            session_key=session_key,
        )

    @staticmethod
    def refresh_lock_from_request(request, draft_id: int) -> bool:
        data = request.data
        pos_session_id = data.get("pos_session_id")
        session_key = data.get("session_key", "")
        DraftCartService.validate_pos_session_id(pos_session_id)
        if not session_key:
            raise ValueError("Se requiere session_key")
        return DraftCartService.heartbeat(
            draft_id=draft_id, pos_session_id=int(pos_session_id), user=request.user, session_key=session_key
        )

    @staticmethod
    def heartbeat(draft_id: int, pos_session_id: int, user, session_key: str) -> bool:
        """Heartbeat de la pestaña (HTTP y WebSocket); ``user`` es la cuenta del dispositivo.

        En cajas MULTI renueva el bloqueo del operador del pase. Un bloqueo ya vencido no se
        revive: el pase termina y la siguiente operación pide identificar de nuevo.
        """
        operator, op_pass = DraftCartService._tab_operator_for(user, pos_session_id, draft_id, session_key)
        if op_pass is not None:
            draft = DraftCart.objects.filter(id=draft_id, pos_session_id=pos_session_id).first()
            if draft is None or not DraftCartService._holds_live_lock(draft, operator, session_key):
                POSOperatorService.end(op_pass, POSOperatorPass.EndReason.EXPIRED)
                return False
        refreshed = DraftCartService.refresh_lock(
            draft_id=draft_id, pos_session_id=pos_session_id, user=operator, session_key=session_key
        )
        if op_pass is not None and not refreshed:  # bloqueo perdido: el pase no sobrevive
            POSOperatorService.end(op_pass, POSOperatorPass.EndReason.EXPIRED)
        return refreshed

    @staticmethod
    def release_lock_from_request(request, draft_id: int) -> bool:
        data = request.data
        pos_session_id = data.get("pos_session_id")
        session_key = data.get("session_key", "")
        DraftCartService.validate_pos_session_id(pos_session_id)
        operator, op_pass = DraftCartService._tab_operator(request, int(pos_session_id), draft_id, session_key)
        released = DraftCartService.release_lock(
            draft_id=draft_id, pos_session_id=int(pos_session_id), user=operator, session_key=session_key
        )
        if op_pass is not None and released:
            POSOperatorService.end(op_pass, POSOperatorPass.EndReason.RELEASED)
        return released

    @staticmethod
    def process_withdrawal_from_request(request, draft_id: int) -> Dict[str, Any]:
        data = request.data
        pos_session_id = data.get("pos_session_id")
        DraftCartService.validate_pos_session_id(pos_session_id)
        # El retiro de socio es una transacción propia: pide su operador (no basta el pase del carrito).
        actor = DraftCartService._actor_for(
            request, int(pos_session_id), target_id=draft_id, purpose="PARTNER_WITHDRAWAL"
        )
        result = DraftCartService.process_withdrawal(
            draft_id=draft_id,
            pos_session_id=int(pos_session_id),
            user=actor.operator,
            partner_id=data.get("partner_id"),
        )
        if actor.operator_pass is not None:  # el retiro cierra el borrador: el pase termina con él
            POSOperatorService.end(actor.operator_pass, POSOperatorPass.EndReason.CONSUMED)
        return result

    # ── Lock Management ──────────────────────────────────────────────

    @staticmethod
    def acquire_lock(draft_id: int, pos_session_id: int, user, session_key: str) -> Dict[str, Any]:
        """
        Intenta adquirir el lock de un borrador.
        Si el lock existe pero ha expirado (sin heartbeat), lo toma.
        Si el borrador tiene aprobación pendiente, permite acceso cross-session.

        Returns:
            dict: {acquired: bool, locked_by_name: str|None, locked_at: datetime|None}
        """
        try:
            draft = DraftCart.objects.get(id=draft_id, pos_session_id=pos_session_id)
        except DraftCart.DoesNotExist:
            # Borrador de otra sesión — permitir si tiene aprobación pendiente
            try:
                draft = DraftCart.objects.get(id=draft_id, has_pending_approval=True)
            except DraftCart.DoesNotExist:
                return {"acquired": False, "error": "Borrador no encontrado"}

        now = timezone.now()
        lock_expired = (
            draft.locked_at is None
            or (now - draft.locked_at).total_seconds() > LOCK_TIMEOUT_SECONDS
        )

        # Lock is free or expired
        if not draft.locked_by or lock_expired:
            draft.locked_by = user
            draft.locked_at = now
            draft.lock_session_key = session_key
            draft.save(update_fields=["locked_by", "locked_at", "lock_session_key"])
            return {"acquired": True}

        # Already locked by same user+session
        if draft.locked_by == user and draft.lock_session_key == session_key:
            draft.locked_at = now  # Refresh heartbeat
            draft.save(update_fields=["locked_at"])
            return {"acquired": True}

        # Locked by someone else
        locked_name = draft.locked_by.get_full_name() or draft.locked_by.username
        return {
            "acquired": False,
            "locked_by_name": locked_name,
            "locked_at": draft.locked_at.isoformat() if draft.locked_at else None,
        }

    @staticmethod
    def release_lock(draft_id: int, pos_session_id: int, user, session_key: str = "") -> bool:
        """
        Libera el lock de un borrador.
        Solo el usuario+sesión que tiene el lock puede liberarlo.
        Si session_key es vacío, libera cualquier lock del usuario.
        Permite acceso cross-session para borradores con aprobación pendiente.

        Returns:
            True si se liberó correctamente
        """
        try:
            draft = DraftCart.objects.get(id=draft_id, pos_session_id=pos_session_id)
        except DraftCart.DoesNotExist:
            try:
                draft = DraftCart.objects.get(id=draft_id, has_pending_approval=True)
            except DraftCart.DoesNotExist:
                return False

        if not draft.locked_by:
            return True  # Already unlocked

        can_unlock = draft.locked_by == user and (
            not session_key or draft.lock_session_key == session_key
        )

        if can_unlock:
            draft.locked_by = None
            draft.locked_at = None
            draft.lock_session_key = ""
            draft.save(update_fields=["locked_by", "locked_at", "lock_session_key"])
            return True

        return False

    @staticmethod
    def refresh_lock(draft_id: int, pos_session_id: int, user, session_key: str) -> bool:
        """
        Renueva el heartbeat del lock.
        Solo el owner del lock puede renovarlo.
        Permite acceso cross-session para borradores con aprobación pendiente.

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
            draft.save(update_fields=["locked_at"])
            return True
        except DraftCart.DoesNotExist:
            # Borrador de otra sesión — permitir si tiene aprobación pendiente
            try:
                draft = DraftCart.objects.get(
                    id=draft_id,
                    has_pending_approval=True,
                    locked_by=user,
                    lock_session_key=session_key,
                )
                draft.locked_at = timezone.now()
                draft.save(update_fields=["locked_at"])
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
        # save() por fila (no QuerySet.update): update() no dispara post_save y los
        # demás terminales no verían el borrador desbloqueado en vivo.
        count = 0
        for draft in DraftCart.objects.select_related("created_by", "last_modified_by").filter(
            locked_by__isnull=False,
            locked_at__lt=cutoff,
        ):
            draft.locked_by = None
            draft.locked_at = None
            draft.lock_session_key = ""
            draft.save(update_fields=["locked_by", "locked_at", "lock_session_key"])
            count += 1
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
        ).select_related("customer", "locked_by", "created_by", "last_modified_by")

        drafts = []
        for d in qs.order_by("-updated_at"):
            locked_name = None
            if d.locked_by:
                locked_name = d.locked_by.get_full_name() or d.locked_by.username

            created_name = None
            if d.created_by:
                created_name = d.created_by.get_full_name() or d.created_by.username

            modified_name = None
            if d.last_modified_by:
                modified_name = d.last_modified_by.get_full_name() or d.last_modified_by.username

            drafts.append(
                {
                    "id": d.id,
                    "session_local_id": d.session_local_id,
                    "name": d.name,
                    "customer_name": d.customer.name if d.customer else None,
                    "item_count": len(d.items) if d.items else 0,
                    "total_gross": float(d.total_gross),
                    "is_locked": d.locked_by is not None,
                    "locked_by_name": locked_name,
                    "locked_by_id": d.locked_by_id,
                    "lock_session_key": d.lock_session_key,
                    "locked_at": d.locked_at.isoformat() if d.locked_at else None,
                    "created_by_full_name": created_name,
                    "last_modified_by_full_name": modified_name,
                    "wizard_state": d.wizard_state,
                    "updated_at": d.updated_at.isoformat(),
                    "created_at": d.created_at.isoformat(),
                }
            )

        # Include Session Status for real-time synchronization
        session_status = "OPEN"
        closed_by_name = None
        try:
            session = POSSession.objects.select_related("closed_by").get(id=pos_session_id)
            session_status = session.status
            if session_status == "CLOSED" and session.closed_by:
                closed_by_name = session.closed_by.get_full_name() or session.closed_by.username
        except POSSession.DoesNotExist:
            session_status = "CLOSED"

        return {
            "drafts": drafts,
            "session_status": session_status,
            "closed_by_name": closed_by_name,
            "server_time": timezone.now().isoformat(),
        }

    # ── CRUD Original ────────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def save_draft(
        pos_session_id: int,
        user,
        items: List[Dict[str, Any]],
        customer_id: Optional[int] = None,
        name: str = "",
        notes: str = "",
        wizard_state: Optional[Dict[str, Any]] = None,
        total_discount_amount: Decimal = Decimal("0.00"),
        draft_id: Optional[int] = None,
        session_key: str = "",
        actor: Optional[Actor] = None,
    ) -> DraftCart:
        """
        Guarda o actualiza un borrador de carrito.
        La sesión debe estar OPEN.
        Valida ownership del lock si el borrador está bloqueado.
        `actor` (operador + cuenta del dispositivo) alimenta el seguimiento por paso;
        sin él, la cuenta `user` actúa como ambos.
        """
        actor = actor or Actor(user, user, None)
        user = actor.operator
        # Validar que la sesión existe y está abierta
        # select_for_update serializa la creación para evitar duplicados en session_local_id
        try:
            session = POSSession.objects.select_for_update().get(
                id=pos_session_id, status=POSSession.Status.OPEN
            )
        except POSSession.DoesNotExist:
            raise ValueError("La sesión POS no existe o está cerrada")

        # Calcular totales
        total_net = Decimal("0.00")
        total_gross = Decimal("0.00")

        for item in items:
            qty = Decimal(str(item.get("quantity", 0)))

            item_total_net = item.get("total_net")
            if item_total_net is None:
                item_total_net = Decimal(str(item.get("unit_price_net", 0))) * qty
            total_net += Decimal(str(item_total_net))

            item_total_gross = item.get("total_gross")
            if item_total_gross is None:
                item_total_gross = Decimal(str(item.get("unit_price_gross", 0))) * qty
            total_gross += Decimal(str(item_total_gross))

        if draft_id:
            # Actualizar borrador existente
            draft = DraftCart.objects.get(id=draft_id, pos_session_id=pos_session_id)

            # Cuando hay aprobación pendiente, solo se permite actualizar wizard_state.
            # Cambiar ítems o cliente después de solicitar crédito requiere cancelar la aprobación.
            if draft.has_pending_approval:
                import json

                new_items_str = json.dumps(items or [], sort_keys=True, default=str)
                old_items_str = json.dumps(draft.items or [], sort_keys=True, default=str)
                items_changed = new_items_str != old_items_str
                customer_changed = customer_id != draft.customer_id
                if items_changed or customer_changed:
                    from django.core.exceptions import ValidationError

                    raise ValidationError(
                        "Este borrador tiene una aprobación de crédito en curso y no puede "
                        "ser modificado. Espere la resolución de la solicitud."
                    )
                # Solo wizard_state cambió — aplicar y retornar sin tocar items ni totales
                steps = SaleTrackingService.changed_steps(
                    draft, items=draft.items, customer_id=draft.customer_id, wizard_state=wizard_state
                )
                draft.wizard_state = wizard_state
                draft.save(update_fields=["wizard_state", "updated_at"])
                SaleTrackingService.record_draft_steps(draft=draft, steps=steps, actor=actor)
                return draft

            # Validar lock ownership si está bloqueado por otro
            if draft.locked_by and draft.locked_by != user:
                now = timezone.now()
                lock_expired = (
                    draft.locked_at
                    and (now - draft.locked_at).total_seconds() > LOCK_TIMEOUT_SECONDS
                )
                if not lock_expired:
                    locked_name = draft.locked_by.get_full_name() or draft.locked_by.username
                    raise ValueError(f"Este borrador está siendo editado por {locked_name}")

            # Refrescar heartbeat al guardar si tiene el lock
            if session_key and draft.locked_by == user and draft.lock_session_key == session_key:
                draft.locked_at = timezone.now()

            steps = SaleTrackingService.changed_steps(
                draft, items=items, customer_id=customer_id, wizard_state=wizard_state
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
            # Crear nuevo borrador con ID secuencial dentro de la sesión
            max_local_id = DraftCart.objects.filter(
                pos_session_id=pos_session_id,
            ).aggregate(m=models.Max("session_local_id"))["m"] or 0

            if not name:
                name = f"Borrador {timezone.now().strftime('%d/%m/%Y %H:%M')}"

            steps = SaleTrackingService.changed_steps(
                None, items=items, customer_id=customer_id, wizard_state=wizard_state
            )
            draft = DraftCart(
                pos_session=session,
                session_local_id=max_local_id + 1,
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
        SaleTrackingService.record_draft_steps(draft=draft, steps=steps, actor=actor)
        return draft

    @staticmethod
    def load_draft(draft_id: int, pos_session_id: int) -> Optional[DraftCart]:
        """
        Carga un borrador. Si tiene una aprobación pendiente, permite la carga
        desde cualquier sesión (el borrador sobrevive al cierre de su sesión original).
        """
        try:
            draft = DraftCart.objects.get(id=draft_id)
        except DraftCart.DoesNotExist:
            return None
        if draft.has_pending_approval or draft.pos_session_id == pos_session_id:
            return draft
        return None

    @staticmethod
    def list_drafts(pos_session_id: int) -> List[DraftCart]:
        """
        Lista TODOS los borradores de una sesión (multi-usuario).
        """
        return list(
            DraftCart.objects.filter(pos_session_id=pos_session_id)
            .select_related("customer", "created_by", "last_modified_by", "locked_by")
            .order_by("-updated_at")
        )

    @staticmethod
    def delete_draft(draft_id: int, pos_session_id: int) -> bool:
        """
        Elimina un borrador de la sesión. Si tiene una aprobación de crédito
        pendiente, rechaza la eliminación y retorna False.
        """
        try:
            draft = DraftCart.objects.get(id=draft_id, pos_session_id=pos_session_id)
        except DraftCart.DoesNotExist:
            return False
        if draft.has_pending_approval:
            return False
        draft.delete()
        return True

    @staticmethod
    def cleanup_on_session_close(session_id: int) -> int:
        """
        Elimina los borradores al cerrar la sesión, EXCEPTO los que tienen una
        aprobación de crédito pendiente (has_pending_approval=True). Esos sobreviven
        para que el cajero pueda retomarlos desde otra sesión.
        """
        deleted_count, _ = DraftCart.objects.filter(
            pos_session_id=session_id, has_pending_approval=False
        ).delete()
        return deleted_count

    @staticmethod
    def cleanup_stale_pending_approvals() -> int:
        """
        Limpia has_pending_approval para borradores cuya tarea CREDIT_POS_REQUEST ya no
        está activa (PENDING/IN_PROGRESS). Previene que el flag quede pegado si
        handle_task_update falló en algún momento.
        """
        from workflow.models import Task

        stale = [
            d
            for d in DraftCart.objects.select_related(
                "locked_by", "created_by", "last_modified_by"
            ).filter(has_pending_approval=True)
            if not Task.objects.filter(
                task_type="CREDIT_POS_REQUEST",
                status__in=[Task.Status.PENDING, Task.Status.IN_PROGRESS],
                data__draft_id=d.id,
            ).exists()
        ]
        # save() por fila para emitir el broadcast WS (update() no dispara signals).
        for draft in stale:
            draft.has_pending_approval = False
            draft.save(update_fields=["has_pending_approval"])
        return len(stale)

    @staticmethod
    def cleanup_old_drafts(days: int = 1) -> int:
        """
        Elimina borradores más antiguos que X días. Los borradores con una
        aprobación de crédito pendiente se omiten aunque hayan expirado.
        Primero repara cualquier flag has_pending_approval huérfano.
        """
        DraftCartService.cleanup_stale_pending_approvals()
        cutoff_date = timezone.now() - timedelta(days=days)
        deleted_count, _ = DraftCart.objects.filter(
            updated_at__lt=cutoff_date, has_pending_approval=False
        ).delete()
        return deleted_count

    @staticmethod
    @transaction.atomic
    def process_withdrawal(
        draft_id: int, pos_session_id: int, user, partner_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Procesa el retiro de stock de los items del carrito para un socio.
        Valida que el cliente sea socio y los productos sean almacenables/fabricables con stock.
        """
        from core.cache import acquire_locks

        # Locking user and specific draft to prevent double withdrawal clicking
        lock_resources = [f"draft_withdrawal_{draft_id}"]
        if getattr(user, "id", None):
            lock_resources.append(f"pos_user_{user.id}")

        with acquire_locks(lock_resources, timeout=10):
            try:
                draft = DraftCart.objects.get(id=draft_id, pos_session_id=pos_session_id)
            except DraftCart.DoesNotExist:
                raise ValueError("Borrador no encontrado")

            # Priorizar partner_id si se proporciona, de lo contrario usar el del borrador
            if partner_id:
                from contacts.models import Contact

                try:
                    customer = Contact.objects.get(id=partner_id)
                except Contact.DoesNotExist:
                    raise ValueError("Socio no encontrado.")
            else:
                customer = draft.customer

            if not customer:
                raise ValueError("Debe indicar un socio para realizar el retiro.")

            if not customer.is_partner:
                raise ValueError(f"El cliente {customer.name} no está marcado como Socio.")

            if not draft.items:
                raise ValueError("El carrito está vacío.")

            # Determinar bodega (fallback a la primera encontrada si no hay específica)
            from inventory.models import Warehouse

            warehouse = Warehouse.objects.first()
            if not warehouse:
                raise ValueError("No se encontró una bodega para procesar el retiro.")

            # Second phase of locking: Lock all products in this draft checkout!
            product_ids = [item.get("id") or item.get("product_id") for item in draft.items]
            product_locks = [f"stock_prod_{pid}" for pid in set(product_ids) if pid]

            with acquire_locks(product_locks, timeout=10):
                processed_moves = []

                for item in draft.items:
                    product_id = item.get("id") or item.get("product_id")
                    qty = Decimal(str(item.get("quantity", 0)))

                    if qty <= 0:
                        continue

                    try:
                        product = Product.objects.get(id=product_id)
                    except Product.DoesNotExist:
                        raise ValueError(f"Producto ID {product_id} no encontrado.")

                    # Validaciones solicitadas por el usuario
                    # 1. Capacidad de ser almacenados (track_inventory)
                    if not product.track_inventory:
                        raise ValueError(
                            f"El producto '{product.name}' no tiene habilitado el control de stock."
                        )

                    # 2. Productos con gestión de stock (Almacenable o Fabricable)
                    if not product.strategy.allows_stock_moves:
                        raise ValueError(
                            f"El producto '{product.name}' no puede ser retirado (solo Almacenables o Fabricables)."
                        )

                    # 3. Stock disponible
                    # Usamos qty_available que descuenta reservas
                    if product.qty_available < qty:
                        raise ValueError(
                            f"Stock insuficiente para '{product.name}'. "
                            f"Disponible: {product.qty_available}, Requerido: {qty}"
                        )

                    # Ejecutar movimiento de stock (Salida)
                    # El motivo es PARTNER_WITHDRAWAL
                    description = f"Retiro de utilidades POS - {draft.name}"

                    doc = StockService.process_partner_capital(
                        product=product,
                        warehouse=warehouse,
                        partner_contact=customer,
                        quantity=qty,
                        is_contribution=False,
                        description=description,
                    )
                    processed_moves.append(doc.id)

                # Si todo fue exitoso, eliminar el borrador
                draft.delete()

                return {
                    "success": True,
                    "message": "Retiro procesado exitosamente.",
                    "moves_count": len(processed_moves),
                    "customer_name": customer.name,
                }
