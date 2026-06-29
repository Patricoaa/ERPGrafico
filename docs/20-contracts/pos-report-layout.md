---
layer: 20-contracts
doc: pos-report-layout
status: active
owner: frontend-team
last_review: 2026-06-28
stability: stable
---

# POS Report Layout — X y Z

## Formato térmico (browser print, `POSReport.tsx`)

```
┌──────────────────────────────────────┐
│       80mm  ·  @page margin: 0      │
│                                      │
│  [LOGO]      max-h: 64px            │
│                                      │
│  INFORME DE CIERRE DE CAJA           │  ← text-sm (14px) / font-black / uppercase / tracking-widest
│  o INFORME PARCIAL DE CAJA           │
│                                      │
│  Sesión #123  •  Juan Pérez          │  ← text-[10px] / font-mono / bold / muted-foreground
│  28/06/2026 15:30                    │  ← text-[10px] / font-bold / uppercase / muted-foreground
│ ──────────────────────────────── ── │  ← border-b-2 border-border/50
│                                      │
│  🔢 CONTROL DE EFECTIVO             │  ← text-[10px] / font-black / uppercase / tracking-widest
│  ────────────────────────────────   │  ← border-b border-border
│                                      │
│  FONDO INICIAL:              $5,000  │  ← label: font-bold uppercase / muted-foreground
│  (+) VENTAS EFECTIVO:      +$12,340 │  ← label: font-bold uppercase / muted-foreground
│  (+) OTROS DEPÓSITOS:        +$500  │  ← label: font-bold uppercase / muted-foreground (condicional)
│  (-) RETIROS / GASTOS:      -$1,000 │  ← label: font-bold uppercase / muted-foreground; moneda: text-destructive (condicional)
│  ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈  │  ← border-t border-dashed border-border/30
│  EFECTIVO ESPERADO:          $16,840│  ← label: font-black / text-xs / uppercase; monto: font-black / text-xl / monospace
│                                      │
│ ──────────────────────────────── ── │  ← border-t-2 border-border/50
│                                      │
│  💳 DESGLOSE DE PAGOS              │  ← text-[10px] / font-black / uppercase / tracking-widest
│  ────────────────────────────────   │  ← border-b border-border
│                                      │
│  Efectivo:                    $5,000 │  ← label: font-bold uppercase / muted-foreground
│  Tarjeta:                   $12,000 │  ← label: font-bold uppercase / muted-foreground/80
│  Transferencia:               $3,000 │  ← label: font-bold uppercase / muted-foreground/80
│  Crédito:                     $1,000 │  ← label: font-bold uppercase / muted-foreground/80
│  Cheque:                          0 │  ← label: font-bold uppercase / muted-foreground/80
│  ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈ ┈  │  ← border-t border-dashed border-border/30
│  TOTAL VENTAS:               $21,000│  ← label: font-black / text-xs / uppercase; monto: font-black / text-xl / monospace
│                                      │
│  ┌────────────────────────────────┐  │
│  │ RESULTADO DEL CONTEO           │  │  ← SOLO Z: div con bg-card / border-2
│  │ Esperado:      $16,840         │  │
│  │ Real:          $16,800         │  │
│  │ ───────────────────────────────│  │
│  │ Diferencia:       -$40         │  │  ← font-bold, text-warning si != 0
│  └────────────────────────────────┘  │
│                                      │
│  [Imprimir]          [PDF]          │  ← print:hidden / buttons
└──────────────────────────────────────┘
```

## Formato A4 PDF (WeasyPrint, `pos_report.html`)

```
┌──────────────────────────────────────────────────────────────┐
│     A4 portrait  ·  margin: 1.5cm  ·  font: 10pt Helvetica  │
│                                                              │
│  ┌────────────────────┐  ┌────────────────────────────────┐  │
│  │ [LOGO]             │  │ INFORME DE CIERRE (Z)          │  │  ← h1: 14pt / bold-700 / uppercase / letter-spacing: 1pt
│  │ max-h: 60px        │  │ Razón Social                   │  │  ← p: 9pt / color #52525b
│  └────────────────────┘  └────────────────────────────────┘  │
│  ───────────────────────────────────────────────────────────  │  ← border-bottom: 2px #e4e4e7
│                                                              │
│  Sesión:       #123                                          │  ← label: 9pt / weight-600 / #52525b
│  Cajero:       Juan Pérez                                    │  ← value: 9pt
│  Terminal:     Caja 1                                        │  ← condicional
│  Apertura:     28/06/2026 10:00                              │
│  Cierre:       28/06/2026 15:30                              │  ← condicional (solo Z)
│                                                              │
│  ━━━━ CONTROL DE EFECTIVO ━━━━                              │  ← section-title: 10pt / bold-700 / uppercase
│  ───────────────────────────────────────────────────────────  │  ← border-bottom: 1px #d4d4d8
│                                                              │
│  Fondo Inicial                              $5,000           │  ← td: 9pt / moneda: Courier New 9pt bold
│  (+) Ventas Efectivo                      +$12,340           │  ← monto verde #16a34a
│  (+) Otros Depósitos                         +$500           │  ← condicional, monto verde
│  (-) Retiros / Gastos                      -$1,000           │  ← condicional, monto rojo #dc2626
│  ───────────────────────────────────────────────────────────  │  ← border-top: 2px #18181b (total row)
│  EFECTIVO ESPERADO                         $16,840           │  ← 11pt / bold-700
│                                                              │
│  ━━━━ DESGLOSE DE PAGOS ━━━━                                │
│  ───────────────────────────────────────────────────────────  │
│                                                              │
│  Efectivo                                    $5,000          │
│  Tarjeta                                   $12,000          │
│  Transferencia                               $3,000          │
│  Crédito                                     $1,000          │
│  Cheque                                           0          │
│  ───────────────────────────────────────────────────────────  │
│  TOTAL VENTAS                               $21,000          │  ← 11pt / bold-700
│                                                              │
│  ━━━━ VENTAS POR CATEGORÍA ━━━━                             │  ← condicional
│  ───────────────────────────────────────────────────────────  │
│  Categoría                  Total                             │  ← th: 8pt / bold-700 / uppercase / #52525b
│  Calzado Hombre           $8,000                             │
│  Calzado Mujer            $7,000                             │
│  Accesorios               $6,000                             │
│                                                              │
│  ━━━━ MOVIMIENTOS MANUALES ━━━━                             │  ← condicional
│  ───────────────────────────────────────────────────────────  │
│  Tipo              Monto    Notas                            │
│  Ingreso Extra     $500     Venta de exhibición              │  ← notes: 8pt / #71717a
│  Retiro            $200     Pago a proveedor                 │
│                                                              │
│  ┌───────────────────────────────────────────────────┐       │
│  │ RESULTADO DEL ARQUEO                    Z ONLY    │       │  ← border: 2px #18181b / border-radius: 4pt / padding: 12pt
│  │━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │       │
│  │ Monto Esperado:                    $16,840        │       │
│  │ Monto Contado:                    $16,800        │       │
│  │ ─────────────────────────────────────────────────│       │
│  │ Diferencia:                         -$40         │       │  ← border-top / bold-700
│  └───────────────────────────────────────────────────┘       │
│                                                              │
│  ───────────────────────────────────────────────────────────  │  ← border-top: 1px #e4e4e7
│  Documento generado por ERPGrafico | 28/06/2026 15:30        │  ← footer: 8pt / #a1a1aa / centrado
│  Pág. 1 de 1                                                 │  ← @bottom-right
│  Generado el 28/06/2026 15:30                                │  ← @bottom-left
└──────────────────────────────────────────────────────────────┘
```

## Especificaciones visuales detalladas

### Carpeta térmico (browser print)

| Elemento | Tamaño | Font | Weight | Color | Tracking | Transform |
|----------|--------|------|--------|-------|----------|-----------|
| Logo | max-h: 64px | — | — | — | — | — |
| Título reporte | `text-sm` (14px) | sans | `font-black` (900) | `text-foreground` | `tracking-widest` | uppercase |
| Sesión + usuario | `text-[10px]` | `font-mono` | `font-bold` (700) | `text-muted-foreground` | — | — |
| Fecha generación | `text-[10px]` | sans | `font-bold` (700) | `text-muted-foreground` | — | uppercase |
| Separador header | — | — | — | `border-border/50` | — | `border-b-2` |
| Título sección | `text-[10px]` | sans | `font-black` (900) | `text-foreground` | `tracking-widest` | uppercase |
| Label fila | `text-[11px]` | sans | `font-bold` (700) | `text-muted-foreground` | — | uppercase |
| Monto fila | `text-[11px]` | `font-mono` | `font-bold` (700) | — | — | — |
| Monto total sección | `text-xl` (20px) | `font-mono` | `font-black` (900) | — | `tracking-tighter` | — |
| Monto negativo | igual que monto | — | — | `text-destructive` | — | — |
| Separador filas | — | — | — | `border-border/30` | — | `border-t border-dashed` |
| Separador secciones | — | — | — | `border-border/50` | — | `border-t-2` |
| Borde tarjeta audit | — | — | — | `border-border` | — | `border-2` |
| Espaciado interno | `p-6` (24px) | — | — | — | — | — |
| Ancho máximo | `max-w-[380px]` | — | — | — | — | — |
| **Print** ancho | `print:w-[80mm]` | — | — | — | — | — |
| **Print** @page | `size: 80mm auto; margin: 0` | — | — | — | — | — |

### Carpeta A4 PDF (WeasyPrint)

| Elemento | Tamaño | Font | Weight | Color | Letter-spacing | Transform |
|----------|--------|------|--------|-------|----------------|-----------|
| Body | 10pt | Helvetica/Arial | 400 | `#18181b` | normal | — |
| Logo | max-h: 60px, max-w: 200px | — | — | — | — | — |
| Título header | 14pt | Helvetica/Arial | 700 | `#18181b` | 1pt | uppercase |
| Razón social header | 9pt | Helvetica/Arial | 400 | `#52525b` | normal | — |
| Separador header | — | — | — | `#e4e4e7` | — | border-bottom 2px |
| Labels info-grid | 9pt | Helvetica/Arial | 600 | `#52525b` | normal | — |
| Values info-grid | 9pt | Helvetica/Arial | 400 | `#18181b` | normal | — |
| Section title | 10pt | Helvetica/Arial | 700 | `#18181b` | 0.5pt | uppercase |
| Section title border | — | — | — | `#d4d4d8` | — | border-bottom 1px |
| Table header (th) | 8pt | Helvetica/Arial | 700 | `#52525b` | normal | uppercase |
| Table cell (td) | 9pt | Helvetica/Arial | 400 | `#18181b` | normal | — |
| Table cell amount | 9pt | Courier New | 600 | `#18181b` | normal | — (text-align: right) |
| Amount positive | — | Courier New | 600 | `#16a34a` (green) | — | — |
| Amount negative | — | Courier New | 600 | `#dc2626` (red) | — | — |
| Total row | 11pt | Helvetica/Arial | 700 | `#18181b` | normal | — |
| Total row border | — | — | — | `#18181b` | — | border-top 2px |
| Audit card border | — | — | — | `#18181b` | — | 2px, border-radius 4pt |
| Audit card title | 10pt | Helvetica/Arial | 700 | `#18181b` | normal | uppercase |
| Audit card values | 10pt | Courier New | 600 | `#18181b` | normal | — |
| Notes cell | 8pt | Helvetica/Arial | 400 | `#71717a` | normal | — |
| Footer | 8pt | Helvetica/Arial | 400 | `#a1a1aa` | normal | — |
| @page margin | 1.5cm | — | — | — | — | — |
| @page size | A4 portrait | — | — | — | — | — |
| Página # | 8pt | Helvetica/Arial | 400 | `#71717a` | — | @bottom-right |

## Diferencias Reporte X vs Z

| Elemento | X (Parcial) | Z (Cierre) |
|----------|-------------|------------|
| Título | Informe Parcial de Caja | Informe de Cierre de Caja |
| Cierre en info-grid | ❌ no se muestra | ✅ `closed_at` |
| Tarjeta arqueo (audit) | ❌ no se muestra | ✅ Resultado del Conteo |
| Estado sesión | `session.status == "OPEN"` | `session.status == "CLOSED"` |
| Fondo del overlay (screen) | overlay genérico | muestra también audit card |
| PDF filename | `informe-pos-X-{id}.pdf` | `informe-pos-Z-{id}.pdf` |

## Data sources

| Campo | Origen (backend) | Ruta |
|-------|------------------|------|
| `session_id` | `POSSession.id` | `get_summary()` |
| `user_name` | `POSSession.user.get_full_name()` | `get_summary()` (indirecto, via serializer context) |
| `opening_balance` | `POSSession.opening_balance` | `get_summary()` |
| `total_cash_sales` | `POSSession.total_cash_sales` | `_update_pos_session()` |
| `total_card_sales` | `POSSession.total_card_sales` | `_update_pos_session()` |
| `total_transfer_sales` | `POSSession.total_transfer_sales` | `_update_pos_session()` |
| `total_credit_sales` | `POSSession.total_credit_sales` | `_update_pos_session()` |
| `total_check_sales` | `POSSession.total_check_sales` | `_update_pos_session()` |
| `total_other_cash_inflow` | `POSSession.total_other_cash_inflow` | `_update_pos_session()` |
| `total_other_cash_outflow` | `POSSession.total_other_cash_outflow` | `_update_pos_session()` |
| `expected_cash` | propiedad `POSSession.expected_cash` | calculado: `opening + cash_sales + inflow - outflow` |
| `sales_by_category` | agregación de líneas de invoice | `get_summary()` |
| `manual_movements` | filtra movements sin invoice/sale_order/purchase_order | `get_summary()` |
| audit (Z) | `POSSessionAudit` (OneToOne) | controller de frontend pasa `lastAudit` |
