"""Declarative edit policy for records with posted derivatives (ADR-0091)."""

from collections.abc import Callable, Iterable
from dataclasses import dataclass
from typing import Any

from core.exceptions import DomainError

DEFAULT_MUTABLE_WHEN_LOCKED = frozenset({"notes"})


class DocumentLockedError(DomainError):
    def __init__(self, message: str, fields: Iterable[str] = ()):
        super().__init__(
            message, code="DOCUMENT_LOCKED", details={"fields": sorted(fields)}
        )


@dataclass(frozen=True)
class EditPolicy:
    """Declared on a model as ``edit_policy = EditPolicy(...)``.

    A record is locked when its status is outside ``editable_statuses`` or when
    ``is_locked(instance)`` is true. Locked records accept writes only to
    ``mutable_when_locked`` and are hard-deleted only if ``is_purgeable`` allows
    it (a cancelled record that left no accounting trace). The policy guards
    user edits; service transitions (posting, annul) write locked fields directly.
    """

    editable_statuses: frozenset[str] | None = None
    is_locked: Callable[[Any], bool] | None = None
    mutable_when_locked: frozenset[str] = DEFAULT_MUTABLE_WHEN_LOCKED
    deletable: bool = False
    is_purgeable: Callable[[Any], bool] | None = None
    status_field: str = "status"
    locked_message: str = (
        "El registro tiene efectos contables o de tesorería y no se puede modificar. "
        "Anúlelo y vuelva a crearlo."
    )

    def locked(self, instance: Any) -> bool:
        if instance.pk is None:
            return False
        if (
            self.editable_statuses is not None
            and getattr(instance, self.status_field) not in self.editable_statuses
        ):
            return True
        return bool(self.is_locked and self.is_locked(instance))

    def assert_editable(self, instance: Any, fields: Iterable[str] | None = None) -> None:
        if not self.locked(instance):
            return
        blocked = (
            {"*"} if fields is None else set(fields) - self.mutable_when_locked
        )
        if blocked:
            raise DocumentLockedError(self.locked_message, blocked - {"*"})

    def assert_deletable(self, instance: Any) -> None:
        if self.is_purgeable and self.is_purgeable(instance):
            return
        if not self.deletable or self.locked(instance):
            raise DocumentLockedError(
                "Este registro no se puede eliminar; utilice la anulación."
            )


DRAFT_ONLY_DOCUMENT = EditPolicy(
    editable_statuses=frozenset({"DRAFT"}),
    is_locked=lambda doc: doc.journal_entry_id is not None,
)
"""Transactional documents corrected by cancel (DRAFT) / annul (CONFIRMED); never hard-deleted."""


def get_edit_policy(model_or_instance: Any) -> EditPolicy | None:
    return getattr(model_or_instance, "edit_policy", None)


def assert_editable(instance: Any, fields: Iterable[str] | None = None) -> None:
    policy = get_edit_policy(instance)
    if policy is not None:
        policy.assert_editable(instance, fields)


def is_editable(instance: Any) -> bool:
    policy = get_edit_policy(instance)
    return policy is None or not policy.locked(instance)


def changed_fields(instance: Any, validated_data: dict[str, Any]) -> set[str]:
    """Fields whose incoming value differs from the stored one (PUT resends unchanged fields)."""
    return {
        name
        for name, value in validated_data.items()
        if not hasattr(instance, name) or getattr(instance, name) != value
    }
