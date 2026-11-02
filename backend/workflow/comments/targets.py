"""Resolución del target de un comentario: label "app.model" + id (ADR-0080, ADR-0111)."""

from __future__ import annotations

from dataclasses import dataclass

from django.contrib.contenttypes.models import ContentType
from django.db import models
from rest_framework.exceptions import NotFound, ValidationError

from core.documents.types import DocumentTypeRegistry


@dataclass(frozen=True)
class CommentTarget:
    label: str
    obj: models.Model

    @property
    def content_type(self) -> ContentType:
        return ContentType.objects.get_for_model(self.obj.__class__)

    @property
    def view_permission(self) -> str:
        return DocumentTypeRegistry.view_permission(self.label)

    @property
    def url(self) -> str:
        return DocumentTypeRegistry.canonical_url(self.label, self.obj)


def parse_target(raw: str | None) -> tuple[str, str]:
    """Separa "sales.saleorder:123" en ("sales.saleorder", "123")."""
    label, sep, pk = (raw or "").rpartition(":")
    if not sep or "." not in label or not pk.isdigit():
        raise ValidationError({"target": "Formato esperado: 'app.model:id'."})
    return label.lower(), pk


def resolve_target(label: str, pk) -> CommentTarget:
    model = DocumentTypeRegistry.model_for(label)
    if model is None:
        raise ValidationError({"target": f"Entidad '{label}' no reconocida."})
    obj = model._default_manager.filter(pk=pk).first()
    if obj is None:
        raise NotFound("La entidad comentada no existe.")
    return CommentTarget(label=DocumentTypeRegistry.label_for(model), obj=obj)


def label_of(comment) -> str:
    """Label "app.model" de la entidad comentada, sin cargarla."""
    return DocumentTypeRegistry.label_for(comment.content_type.model_class())


def target_of(comment) -> CommentTarget:
    """Target de un comentario existente (para editar/eliminar)."""
    return resolve_target(label_of(comment), comment.object_id)
