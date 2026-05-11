# Benchmark: GenericForeignKey (GFK) Baseline (2026-05)

## Entorno de Prueba
- **Dataset:** 100.000 asientos contables (JournalEntry), 200.000 apuntes (JournalItem), 50.000 facturas/documentos origen.
- **Mecanismo Evaluado:** Migración de llaves foráneas estáticas (F4) a GenericForeignKey (F5).
- **Herramienta:** `pytest-benchmark`.

## Resultados (Latencia p95)

| Escenario | Pre-GFK (Stash F4) | Post-GFK (Sin Índice) | Post-GFK (Con Índice) |
|-----------|--------------------|-----------------------|-----------------------|
| **Auxiliar de Proveedores (100k)** | 35 ms | **850 ms** 🚨 | 40 ms ✅ |
| **Mayor de Cuenta (50k)** | 45 ms | 55 ms | 50 ms ✅ |

## Análisis de Degradación y Mitigación
Tras la fase 5 (F5) donde se implementó la consolidación arquitectónica de `TransactionalDocument` reemplazando los campos duros (`purchase_order`, `sale_order`) por un `GenericForeignKey` (`source_document`), se observó una degradación crítica.

- La latencia para consultar el **Auxiliar de Proveedores** (que busca todos los asientos relacionados a un documento específico utilizando `source_content_type` y `source_object_id`) se disparó en más de un **2000%** (>20% de degradación estipulado en T-65), alcanzando 850ms en el p95.
- La consulta del **Mayor de Cuenta** no sufrió una degradación drástica porque sigue iterando sobre la llave directa `JournalItem.account`.

### Resolución
De acuerdo a las normativas de la T-65, se añadió un índice compuesto en el archivo `backend/accounting/models.py`:
```python
class Meta:
    indexes = [
        models.Index(fields=['source_content_type', 'source_object_id']),
    ]
```
Tras generar y aplicar la migración, la latencia retornó a **40ms**, equiparándose a los tiempos pre-GFK y restaurando la estabilidad del módulo contable.
