---
layer: 30-playbooks
doc: add-bulk-import
task: add a bulk CSV/XLSX import
triggers: [import, csv, xlsx, bulk upload, importar contactos, importar productos, column mapping, preview commit]
preconditions: [import-csv-xlsx, idempotency, add-background-task, add-file-upload]
validation: [pytest backend/{app}/tests, manual upload + preview + commit, idempotency replay test]
forbidden: [import sync (sin Celery) para >100 filas, escribir sin preview, ignorar Idempotency-Key]
status: active
owner: backend-team
last_review: 2026-05-21
---

# Add a bulk import (CSV / XLSX)

Receta para que un entity acepte importación bulk siguiendo el flujo canónico **preview (sync) → commit (async + idempotent)**. Contrato en [import-csv-xlsx.md](../20-contracts/import-csv-xlsx.md).

## When to use

- Onboarding de cliente nuevo que trae sus contactos / productos / plan de cuentas en Excel.
- Migración desde otro sistema.
- Cargas periódicas (nómina mensual, lista de precios).

**No usar para:** crear 1-2 registros a la vez (es CRUD normal); imports que requieren confirmación tras llamada a sistema externo (esos son flows individuales con retry, no bulk).

## Step 0 — Confirmar dependencias

- Modelo `ImportJob` existe en `backend/core/models/jobs.py` (compartido con export). Si no: crearlo primero (ver [add-export-pdf-excel.md](add-export-pdf-excel.md) §B paso 1).
- Endpoint `GET /api/jobs/{id}/` existe. Si no: crearlo primero.
- El entity tiene serializer de `create` que valida correctamente. Si la validación de `create` está incompleta, **arreglar eso primero** — el importer la reusa.

## Step 1 — Modelo ImportJob (si no existe ya)

```python
# backend/core/models/jobs.py
class ImportJob(models.Model):
    JOB_STATUS = [("pending","pending"),("running","running"),("done","done"),("error","error")]
    user             = models.ForeignKey("core.User", on_delete=models.PROTECT)
    entity           = models.CharField(max_length=64)
    preview_token    = models.CharField(max_length=64)
    column_mapping   = models.JSONField()
    options          = models.JSONField(default=dict)
    idempotency_key  = models.CharField(max_length=64, unique=True, db_index=True)
    status           = models.CharField(max_length=16, choices=JOB_STATUS, default="pending")
    progress         = models.JSONField(default=dict)
    report_rows      = models.JSONField(default=list)
    report_storage_key = models.CharField(max_length=256, blank=True)
    created_at       = models.DateTimeField(auto_now_add=True)
    completed_at     = models.DateTimeField(null=True)
```

Migration aparte. Indexar `idempotency_key` (unique) y `created_at`.

## Step 2 — Service importer

`backend/{app}/services/{entity}_importer.py`:

```python
import pandas as pd
from dataclasses import dataclass
from django.db import transaction
from core.storage import save_preview_file, load_preview_file
from {app}.serializers import {Entity}Serializer

@dataclass
class PreviewResult:
    columns_detected: list[str]
    rows_total: int
    sample: list[dict]
    column_mapping_suggested: dict[str, str]
    validation_errors_sample: list[dict]
    errors_total: int
    preview_token: str

def preview_{entity}_import(file, user) -> PreviewResult:
    df = pd.read_excel(file) if file.name.endswith(".xlsx") else pd.read_csv(file, sep=None, engine="python")
    df.columns = [c.strip() for c in df.columns]

    token = save_preview_file(user.id, df)  # → MinIO bucket imports-staging/, TTL 1h
    columns = list(df.columns)
    sample_indexes = list(range(min(20, len(df)))) + random.sample(range(len(df)), min(20, len(df)))
    sample = df.iloc[sample_indexes].to_dict("records")

    # Mapping sugerido por similitud nombre-de-columna ↔ field del serializer
    suggested = suggest_mapping(columns, {Entity}Serializer)

    # Validación seca (no escribe)
    errors = []
    for i, row in df.iterrows():
        mapped = remap(row.to_dict(), suggested)
        ser = {Entity}Serializer(data=mapped)
        if not ser.is_valid():
            for field, msgs in ser.errors.items():
                errors.append({"row": i + 2, "field": field, "error": msgs[0]})  # +2 = header + 1-index
                if len(errors) >= 100:
                    break
        if len(errors) >= 100:
            break

    return PreviewResult(
        columns_detected=columns,
        rows_total=len(df),
        sample=sample,
        column_mapping_suggested=suggested,
        validation_errors_sample=errors,
        errors_total=len(errors),  # aproximado; bandera para el usuario
        preview_token=token,
    )
```

```python
@dataclass
class CommitReport:
    processed: int
    created: int
    updated: int
    skipped: int
    errors: int
    report_storage_key: str  # xlsx detallado

def commit_{entity}_import(job: ImportJob) -> CommitReport:
    df = load_preview_file(job.user_id, job.preview_token)
    mapping = job.column_mapping
    dedupe_by = job.options.get("dedupe_by")
    on_error = job.options.get("on_error", "skip")

    report = []
    batch_size = 500
    counters = {"created": 0, "updated": 0, "skipped": 0, "errors": 0}

    for batch_start in range(0, len(df), batch_size):
        batch = df.iloc[batch_start:batch_start + batch_size]
        with transaction.atomic():
            for i, row in batch.iterrows():
                mapped = remap(row.to_dict(), mapping)
                row_num = i + 2
                try:
                    ser = {Entity}Serializer(data=mapped)
                    ser.is_valid(raise_exception=True)
                    existing = (
                        {Entity}.objects.filter(**{dedupe_by: ser.validated_data[dedupe_by]}).first()
                        if dedupe_by else None
                    )
                    if existing:
                        ser.update(existing, ser.validated_data)
                        report.append({"row": row_num, "status": "updated", "pk": existing.pk})
                        counters["updated"] += 1
                    else:
                        obj = ser.save()
                        report.append({"row": row_num, "status": "created", "pk": obj.pk})
                        counters["created"] += 1
                except ValidationError as e:
                    report.append({"row": row_num, "status": "skipped", "errors": e.detail})
                    counters["skipped"] += 1
                    if on_error == "stop":
                        raise

        job.progress = {"processed": batch_start + len(batch), "total": len(df)}
        job.save(update_fields=["progress"])

    # Generar xlsx descargable con detalle
    storage_key = build_and_upload_report_xlsx(job.user_id, job.id, report)

    return CommitReport(
        processed=len(df),
        created=counters["created"],
        updated=counters["updated"],
        skipped=counters["skipped"],
        errors=counters["errors"],
        report_storage_key=storage_key,
    )
```

## Step 3 — Endpoints

```python
# backend/{app}/views.py
from core.idempotency import idempotent_endpoint  # decorador del contrato idempotency.md

class {Entity}ImportView(APIView):
    permission_classes = [IsAuthenticated, Can{Entity}Import]
    parser_classes = [MultiPartParser]

    @action(detail=False, methods=["post"], url_path="preview")
    def preview(self, request):
        file = request.FILES["file"]
        result = preview_{entity}_import(file, request.user)
        return Response(asdict(result))

    @action(detail=False, methods=["post"], url_path="commit")
    @idempotent_endpoint(scope="{app}.{entity}.import_commit")
    def commit(self, request):
        job = ImportJob.objects.create(
            user=request.user,
            entity="{app}.{entity}",
            preview_token=request.data["preview_token"],
            column_mapping=request.data["column_mapping"],
            options=request.data.get("options", {}),
            idempotency_key=request.headers["Idempotency-Key"],
        )
        run_{entity}_import_task.delay(job.id)
        return Response({"job_id": job.id, "poll_url": f"/api/jobs/{job.id}/"}, status=202)
```

URL routing:

```python
# backend/{app}/urls.py
path("{entity}/import/preview/", {Entity}ImportView.as_view({"post": "preview"})),
path("{entity}/import/commit/",  {Entity}ImportView.as_view({"post": "commit"})),
```

## Step 4 — Celery task

```python
# backend/{app}/tasks.py
@shared_task(bind=True, max_retries=2)
def run_{entity}_import_task(self, job_id: int):
    job = ImportJob.objects.get(pk=job_id)
    job.status = "running"; job.save(update_fields=["status"])
    try:
        report = commit_{entity}_import(job)
        job.report_rows = []  # opcional: si se persiste también en JSON
        job.report_storage_key = report.report_storage_key
        job.status = "done"
        job.completed_at = timezone.now()
        job.save(update_fields=["status", "completed_at", "report_storage_key"])
    except Exception as e:
        job.status = "error"; job.error_message = str(e)
        job.save(update_fields=["status", "error_message"])
        raise
```

## Step 5 — Frontend

Componente shared `DataManagement.tsx` ya existe parcialmente — extender. Por feature, crear hook:

```ts
// frontend/features/{module}/hooks/use{Entity}Import.ts
import { v4 as uuid } from "uuid";

export function use{Entity}Import() {
  const previewMut = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData(); fd.append("file", file);
      return apiPost("/api/{module}/{entity}/import/preview/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
  });

  const commitMut = useMutation({
    mutationFn: async ({ previewToken, columnMapping, options }: CommitInput) => {
      const key = uuid();
      return apiPost("/api/{module}/{entity}/import/commit/",
        { preview_token: previewToken, column_mapping: columnMapping, options },
        { headers: { "Idempotency-Key": key } },
      );
    },
  });

  return { previewMut, commitMut };
}
```

UI flow:
1. Botón "Importar" en lista → drawer con dropzone.
2. Subir archivo → llamar `previewMut`.
3. Mostrar tabla con sample + mapping editable + banner de errores.
4. Botón "Confirmar" → genera UUID → llamar `commitMut`.
5. Mostrar `pollJobUntilDone(job_id)` con barra de progreso.
6. Final: contadores + link descarga del .xlsx detallado.

## Step 6 — Lista cerrada de idempotencia

Editar [idempotency.md](../20-contracts/idempotency.md) — agregar el endpoint nuevo a la tabla "Lista cerrada":

```
| `POST` | `/api/{module}/{entity}/import/commit/` | Importación bulk |
```

## Validation

```bash
# Tests
pytest backend/{app}/tests/test_importer.py
pytest backend/{app}/tests/test_views.py::test_import_preview
pytest backend/{app}/tests/test_views.py::test_import_commit_idempotent

# Smoke manual
# 1. Subir CSV con 100 filas, 5 errores intencionales.
# 2. Preview muestra los 5 errores + sample.
# 3. Ajustar mapping si necesario, confirmar.
# 4. Job corre, barra de progreso avanza.
# 5. Reporte final: 95 created, 5 skipped.
# 6. Descargar reporte xlsx → ver filas con error y motivo.
# 7. Reintentar mismo Idempotency-Key → response idéntico, NO duplica datos.
```

## Common pitfalls

- **Preview sin TTL** → archivos basura se acumulan en MinIO. Cron diario `purge_old_preview_stagings` borra >1h.
- **`pandas.read_csv` sin `sep=None`** → asume coma; archivos con `;` rompen. Engine `python` permite auto-detect.
- **Validar al `commit` y no al `preview`** → el usuario sube 1000 filas, confirma, descubre 500 errores. Preview obliga a verlos antes.
- **No reusar el serializer** → tentación de escribir un parser propio. La validación canónica vive en el serializer; copiarla = drift.
- **bulk_create** → tienta por performance, pero salta `post_save` signals y muchos modelos del proyecto los necesitan (auditing, cache invalidation). Excepción rara y documentada.
- **Idempotency-Key reused con file distinto** → debe ser 409 Conflict (el decorator ya lo maneja).
- **Excel con encoding raro (Latin-1)** → pandas falla silencioso o muta tildes. Preview debe reportar `encoding_detected` y permitir override.

## Definition of done

- [ ] Service `preview_*` + `commit_*` con validación reusando serializer canónico.
- [ ] Endpoints preview + commit; commit con `@idempotent_endpoint`.
- [ ] Task Celery que llama `commit_*` y actualiza `ImportJob.status` + `progress`.
- [ ] Frontend hook + extensión de DataManagement (o componente propio).
- [ ] Endpoint commit agregado a lista cerrada en [idempotency.md](../20-contracts/idempotency.md).
- [ ] Tests preview / commit / dedupe / idempotente / encoding.
- [ ] Smoke manual completo (incluye reintento con mismo key).
- [ ] Cleanup cron `purge_old_preview_stagings` registrado en Celery beat.

## Referencias

- Contrato: [import-csv-xlsx.md](../20-contracts/import-csv-xlsx.md)
- Idempotency obligatoria: [idempotency.md](../20-contracts/idempotency.md)
- Export (simétrico, comparte modelos Job): [add-export-pdf-excel.md](add-export-pdf-excel.md)
- File upload: [add-file-upload.md](add-file-upload.md)
- Background tasks: [add-background-task.md](add-background-task.md)
