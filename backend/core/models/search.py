from django.db import models
from django.contrib.postgres.search import SearchVectorField
from django.contrib.postgres.indexes import GinIndex
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from django.utils.translation import gettext_lazy as _

class GlobalSearchIndex(models.Model):
    """
    Unified search index for high-performance global search across all entities.
    Denormalizes display data and uses Postgres GIN indexes for FTS.
    """
    # Polymorphic link
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.CharField(max_length=50, db_index=True)
    content_object = GenericForeignKey('content_type', 'object_id')
    
    # Search vector (FTS)
    search_vector = SearchVectorField(null=True)
    
    # Denormalized display fields (for instant results without joins)
    title = models.CharField(_("Título"), max_length=255)
    subtitle = models.CharField(_("Subtítulo"), max_length=255, blank=True)
    extra_info = models.CharField(_("Información Extra"), max_length=255, blank=True)
    icon = models.CharField(_("Icono"), max_length=50, blank=True)
    
    # Metadata for routing
    entity_label = models.CharField(max_length=100, db_index=True) # e.g. 'sales.saleorder'
    
    # Internal audit
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("Índice de Búsqueda Global")
        verbose_name_plural = _("Índices de Búsqueda Global")
        indexes = [
            GinIndex(fields=['search_vector'], name='idx_global_search_vector'),
            models.Index(fields=['content_type', 'object_id']),
            models.Index(fields=['entity_label']),
        ]

    def __str__(self):
        return f"[{self.entity_label}] {self.title}"
