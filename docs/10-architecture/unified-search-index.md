---
layer: 10-architecture
doc: unified-search-index
status: active
owner: backend-team
last_review: 2026-05-10
---

# Unified Search Index Architecture

ERPGrafico utiliza un sistema de búsqueda global de alto rendimiento basado en un índice unificado denormalizado en Postgres.

## Problema
Anteriormente, la búsqueda global iteraba secuencialmente sobre 17+ entidades (Ventas, Compras, Contactos, etc.). Esto generaba:
1. **Latencia lineal**: 17 consultas SQL por cada búsqueda.
2. **Falta de Ranking**: No se podían comparar resultados entre entidades por relevancia.
3. **Inconsistencia Lingüística**: Uso de diccionarios simples que no entendían raíces en español.

## Solución: GlobalSearchIndex
Se implementó una tabla centralizada `core.GlobalSearchIndex` que actúa como un motor de búsqueda interno.

### El Modelo
```python
class GlobalSearchIndex(models.Model):
    # Enlace polimórfico al objeto original
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.CharField(max_length=50, db_index=True)
    
    # Datos de búsqueda (Postgres SearchVectorField)
    search_vector = SearchVectorField(null=True)
    
    # Datos de visualización denormalizados (Cache)
    title = models.CharField(max_length=255)
    subtitle = models.CharField(max_length=255, blank=True)
    extra_info = models.CharField(max_length=255, blank=True)
    icon = models.CharField(max_length=50, blank=True)
    
    entity_label = models.CharField(max_length=100, db_index=True) # e.g. 'sales.saleorder'
```

### Flujo de Datos
1. **Registro**: Cada aplicación registra su entidad en `UniversalRegistry`.
2. **Indexación**: Al guardar/eliminar un registro, `UniversalRegistry` recibe una señal (`post_save`/`post_delete`) y actualiza el `GlobalSearchIndex`.
3. **Búsqueda**: La vista de búsqueda consulta **una sola vez** a `GlobalSearchIndex` usando `SearchRank` para ordenar por relevancia.

## Características Clave

### 1. Stemming en Español
El índice usa la configuración `spanish` de Postgres. Buscar "Ventas" encontrará registros que contengan "Venta", "Vendedor", etc.

### 2. Inteligencia de Prefijos
El motor detecta prefijos canónicos (ej. `NV-`, `OCS-`). Si se detecta un prefijo:
- Se limpia el término de búsqueda (ej. `NV-100` -> `100`).
- Se filtra el índice por `entity_label` (ej. solo `sales.saleorder`).
- Si el término queda vacío (solo el prefijo), se muestran los registros más recientes de esa entidad.

### 3. Normalización de RUTs
Para términos alfanuméricos de 3+ caracteres, se inyecta una lógica de `iregex` que permite encontrar RUTs formateados (`88.222.333-k`) aunque el usuario busque sin puntos ni guiones (`88222`).

## Componentes Técnicos
- **Registry**: `backend/core/registry.py` (Lógica de orquestación).
- **Modelo**: `backend/core/models/search.py`.
- **Comando**: `python manage.py rebuild_search_index` (Poblamiento masivo).
- **GIN Index**: El campo `search_vector` utiliza un índice GIN para búsquedas instantáneas.
