---
layer: 20-contracts
doc: import-csv-xlsx
status: active
owner: backend-team
last_review: 2026-05-21
stability: beta
---

# Bulk Import — CSV / XLSX

> **Estado de implementación al 2026-05-21:** contrato definido, sin implementación end-to-end en el codebase. Componente shared `DataManagement.tsx` existe parcialmente. Este doc fija la convención canónica para que el primer playbook (`add-bulk-import.md`, Tier 2 — Sesión 4) tenga rieles.

## Stack elegido

| Operación | Librería | Por qué |
|-----------|----------|---------|
| Parsear CSV/XLSX | [pandas](https://pandas.pydata.org/) | Inferencia de tipos, manejo de NaN, soporta ambos formatos uniformemente |
| Validar por fila | DRF serializer del entity destino | Reutiliza validación canónica — single source of truth con el create endpoint |
| Persistir batched | Servicio del entity + `bulk_create` cuando aplique | Performance + atomicity por batch |
| Reportar errores | `ImportJob.report_rows` (JSON) | Fila a fila, con número de línea original |

Frontend usa la validación Zod del entity como **preview validation** — espejo del serializer pero corre en cliente para feedback rápido. El backend es siempre autoritativo.

---

## Flujo en 2 pasos

```
1. PREVIEW (sync)
   Usuario sube archivo →
   Backend parsea + valida sin escribir →
   Retorna: columnas inferidas, mapping sugerido, errores por fila, sample.
   Usuario revisa y ajusta column mapping en UI.

2. COMMIT (async + idempotente)
   Usuario confirma →
   Frontend POST con Idempotency-Key + column mapping →
   Backend encola Celery task →
   Cliente polea ImportJob →
   Reporte final: éxitos, fallos por fila.
```

**Por qué 2 pasos:** importar es la operación bulk más destructiva del ERP. Un solo paso "subir y crear" garantiza un porcentaje de imports parcialmente fallidos sin contexto para el usuario. Preview obliga a corroborar antes del commit.

---

## Endpoints

### Preview (sync)

```
POST /api/{module}/{entity}/import/preview/
Content-Type: multipart/form-data

file=<binary>
```

**Response 200:**

```json
{
  "columns_detected": ["nombre", "rut", "email", "telefono", "tipo"],
  "rows_total": 1247,
  "sample": [
    { "nombre": "Empresa A", "rut": "76.123.456-7", ... },
    ...
  ],
  "column_mapping_suggested": {
    "name": "nombre",
    "tax_id": "rut",
    "email": "email"
  },
  "validation_errors_sample": [
    { "row": 14, "field": "rut", "error": "RUT inválido: dígito verificador no coincide" },
    { "row": 22, "field": "email", "error": "Email mal formado" }
  ],
  "errors_total": 47,
  "preview_token": "tmp_abc123"
}
```

**Reglas preview:**
- Archivo se persiste temporal en MinIO bucket `imports-staging/` con TTL 1 hora.
- `preview_token` referencia ese archivo; el commit reusa el token sin re-upload.
- Sample = primeros 20 filas + 20 al azar para detectar problemas distribuidos.
- `validation_errors_sample` = máx 100 errores, suficientes para que el usuario decida si vale corregir el archivo o el mapping.
- Máximo de archivo en preview: 25 MB; más → 413 con sugerencia de partir el archivo.

### Commit (async + idempotente)

```
POST /api/{module}/{entity}/import/commit/
Content-Type: application/json
Idempotency-Key: <uuid>

{
  "preview_token": "tmp_abc123",
  "column_mapping": {
    "name": "nombre",
    "tax_id": "rut",
    "email": "email",
    "phone": "telefono"
  },
  "options": {
    "on_error": "skip" | "stop",
    "dedupe_by": "tax_id"
  }
}
```

**Response 202:**

```json
{
  "job_id": "imp_xyz789",
  "poll_url": "/api/jobs/imp_xyz789/"
}
```

**Reglas commit:**
- `Idempotency-Key` obligatorio (lista cerrada — ver [idempotency.md](idempotency.md)).
- Mismo key + mismo `preview_token` + mismo mapping = mismo job (idempotente fuerte).
- `on_error="skip"` (default): error en fila X no detiene el resto; se reporta como skipped.
- `on_error="stop"`: primer error aborta el job; rows ya escritos se hacen rollback vía `transaction.atomic()` por batch (ver §Batching).
- `dedupe_by`: campo que ya en DB → upsert (UPDATE existente, no crear). Si el campo no es unique en el modelo → 400.

### Polling

```
GET /api/jobs/{job_id}/
```

**Response durante ejecución:**

```json
{
  "id": "imp_xyz789",
  "kind": "import",
  "status": "running",
  "progress": { "processed": 450, "total": 1247, "percent": 36 }
}
```

**Response final:**

```json
{
  "id": "imp_xyz789",
  "kind": "import",
  "status": "done",
  "processed": 1247,
  "created": 1180,
  "updated": 20,
  "skipped": 47,
  "errors": 0,
  "report_download_url": "<signed minio URL>",
  "expires_at": "..."
}
```

Reporte descargable (xlsx) contiene fila a fila: `row_number | status | created_pk | error_message`.

---

## Batching

- Batch size: **500 filas** por transacción (`transaction.atomic()`). Suficientemente chico para que un error no obligue a rollback masivo, suficientemente grande para amortizar overhead de transacción.
- Por batch:
  ```python
  with transaction.atomic():
      for row in batch:
          try:
              serializer = EntitySerializer(data=mapped_row)
              serializer.is_valid(raise_exception=True)
              if dedupe_by and (existing := find_existing(serializer.validated_data, dedupe_by)):
                  serializer.update(existing, serializer.validated_data)
                  job.report.append({"row": row.original_index, "status": "updated", "pk": existing.pk})
              else:
                  obj = serializer.save()
                  job.report.append({"row": row.original_index, "status": "created", "pk": obj.pk})
          except ValidationError as e:
              job.report.append({"row": row.original_index, "status": "skipped", "errors": e.detail})
              if options["on_error"] == "stop":
                  raise  # rollback del batch + abort del job
  ```
- Entre batches el job actualiza `progress` y commitea — el usuario ve avance real.

`bulk_create` se permite **solo** cuando el entity no tiene signals que dependan de `post_save` (ver [backend-apps.md](../10-architecture/backend-apps.md#auditing-history) — la mayoría sí tiene, así que bulk_create es excepción rara).

---

## Modelo ImportJob

Comparte el padre genérico con `ExportJob`:

```python
class ImportJob(models.Model):
    JOB_STATUS = [("pending","pending"),("running","running"),("done","done"),("error","error")]
    user             = models.ForeignKey("core.User", on_delete=models.PROTECT)
    entity           = models.CharField(max_length=64)  # "contacts.contact"
    preview_token    = models.CharField(max_length=64)
    column_mapping   = models.JSONField()
    options          = models.JSONField(default=dict)
    idempotency_key  = models.CharField(max_length=64, unique=True, db_index=True)
    status           = models.CharField(max_length=16, choices=JOB_STATUS)
    progress         = models.JSONField(default=dict)  # {"processed": N, "total": M}
    report_rows      = models.JSONField(default=list)  # [{row, status, pk?, errors?}]
    report_storage_key = models.CharField(max_length=256, blank=True)  # xlsx descargable
    created_at       = models.DateTimeField(auto_now_add=True)
    completed_at     = models.DateTimeField(null=True)
```

`report_rows` puede crecer a miles de entries; mantenerlo en JSONB es OK para PYME (<10k filas típicas). Si supera 50k filas: persistir en archivo MinIO + leer on-demand.

---

## Manejo de errores típicos

| Caso | Comportamiento |
|------|----------------|
| Encoding mal detectado (Latín-1 vs UTF-8) | Preview detecta y devuelve `encoding_detected`; usuario puede override en commit |
| Columnas con espacios / mayúsculas inconsistentes | Backend normaliza (`strip`, `lower`) para matching de columnas |
| Filas vacías | Skipped silenciosamente (no cuenta como error) |
| Tipos mal mapeados (string en campo numérico) | Falla en validación del serializer → reporta `errors` claros por campo |
| Archivo no es CSV/XLSX | 400 con detalle |
| Provider externo (SII, banco) requerido durante import | Prohibido. Imports son operaciones locales solamente — si el provider es necesario, post-import se enqueuea un task separado por fila |

---

## Frontend — patrón canónico

Componente shared: `DataManagement.tsx` (ya presente en `components/shared/`, expandir conforme).

Flujo UI:

```
1. Botón "Importar" en la lista del entity →
2. Drawer/modal: dropzone para archivo →
3. Loading mientras preview procesa →
4. Tabla con: columnas detectadas (sortable), sample rows, mapping editable, contador de errores en banner →
5. Botón "Confirmar importación" → genera UUID, llama commit endpoint →
6. Status: barra de progreso + cancelar (solo desencola; rows ya escritos quedan) →
7. Reporte final: contadores + link descarga del .xlsx detallado.
```

Hook canónico:

```ts
// features/{module}/hooks/use{Entity}Import.ts
export function useContactImport() {
  const previewMut = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData(); fd.append("file", file);
      return apiPost("/api/contacts/contacts/import/preview/", fd);
    },
  });

  const commitMut = useMutation({
    mutationFn: async (input: CommitInput) => {
      const idempotencyKey = uuid();
      return apiPost("/api/contacts/contacts/import/commit/", input, {
        headers: { "Idempotency-Key": idempotencyKey },
      });
    },
  });

  return { previewMut, commitMut };
}
```

---

## Tests

| Tipo | Cobertura mínima |
|------|------------------|
| Preview | Archivo válido devuelve sample + mapping; archivo corrupto → 400; >25MB → 413 |
| Commit | Crea entries OK; con errores parciales reporta correctamente; idempotente (mismo key = mismo job) |
| Dedupe | `dedupe_by="tax_id"` actualiza existing en vez de duplicar |
| Batching | Verificar atomic por batch — error en fila 250 no afecta filas 1-249 (modo skip) |
| Cleanup | preview_token >1h se purga; report_storage_key >7d se purga |

---

## Checklist al implementar un import

- [ ] Service en `backend/{app}/services/{entity}_import.py` con `preview()` y `commit()`.
- [ ] Endpoints `preview` y `commit` con permisos correctos (a menudo más restrictivos que CRUD normal — sugerencia: rol `data_admin`).
- [ ] Agregar el endpoint commit a la lista cerrada de idempotencia en [idempotency.md](idempotency.md).
- [ ] Frontend: extender `DataManagement.tsx` para la entity o componente propio si las reglas son atípicas.
- [ ] Tests preview + commit + edge cases de encoding/dedupe.
- [ ] Confirmar TTL preview-staging (1h) y report-storage (7d).

## Referencias

- Idempotency (commit es endpoint de lista cerrada): [idempotency.md](idempotency.md)
- Export (contraparte simétrica): [export-formats.md](export-formats.md)
- Background tasks: [../30-playbooks/add-background-task.md](../30-playbooks/add-background-task.md)
- File upload (mecanismo de upload): [../30-playbooks/add-file-upload.md](../30-playbooks/add-file-upload.md)
- Playbook paso-a-paso: `add-bulk-import.md` (Tier 2 — Sesión 4)
