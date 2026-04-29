"""
Payroll PDF generation. Returns a BytesIO ready for HTTP response.
"""
from io import BytesIO


def generate_payroll_pdf(payroll) -> BytesIO:
    try:
        from reportlab.lib import colors
        from reportlab.lib.enums import TA_CENTER, TA_RIGHT
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import cm
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    except ImportError:
        raise ImportError("ReportLab no está instalado. Ejecute: pip install reportlab")

    from .models import PayrollConcept, PayrollPayment

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "Title", parent=styles["Heading1"], fontSize=16, alignment=TA_CENTER, spaceAfter=6
    )
    subtitle_style = ParagraphStyle(
        "Subtitle",
        parent=styles["Normal"],
        fontSize=8,
        alignment=TA_CENTER,
        textColor=colors.grey,
        spaceAfter=12,
    )
    section_style = ParagraphStyle(
        "Section",
        parent=styles["Heading3"],
        fontSize=9,
        textColor=colors.HexColor("#374151"),
        spaceBefore=14,
        spaceAfter=6,
        borderPadding=(0, 0, 2, 0),
    )
    normal = ParagraphStyle("Normal2", parent=styles["Normal"], fontSize=9)
    small = ParagraphStyle("Small", parent=styles["Normal"], fontSize=7, textColor=colors.grey)

    elements = []

    # Header
    elements.append(Paragraph("LIQUIDACIÓN DE SUELDO", title_style))
    elements.append(Paragraph("Documento de Pago de Remuneraciones", subtitle_style))

    # Employee info
    emp = payroll.employee
    contact = emp.contact
    employee_info = [
        ["Empleado", contact.name, "Período", payroll.period_label],
        ["RUT", contact.tax_id or "-", "Folio", payroll.display_id],
        ["Cargo", emp.position or "-", "Departamento", emp.department or "-"],
        ["Fecha Ingreso", str(emp.start_date or "-"), "Tipo Contrato", emp.get_contract_type_display()],
    ]
    info_table = Table(employee_info, colWidths=[80, 170, 80, 170])
    info_table.setStyle(
        TableStyle(
            [
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
                ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#6B7280")),
                ("TEXTCOLOR", (2, 0), (2, -1), colors.HexColor("#6B7280")),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F9FAFB")),
                ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F9FAFB")),
            ]
        )
    )
    elements.append(info_table)

    # Days stats
    elements.append(Spacer(1, 8))
    days_data = [
        [
            "Días Pactados", str(payroll.agreed_days),
            "Ausencias", str(payroll.absent_days),
            "Días Trabajados", str(payroll.worked_days),
            "Sueldo Base", f"${payroll.base_salary:,.0f}",
        ]
    ]
    days_table = Table(days_data, colWidths=[70, 50, 55, 50, 75, 55, 65, 80])
    days_table.setStyle(
        TableStyle(
            [
                ("FONTSIZE", (0, 0), (-1, -1), 7),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("ALIGNMENT", (1, 0), (1, 0), "CENTER"),
                ("ALIGNMENT", (3, 0), (3, 0), "CENTER"),
                ("ALIGNMENT", (5, 0), (5, 0), "CENTER"),
                ("ALIGNMENT", (7, 0), (7, 0), "RIGHT"),
                ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#6B7280")),
                ("TEXTCOLOR", (2, 0), (2, -1), colors.HexColor("#6B7280")),
                ("TEXTCOLOR", (4, 0), (4, -1), colors.HexColor("#6B7280")),
                ("TEXTCOLOR", (6, 0), (6, -1), colors.HexColor("#6B7280")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F9FAFB")),
            ]
        )
    )
    elements.append(days_table)

    # Items table
    items = payroll.items.select_related("concept").exclude(
        concept__category=PayrollConcept.Category.DESCUENTO_LEGAL_EMPLEADOR
    ).all()
    haberes = [i for i in items if i.concept.category in ["HABER_IMPONIBLE", "HABER_NO_IMPONIBLE"]]
    descuentos = [i for i in items if i.concept.category in ["DESCUENTO_LEGAL_TRABAJADOR", "OTRO_DESCUENTO"]]

    elements.append(Paragraph("Detalle de Conceptos", section_style))

    items_header = [["Concepto", "Haberes (+)", "Descuentos (-)"]]
    items_rows = []
    for h in haberes:
        items_rows.append([h.concept.name, f"${h.amount:,.0f}", ""])
    items_rows.append(["Subtotal Haberes", f"${payroll.total_haberes:,.0f}", ""])
    for d in descuentos:
        items_rows.append([d.concept.name, "", f"${d.amount:,.0f}"])
    desc_total = sum(d.amount for d in descuentos)
    items_rows.append(["Subtotal Descuentos", "", f"${desc_total:,.0f}"])

    all_rows = items_header + items_rows
    items_table = Table(all_rows, colWidths=[250, 125, 125])
    table_style_commands = [
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F3F4F6")),
        ("TEXTCOLOR", (1, 0), (1, 0), colors.HexColor("#059669")),
        ("TEXTCOLOR", (2, 0), (2, 0), colors.HexColor("#DC2626")),
        ("ALIGNMENT", (1, 0), (-1, -1), "RIGHT"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
    ]
    subtotal_haberes_idx = len(haberes) + 1
    subtotal_desc_idx = subtotal_haberes_idx + len(descuentos) + 1
    for idx in [subtotal_haberes_idx, subtotal_desc_idx]:
        if idx < len(all_rows):
            table_style_commands += [
                ("FONTNAME", (0, idx), (-1, idx), "Helvetica-Bold"),
                ("BACKGROUND", (0, idx), (-1, idx), colors.HexColor("#F9FAFB")),
            ]
    for i in range(1, len(haberes) + 1):
        table_style_commands.append(("TEXTCOLOR", (1, i), (1, i), colors.HexColor("#059669")))
    for i in range(subtotal_haberes_idx + 1, subtotal_desc_idx):
        table_style_commands.append(("TEXTCOLOR", (2, i), (2, i), colors.HexColor("#DC2626")))
    items_table.setStyle(TableStyle(table_style_commands))
    elements.append(items_table)

    # Payment history
    unified_payments = []
    for adv in payroll.advances.all():
        method_name = "Efectivo"
        if adv.journal_entry:
            try:
                movement = adv.journal_entry.treasury_movement
                method_name = (
                    movement.payment_method_new.name
                    if movement.payment_method_new
                    else movement.get_payment_method_display()
                )
            except Exception:
                pass
        unified_payments.append(
            {"date": str(adv.date), "type": "Anticipo", "amount": adv.amount, "method": method_name, "is_advance": True}
        )

    for pay in PayrollPayment.objects.filter(payroll=payroll, payment_type=PayrollPayment.PaymentType.SALARIO):
        unified_payments.append(
            {"date": str(pay.date), "type": "Pago Sueldo", "amount": pay.amount, "method": pay.notes or "Transferencia", "is_advance": False}
        )

    unified_payments.sort(key=lambda x: x["date"])
    total_paid = sum(p["amount"] for p in unified_payments)
    pending_to_pay = payroll.net_salary - total_paid

    if unified_payments:
        elements.append(Paragraph("Historial de Pagos", section_style))
        pay_rows = [["Fecha", "Tipo", "Método", "Monto"]]
        for p in unified_payments:
            pay_rows.append(
                [p["date"], p["type"], p["method"].split(" - ")[0].split(" (")[0], f"${p['amount']:,.0f}"]
            )
        pay_rows.append(["Total Pagado", "", "", f"${total_paid:,.0f}"])

        pay_table = Table(pay_rows, colWidths=[80, 100, 220, 100])
        pay_style = [
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ("ALIGNMENT", (3, 0), (3, -1), "RIGHT"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F9FAFB")),
            ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#F9FAFB")),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
        ]
        for i in range(1, len(unified_payments) + 1):
            color = "#B45309" if unified_payments[i - 1]["is_advance"] else "#047857"
            pay_style.append(("TEXTCOLOR", (1, i), (1, i), colors.HexColor(color)))
        pay_table.setStyle(TableStyle(pay_style))
        elements.append(pay_table)

    # Pending balance
    if pending_to_pay > 0 and payroll.status == "POSTED":
        elements.append(Spacer(1, 4))
        pending_table = Table(
            [["SALDO PENDIENTE DE PAGO", f"${pending_to_pay:,.0f}"]], colWidths=[400, 100]
        )
        pending_table.setStyle(
            TableStyle(
                [
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
                    ("ALIGNMENT", (1, 0), (1, 0), "RIGHT"),
                    ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#B45309")),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        elements.append(pending_table)

    # Notes
    if payroll.notes:
        elements.append(Spacer(1, 10))
        elements.append(Paragraph("Observaciones", section_style))
        elements.append(Paragraph(f'<i>"{payroll.notes}"</i>', normal))

    # Net salary card
    elements.append(Spacer(1, 16))
    net_table = Table([["LÍQUIDO A PERCIBIR", f"${payroll.net_salary:,.0f}"]], colWidths=[350, 150])
    net_table.setStyle(
        TableStyle(
            [
                ("FONTSIZE", (0, 0), (-1, -1), 12),
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
                ("ALIGNMENT", (1, 0), (1, 0), "RIGHT"),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#2563EB")),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.white),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("LEFTPADDING", (0, 0), (0, -1), 12),
                ("RIGHTPADDING", (1, 0), (1, -1), 12),
            ]
        )
    )
    elements.append(net_table)

    # Signatures
    elements.append(Spacer(1, 60))
    sig_table = Table(
        [["_" * 40, "_" * 40], ["Firma del Empleador", "Firma del Trabajador"]],
        colWidths=[250, 250],
    )
    sig_table.setStyle(
        TableStyle(
            [
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("ALIGNMENT", (0, 0), (-1, -1), "CENTER"),
                ("TEXTCOLOR", (0, 1), (-1, 1), colors.grey),
                ("TOPPADDING", (0, 1), (-1, 1), 4),
            ]
        )
    )
    elements.append(sig_table)

    # Footer
    elements.append(Spacer(1, 20))
    elements.append(
        Paragraph(
            "Este documento sirve como comprobante de pago de remuneraciones según lo estipulado en el Código del Trabajo.",
            ParagraphStyle("Footer", parent=small, alignment=TA_CENTER),
        )
    )

    doc.build(elements)
    buffer.seek(0)
    return buffer
