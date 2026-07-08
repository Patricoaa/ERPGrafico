---
layer: 30-playbooks
doc: add-export-pdf-excel
task: add a downloadable export (PDF / Excel / CSV)
triggers: [export, pdf, excel, xlsx, csv, weasyprint, openpyxl, libro de ventas, reporte descargable]
preconditions: [export-formats, add-endpoint, add-background-task]
validation: [pytest backend/{app}/tests, manual download verification]
forbidden: [pdfkit/wkhtmltopdf, xlwt, xls (sin x), pandas.to_excel para reportes formateados]
status: active
owner: backend-team
last_review: 2026-05-21
---

# Add an export (PDF / Excel / CSV)

Receta para agregar un export descargable. Contrato canónico en [export-formats.md](../20-contracts/export-formats.md) — léelo primero.

## When to use

- Un listado / reporte / documento que el usuario necesita descargar (factura PDF, libro mensual xlsx, dump CSV).

**Antipatrón:** generar el archivo en frontend (jsPDF, SheetJS). El backend es el autoritativo — un libro de ventas firmado en cliente es no-auditable y se desfasa del estado real.

## Step 0 — Decidir formato(s) y modo

| Decisión | Cómo elegir |
|----------|-------------|
| Formato | PDF si hay branding/layout fijo (factura, OT). xlsx si el usuario lo va a editar (reportes, dumps formateados). CSV si es input para otra herramienta o dump simple. Múltiples permitido si el caso lo justifica |
| Sync vs Async | Estimación gruesa: PDF de 1 documento → sync. Reporte de 1000+ filas o cualquier xlsx con cálculos pesados → async |

Threshold canónico: **<5 MB AND <2s → sync**. Cualquier otra cosa → async.

---

## A. Sync (documento singular o reporte chico)

### Step 1 — Service de render

`backend/{app}/services/{entity}_export.py`:

```python
from dataclasses import dataclass
from weasyprint import HTML
from django.template.loader import render_to_string
from django.conf import settings

@dataclass
class ExportResult:
    mode: str          # "sync" | "async"
    payload: bytes | None = None
    job_id: str | None = None
    filename: str | None = None
    content_type: str | None = None

def render_invoice_pdf(invoice) -> ExportResult:
    html = render_to_string("exports/invoice.html", {"invoice": invoice})
    pdf_bytes = HTML(string=html, base_url=settings.SITE_URL).write_pdf()
    return ExportResult(
        mode="sync",
        payload=pdf_bytes,
        filename=f"factura-{invoice.folio}.pdf",
        content_type="application/pdf",
    )
```

### Step 2 — Template

`backend/{app}/templates/exports/{entity}.html`:

```html
{% load static %}
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { size: letter; margin: 1.5cm; }
    body { font-family: sans-serif; font-size: 11pt; }
    .header { display: flex; justify-content: space-between; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; }
    .total { font-weight: bold; }
  </style>
</head>
<body>
  <header class="header">
    <img src="{% static 'branding/logo.png' %}" alt="" width="120">
    <div>
      <strong>Factura {{ invoice.folio }}</strong><br>
      Fecha: {{ invoice.date|date:"d-m-Y" }}
    </div>
  </header>
  <h2>{{ invoice.customer.name }}</h2>
  <table>
    <thead>
      <tr><th>Detalle</th><th>Cant.</th><th>Precio</th><th>Total</th></tr>
    </thead>
    <tbody>
      {% for line in invoice.lines.all %}
        <tr>
          <td>{{ line.description }}</td>
          <td>{{ line.quantity }}</td>
          <td>{{ line.unit_price|floatformat:0 }}</td>
          <td>{{ line.total|floatformat:0 }}</td>
        </tr>
      {% endfor %}
    </tbody>
    <tfoot>
      <tr class="total"><td colspan="3">Total</td><td>{{ invoice.total|floatformat:0 }}</td></tr>
    </tfoot>
  </table>
</body>
</html>
```

### Step 3 — View

```python
# backend/{app}/views.py
from django.http import HttpResponse
from rest_framework.decorators import action
from rest_framework.viewsets import ModelViewSet
from .services.invoice_export import render_invoice_pdf

class InvoiceViewSet(ModelViewSet):
    # ... resto

    @action(detail=True, methods=["get"], url_path="document")
    def document(self, request, pk=None):
        invoice = self.get_object()
        result = render_invoice_pdf(invoice)
        resp = HttpResponse(result.payload, content_type=result.content_type)
        resp["Content-Disposition"] = f'attachment; filename="{result.filename}"'
        return resp
```

### Step 4 — Hook frontend

```ts
// frontend/features/billing/hooks/useDownloadInvoice.ts
import { saveAs } from "file-saver";

export function useDownloadInvoice() {
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await apiGet(`/api/billing/invoices/${invoiceId}/document/`, {
        responseType: "blob",
      });
      const filename = parseFilenameFromDisposition(res.headers["content-disposition"]) ?? "factura.pdf";
      saveAs(res.data, filename);
    },
  });
}
```

---

## B. Async (reporte grande)

### Step 1 — Modelo BackgroundJob (compartido)

El modelo `BackgroundJob` ya existe en `backend/core/models/jobs.py` (compartido entre exports e imports). No necesitas crear uno nuevo.

```python
# El modelo ya tiene los campos: user, job_type, status, title, progress_percent, result_file_url, error_message, completed_at
```

### Step 2 — Service que genera el xlsx

```python
# backend/billing/services/sales_book_export.py
from openpyxl import Workbook
from core.excel import header_style, money_style, auto_width

def build_sales_book(period_start, period_end) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = f"Ventas {period_start:%Y-%m}"
    ws.append([f"Libro de Ventas — {period_start:%d-%m-%Y} a {period_end:%d-%m-%Y}"])
    ws.append([])
    ws.append(["Folio", "Cliente", "Fecha", "Neto", "IVA", "Total"])
    header_style(ws[3])

    for inv in invoices_in_period(period_start, period_end):
        ws.append([inv.folio, inv.customer.name, inv.date, inv.net, inv.tax, inv.total])
        for col in (4, 5, 6):
            money_style(ws.cell(row=ws.max_row, column=col))

    auto_width(ws)
    from io import BytesIO
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()
```

### Step 3 — Celery task

```python
# backend/billing/tasks.py
from celery import shared_task
from core.models.jobs import BackgroundJob
from core.storage import upload_to_exports_bucket
from core.tasks import start_job, finish_job_success, finish_job_error
from .services.sales_book_export import build_sales_book

@shared_task(bind=True, max_retries=2)
def export_sales_book_task(self, job_id: int, period_start: str, period_end: str):
    start_job(job_id)
    try:
        blob = build_sales_book(period_start, period_end)
        key = upload_to_exports_bucket(
            job_id=job_id,
            ext="xlsx",
            blob=blob,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        # El bucket manager podría retornar la URL directa, o tú armarla.
        file_url = f"/storage/{key}"
        finish_job_success(job_id, file_url=file_url)
    except Exception as e:
        finish_job_error(job_id, str(e))
        raise
```

### Step 4 — View que encola

```python
class SalesBookExportView(APIView):
    permission_classes = [IsAuthenticated, CanExportSalesBook]

    def get(self, request):
        period_start = request.query_params["period_start"]
        period_end = request.query_params["period_end"]
        job = BackgroundJob.objects.create(
            user=request.user,
            job_type="EXPORT",
            title=f"Libro de Ventas {period_start}",
        )
        export_sales_book_task.delay(job.id, period_start, period_end)
        return Response({"job_id": job.id, "status": "PENDING"}, status=202)
```

### Step 5 — Endpoint `/api/core/jobs/` (compartido)

El API de jobs ya existe en `/api/core/jobs/`. Devuelve la lista y detalle de los jobs del usuario autenticado. No tienes que programar este endpoint.

### Step 6 — Hook frontend con polling

```ts
// frontend/features/billing/hooks/useExportSalesBook.ts
import { pollJobUntilDone } from "@/lib/jobs";

export function useExportSalesBook() {
  return useMutation({
    mutationFn: async (filters: SalesBookFilters) => {
      const enqueue = await apiGet("/api/billing/sales-book/export/", { params: filters });
      const final = await pollJobUntilDone(enqueue.data.job_id);  // helper compartido
      const blob = await apiGet(final.download_url, { responseType: "blob" });
      saveAs(blob.data, `libro-ventas-${filters.period_start}.xlsx`);
    },
  });
}
```

### Step 7 — Cleanup cron (1 sola vez, no por export)

`backend/core/tasks.py`:

```python
@shared_task
def purge_old_exports():
    from datetime import timedelta
    cutoff = timezone.now() - timedelta(days=7)
    for job in ExportJob.objects.filter(created_at__lt=cutoff, storage_key__gt=""):
        delete_from_storage(job.storage_key)
        job.storage_key = ""
        job.save(update_fields=["storage_key"])
```

Registrar en Celery beat schedule, runs diario.

---

## Validation

```bash
# Backend
pytest backend/billing/tests/test_services.py::test_invoice_pdf_render
pytest backend/billing/tests/test_views.py::test_export_sales_book_async

# Smoke manual
# 1. Logueado, click "Descargar PDF" en una factura → archivo .pdf cae y abre
# 2. Click "Exportar libro de ventas" → barra de progreso → descarga .xlsx → abrir en Excel/LibreOffice
```

## Common pitfalls

- **WeasyPrint sin `base_url`** → imágenes y CSS relativos no resuelven. Pasar `settings.SITE_URL`.
- **Fuentes web sin `@font-face`** → fallback a Times. Embeber la fuente o usar `font-family: sans-serif`.
- **`Content-Disposition` sin filename** → el browser usa el último segmento de la URL como filename (e.g. `document.pdf` literal). Siempre setearlo.
- **CSV con `,` y tildes** → Excel-es lo abre roto. Usar `;` + `utf-8-sig` (BOM).
- **xlsx grande generado sync** → timeout del worker Django. Si dudás, encolá.
- **Signed URL >15 min** → contradice [security.md](../40-quality/security.md). 15 min es el max.
- **Olvidar `purge_old_exports`** → MinIO crece sin techo. Cron diario obligatorio.

## Definition of done

- [ ] Service en `backend/{app}/services/` que devuelve bytes (sync) o sube a storage (async).
- [ ] Template HTML (PDF) o helper openpyxl (Excel) en su lugar canónico.
- [ ] View con `Content-Disposition` correcto (sync) o que encola + devuelve 202 (async).
- [ ] Hook frontend en `features/{feature}/hooks/`.
- [ ] Tests de service (genera bytes, contenido esperado parseable) + view (status code + headers).
- [ ] Si async: `ExportJob` creado, signed URL TTL=15min, cleanup cron registrado.
- [ ] Descarga manual probada en navegador real (no solo curl).

## Referencias

- Contrato: [export-formats.md](../20-contracts/export-formats.md)
- Async tasks: [add-background-task.md](add-background-task.md)
- Storage MinIO: [add-file-upload.md](add-file-upload.md)
- Import (simétrico): [add-bulk-import.md](add-bulk-import.md)
