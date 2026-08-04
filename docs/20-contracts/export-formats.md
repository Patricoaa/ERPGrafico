---
layer: 20-contracts
doc: export-formats
status: active
owner: backend-team
last_review: 2026-05-21
stability: beta
---

# Export Formats — PDF / Excel / CSV

> **Estado de implementación al 2026-08-04 (reconciliado con código):**
> - **WeasyPrint → IMPLEMENTADO** (sync): PDFs de órdenes de producción (`production.services.WorkOrderPdfService.generate_pdf` / `generate_bulk_pdf`, [production/services.py:2159](../../backend/production/services.py#L2159)) y reportes POS de tesorería (`treasury/pos_report_pdf.render_pos_report_pdf`, [treasury/views.py:869](../../backend/treasury/views.py#L869)). `weasyprint` en [requirements.txt:33](../../backend/requirements.txt#L33).
> - **openpyxl → presente** en [requirements.txt:21](../../backend/requirements.txt#L21) (sin export xlsx en producción todavía).
> - **NO implementado:** el pipeline async (`ExportJob`, `/api/jobs/`, subida a storage + signed URL, cron de purge de 7 días) y `core/excel.py` helpers. Los PDFs actuales son sync.
> - Este doc sigue siendo la convención canónica: cualquier export nuevo debe seguir esto o levantar ADR.

## Stack elegido

| Formato | Librería | Por qué |
|---------|----------|---------|
| **PDF** | [WeasyPrint](https://weasyprint.org/) | HTML → PDF determinístico, themable vía CSS, cero dependencia JS, instalación pip pura |
| **Excel** | [openpyxl](https://openpyxl.readthedocs.io/) | xlsx nativo, soporta fórmulas y formato celda, mantenido |
| **CSV** | stdlib `csv` | Simple, sin dependencia |

**Rechazados (no usar):**
- `xhtml2pdf` / `pdfkit` (wkhtmltopdf binary; deprecated, instalación frágil).
- `xlwt` (solo `.xls` antiguo, no soporta xlsx).
- `pandas.to_excel()` para reportes formateados (sirve para dumps simples, no para reportes con secciones / totales / branding).
- ReportLab nativo (curva de aprendizaje alta para PDFs simples; mejor HTML+CSS via WeasyPrint).

`pandas.to_excel()` se permite **solo** para exports tabulares planos sin formato (dump puro).

---

## Patrón sync vs async — threshold

| Condición | Modo | Comportamiento |
|-----------|------|----------------|
| Tamaño estimado <5 MB **AND** generación <2 s | **Sync** | Endpoint devuelve binario con `Content-Disposition: attachment` |
| Cualquier otra | **Async** | Endpoint devuelve `202 + {job_id}` → cliente polea / suscribe SSE → descarga signed URL |

**Estimación rápida del tamaño** (no exacta, sirve como gate):
- PDF: ~3 KB por página de tabla densa, ~8 KB con imágenes/logo.
- Excel: ~1 KB por fila + ~50 KB de overhead.
- CSV: ~150 bytes por fila típica de transacción.

**Decisión en código:** la regla vive en el service, **no** en el view. El view hace `service.export(...) → ExportResult(mode, payload | job_id)` y switchea response según `mode`.

---

## Convención de endpoints

```
GET  /api/{module}/{entity}/export/?format={pdf|xlsx|csv}&...filters
```

| Parámetro | Tipo | Notas |
|-----------|------|-------|
| `format` | enum | `pdf`, `xlsx`, `csv` — required |
| `...filters` | string | Mismos filtros que la lista regular del entity — reutiliza el filterset |
| `Idempotency-Key` (header) | string | **Solo** en async (POST asíncrono opcional, ver abajo). Sync GET no lo necesita |

**Respuestas:**

| Caso | Status | Body | Headers |
|------|--------|------|---------|
| Sync | `200` | binary blob | `Content-Type: <mime>`, `Content-Disposition: attachment; filename="..."` |
| Async (encolado) | `202` | `{"job_id": "...", "poll_url": "/api/jobs/{id}/"}` | — |
| Async (job pollado) | `200` | `{"status":"done","download_url":"<signed minio>","expires_at":"..."}` | — |

**Por qué GET para sync y async-via-job-id:** semánticamente exportar es "leer una representación derivada"; los efectos colaterales mínimos del async (crear el job record) no rompen idempotencia REST porque las re-llamadas son seguras.

---

## Endpoints listables vs detalle

Dos tipos canónicos:

| Caso | Patrón | Ejemplo |
|------|--------|---------|
| Listado / reporte | `/api/{module}/{entity}/export/?format=...` | Libro de ventas mensual, listado de stock |
| Documento singular | `/api/{module}/{entity}/{id}/document/?format=pdf` | Factura individual, orden de compra para enviar al proveedor |

Documento singular es **casi siempre sync** (un solo PDF, <100 KB típico). Reportes listables son los candidatos a async.

---

## Templating PDF (WeasyPrint)

- Templates en `backend/{app}/templates/exports/{entity}.html`.
- CSS en el mismo template o en `backend/{app}/static/exports/{entity}.css`.
- Print-specific: `@page { size: letter; margin: 1.5cm }`, `page-break-after`.
- Logo + branding desde `core` (compartido):
  ```html
  {% load static %}
  <img src="{% static 'branding/logo.png' %}" alt="">
  ```
- Fuente: web fonts permitidas via `@font-face` (WeasyPrint las descarga local en runtime; cachear en MinIO si hay latencia).

Service de generación:

```python
# backend/billing/services/invoice_pdf.py
from weasyprint import HTML
from django.template.loader import render_to_string

def render_invoice_pdf(invoice) -> bytes:
    html = render_to_string("exports/invoice.html", {"invoice": invoice})
    return HTML(string=html, base_url=settings.SITE_URL).write_pdf()
```

---

## Templating Excel (openpyxl)

- Plantillas: en código (no archivos `.xlsx` template — duros de versionar).
- Helpers compartidos en `backend/core/excel.py`:
  - `header_style()`, `money_style()`, `date_style()`, `total_row_style()`.
  - `auto_width(ws)`.
- Estructura típica de hoja:
  1. Fila 1: título + período.
  2. Fila 3: encabezados (style header).
  3. Filas 4+: data.
  4. Fila final: totales (style total).
  5. Auto-width al cerrar.

```python
# backend/billing/services/sales_book.py
from openpyxl import Workbook
from core.excel import header_style, money_style, auto_width

def build_sales_book(period) -> Workbook:
    wb = Workbook()
    ws = wb.active
    ws.title = f"Ventas {period}"
    ws.append([f"Libro de Ventas — {period}"])
    ws.append([])
    ws.append(["Folio", "Cliente", "Fecha", "Neto", "IVA", "Total"])
    header_style(ws[3])
    for inv in invoices_for_period(period):
        ws.append([inv.folio, inv.customer.name, inv.date, inv.net, inv.tax, inv.total])
        money_style(ws.cell(row=ws.max_row, column=4))
        money_style(ws.cell(row=ws.max_row, column=5))
        money_style(ws.cell(row=ws.max_row, column=6))
    auto_width(ws)
    return wb
```

---

## CSV

- Stdlib `csv.DictWriter` con `quoting=csv.QUOTE_MINIMAL`.
- Encoding: **UTF-8 con BOM** (`utf-8-sig`) para que Excel lo abra correctamente sin "garbage" en tildes — convención chilena de oficina.
- Delimitador: `;` (estándar es-CL); coma rompe Excel-es.
- Newlines: `\r\n` (Excel compatibility).

```python
import csv
from io import BytesIO, TextIOWrapper

def write_csv(rows, fieldnames) -> bytes:
    buf = BytesIO()
    text = TextIOWrapper(buf, encoding="utf-8-sig", newline="")
    writer = csv.DictWriter(text, fieldnames=fieldnames, delimiter=";")
    writer.writeheader()
    writer.writerows(rows)
    text.flush()
    return buf.getvalue()
```

---

## Storage async (MinIO via django-storages)

> **Configuración real (2026-08-04):** el storage NO es un cliente `boto3` raw en `core/storage.py` (ese módulo no existe). Se usa `django-storages[boto3]` con `S3Boto3Storage` ([settings.py:251-267](../../backend/config/settings.py#L251)): toggle `USE_S3`, endpoint `AWS_S3_ENDPOINT_URL` (default `http://minio:9000`, S3-compatible — también compatible con Cloudflare R2 cambiando el endpoint), firmas `s3v4`, `AWS_S3_FILE_OVERWRITE=False`. Los snippets de este doc usan `storage_client` como alias conceptual del backend de storage activo.

Generados async se suben a MinIO y se sirven via signed URL:

| Aspecto | Convención |
|---------|------------|
| Bucket | `exports` |
| Path | `{user_id}/{job_id}.{ext}` |
| TTL del objeto | **7 días** — Celery beat job purga objetos >7d cada noche |
| Signed URL TTL | **15 min** — coherente con [security.md](../40-quality/security.md) |
| Filename de descarga | Setear `response-content-disposition` en la signed URL: `attachment; filename="ventas-2026-05.xlsx"` |

Cron de cleanup (especificación — la tarea `purge_old_exports` NO existe aún en `core/tasks.py`):

```python
# backend/core/tasks.py — a implementar
from core.storage import storage_client  # backend de storage activo (S3Boto3Storage/MinIO)

@shared_task
def purge_old_exports():
    cutoff = timezone.now() - timedelta(days=7)
    paginator = storage_client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket="exports"):
        for obj in page.get("Contents", []):
            if obj["LastModified"].replace(tzinfo=None) < cutoff.replace(tzinfo=None):
                storage_client.delete_object(Bucket="exports", Key=obj["Key"])
```

---

## Modelo Job (compartido con import)

> **Estado 2026-08-04:** el modelo `ExportJob` NO existe en el codebase (tampoco `ImportJob` ni el endpoint `GET /api/jobs/{id}/`). Es parte de la especificación async pendiente. Definición canónica de contrato:

```python
class ExportJob(models.Model):
    JOB_STATUS = [("pending","pending"),("running","running"),("done","done"),("error","error")]
    user            = models.ForeignKey("core.User", on_delete=models.PROTECT)
    entity          = models.CharField(max_length=64)  # "billing.invoice"
    format          = models.CharField(max_length=8)   # "pdf" | "xlsx" | "csv"
    filters         = models.JSONField(default=dict)
    status          = models.CharField(max_length=16, choices=JOB_STATUS)
    storage_key     = models.CharField(max_length=256, blank=True)  # bucket/path
    error_message   = models.TextField(blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)
    completed_at    = models.DateTimeField(null=True)
```

Endpoint de polling unificado: `GET /api/jobs/{id}/` (compartido con `ImportJob`, ver [import-csv-xlsx.md](import-csv-xlsx.md)).

---

## Frontend — patrón canónico

```ts
// features/billing/hooks/useExportSalesBook.ts
export function useExportSalesBook() {
  return useMutation({
    mutationFn: async (filters: SalesBookFilters) => {
      const res = await apiGet(`/api/billing/sales-book/export/?format=xlsx`, { params: filters, responseType: "blob" });
      if (res.headers["content-type"]?.includes("application/json")) {
        // async path — server eligió encolar
        const job: ExportJob = JSON.parse(await res.data.text());
        return pollJobUntilDone(job.job_id);  // helper compartido
      }
      // sync path — descargar directo
      saveAs(res.data, deriveFilename(res.headers));
    },
  });
}
```

**Reglas frontend:**
- Hook por export concreto en su feature. **No** un `useExport` genérico.
- `pollJobUntilDone` está en `lib/jobs.ts` (compartido). Polea cada 2s, max 5 min. Cuando `done`, hace fetch del signed URL y dispara descarga.
- Para reportes recurrentes (e.g. libro mensual), el botón en UI se desactiva mientras el job está corriendo, mostrando estado vía `useEventStream` opcional (ver [realtime-channels.md](realtime-channels.md)).

---

## Tests

| Tipo | Cobertura mínima |
|------|------------------|
| Service render PDF | Genera bytes no vacíos; presencia de strings clave en `extractText(pdf)` |
| Service render xlsx | Carga con openpyxl, verifica headers, fila de totales con valor esperado |
| View sync | 200, content-type correcto, content-disposition presente |
| View async | 202 + job_id, job_id corresponde a `ExportJob` con `status=pending` |
| Task | Sube a MinIO, marca `done`, signed URL responde 200 |
| Cleanup cron | Objeto >7d se elimina; <7d sobrevive |

---

## Checklist al implementar un export

- [ ] Decidir formato(s) soportados. Ofrecer al menos uno; ofrecer múltiples solo si hay caso real.
- [ ] Service en `backend/{app}/services/{entity}_export.py` que devuelve `ExportResult(mode, data | job_id)`.
- [ ] Si sync: view devuelve binario con headers correctos.
- [ ] Si async: view encola Celery, devuelve 202; task sube a MinIO + actualiza `ExportJob`.
- [ ] Frontend: hook + botón con feedback de loading + descarga al completar.
- [ ] Tests de service + view + (si async) task.
- [ ] Confirmar TTL de 7 días + signed URL 15 min.

## Referencias

- Playbook paso-a-paso: `add-export-pdf-excel.md` (Tier 2 — Sesión 4)
- Async tasks: [../30-playbooks/add-background-task.md](../30-playbooks/add-background-task.md)
- File upload (input dual): [../30-playbooks/add-file-upload.md](../30-playbooks/add-file-upload.md)
- Import (contraparte): [import-csv-xlsx.md](import-csv-xlsx.md)
