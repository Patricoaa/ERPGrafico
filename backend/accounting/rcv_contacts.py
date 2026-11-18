"""Alta de contactos a partir de las contrapartes del RCV importado.

Se llama desde la ejecución de la importación con los documentos ya normalizados:
crea los contactos que falten, reutiliza los existentes aunque tengan otro formato
de RUT y nunca hace peticiones nuevas. Si un contacto no se puede crear, se omite
sin revertir la importación de documentos.
"""

from __future__ import annotations

from dataclasses import dataclass

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Value
from django.db.models.functions import Replace, Upper

from accounting.integrations.rcv_normalizer import is_valid_rut, normalize_rut
from contacts.models import Contact, ContactRole

# Las boletas del RCV comparten este RUT genérico y no tienen razón social.
GENERIC_RUTS = frozenset({"66666666-6"})

ROLE_BY_DIRECTION = {
    "PURCHASES": ContactRole.SUPPLIER.value,
    "SALES": ContactRole.CUSTOMER.value,
}


@dataclass
class ContactOutcome:
    created: int = 0
    updated: int = 0
    skipped: int = 0


def _normalized_tax_id():
    """Quita puntos y espacios sin tocar el guion, igual que ``normalize_rut``."""
    return Upper(Replace(Replace("tax_id", Value("."), Value("")), Value(" "), Value("")))


def _contacts_by_rut(ruts) -> dict[str, Contact]:
    """Devuelve contactos indexados por RUT canónico, en una sola consulta."""
    keys = {key for rut in ruts for key in (rut, rut.replace("-", ""))}
    if not keys:
        return {}
    rows = Contact.objects.annotate(normalized=_normalized_tax_id()).filter(normalized__in=keys)
    return {normalize_rut(row.normalized): row for row in rows}


def _candidate_ruts(documents, company_rut: str) -> dict[str, str]:
    """RUTs elegibles → razón social (o vacía). Descarta los RUTs que no son contacto."""
    own_rut = normalize_rut(company_rut)
    candidates: dict[str, str] = {}
    for doc in documents:
        rut = normalize_rut(doc.counterparty_rut)
        if not rut or not is_valid_rut(rut) or rut in GENERIC_RUTS or rut == own_rut:
            continue
        name = (doc.counterparty_name or "").strip()
        previous = candidates.get(rut, "")
        candidates[rut] = name or previous
    return candidates


def ensure_contacts_for_documents(documents, direction: str, company_rut: str) -> ContactOutcome:
    """Crea o actualiza los contactos de las contrapartes de un reporte del RCV.

    ``documents`` es un iterable de ``NormalizedDocument``. Un mismo RUT se procesa una
    sola vez y gana ambas direcciones si aparece en compras y ventas en distintas
    importaciones. Los errores de un contacto quedan en ``skipped``; el resto sigue.
    """
    role = ROLE_BY_DIRECTION[direction]
    candidates = _candidate_ruts(documents, company_rut)
    outcome = ContactOutcome()
    if not candidates:
        return outcome

    existing = _contacts_by_rut(candidates)
    for rut, name in candidates.items():
        contact = existing.get(rut)
        if contact is None:
            try:
                # Savepoint propio: un IntegrityError no debe invalidar la transacción
                # que ya guardó los documentos del RCV.
                with transaction.atomic():
                    contact = Contact.objects.create(
                        name=name or f"RUT {rut} (RCV)", tax_id=rut, roles=[role]
                    )
            except (IntegrityError, ValidationError):
                # Otra importación pudo crear el contacto entre la búsqueda y el alta.
                contact = _contacts_by_rut([rut]).get(rut)
                if contact is None:
                    outcome.skipped += 1
                    continue
                existing[rut] = contact
            else:
                outcome.created += 1
                existing[rut] = contact
                continue
        roles = contact.roles or []
        if role in roles:
            continue
        contact.roles = [*roles, role]
        try:
            contact.save(update_fields=["roles", "updated_at"])
        except (IntegrityError, ValidationError):
            outcome.skipped += 1
            continue
        outcome.updated += 1
    return outcome
