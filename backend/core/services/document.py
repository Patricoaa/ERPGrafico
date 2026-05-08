from abc import ABC, abstractmethod
from typing import ClassVar


class DocumentService(ABC):
    """Servicio polimórfico para procesar cualquier documento transaccional."""

    @abstractmethod
    def confirm(self, document, *, user, **kwargs) -> 'JournalEntry':
        """Confirma el documento (DRAFT → CONFIRMED). Genera asiento."""
        ...

    @abstractmethod
    def cancel(self, document, *, user, reason: str = '', **kwargs) -> None:
        """Anula el documento. Genera asiento de reverso si aplica."""
        ...

    def get_metadata(self) -> dict:
        """Override opcional para extender el schema (ver P-06)."""
        return {}


class DocumentRegistry:
    _services: ClassVar[dict[str, type[DocumentService]]] = {}

    @classmethod
    def register(cls, model_label: str):
        def decorator(service_cls):
            cls._services[model_label.lower()] = service_cls
            return service_cls
        return decorator

    @classmethod
    def for_instance(cls, instance) -> DocumentService:
        label = instance._meta.label_lower
        try:
            return cls._services[label]()
        except KeyError:
            raise NotImplementedError(f"No DocumentService registered for {label}")

    @classmethod
    def for_label(cls, label: str) -> DocumentService:
        try:
            return cls._services[label.lower()]()
        except KeyError:
            raise NotImplementedError(f"No DocumentService registered for {label}")
