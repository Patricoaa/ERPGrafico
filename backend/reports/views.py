from django.http import HttpResponse
from django.db.models import Sum
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from accounting.models import Account, AccountType, JournalItem
from datetime import date
from io import BytesIO

class PDFReport:
    def __init__(self, title):
        self.buffer = BytesIO()
        self.p = canvas.Canvas(self.buffer, pagesize=letter)
        self.title = title
        self.width, self.height = letter
        self.y = self.height - 50

    def header(self):
        self.p.setFont("Helvetica-Bold", 16)
        self.p.drawString(50, self.y, self.title)
        self.y -= 30
        self.p.setFont("Helvetica", 10)
        self.p.drawString(50, self.y, f"Generado el: {date.today().strftime('%d/%m/%Y')}")
        self.y -= 40

    def add_line(self, text, value, is_bold=False):
        if self.y < 50:
            self.p.showPage()
            self.y = self.height - 50
        
        if is_bold:
            self.p.setFont("Helvetica-Bold", 12)
        else:
            self.p.setFont("Helvetica", 10)

        self.p.drawString(50, self.y, text)
        self.p.drawRightString(self.width - 50, self.y, f"${value:,.0f}")
        self.y -= 20

    def add_section_title(self, text):
        self.y -= 10
        self.p.setFont("Helvetica-Bold", 14)
        self.p.drawString(50, self.y, text)
        self.y -= 25

    def generate(self):
        self.p.save()
        self.buffer.seek(0)
        return self.buffer

def balance_sheet_view(request):
    report = PDFReport("Balance General")
    report.header()

    assets = Account.objects.filter(account_type=AccountType.ASSET)
    liabilities = Account.objects.filter(account_type=AccountType.LIABILITY)
    equity = Account.objects.filter(account_type=AccountType.EQUITY)

    total_assets = 0
    total_liabilities = 0
    total_equity = 0

    report.add_section_title("ACTIVOS")
    for acc in assets:
        balance = JournalItem.objects.filter(account=acc).aggregate(
            balance=Sum('debit') - Sum('credit')
        )['balance'] or 0
        if balance != 0:
            report.add_line(f"{acc.code} {acc.name}", balance)
            total_assets += balance
    report.add_line("TOTAL ACTIVOS", total_assets, is_bold=True)

    report.add_section_title("PASIVOS")
    for acc in liabilities:
        balance = JournalItem.objects.filter(account=acc).aggregate(
            balance=Sum('credit') - Sum('debit')
        )['balance'] or 0
        if balance != 0:
            report.add_line(f"{acc.code} {acc.name}", balance)
            total_liabilities += balance
    report.add_line("TOTAL PASIVOS", total_liabilities, is_bold=True)

    report.add_section_title("PATRIMONIO")
    for acc in equity:
        balance = JournalItem.objects.filter(account=acc).aggregate(
            balance=Sum('credit') - Sum('debit')
        )['balance'] or 0
        if balance != 0:
            report.add_line(f"{acc.code} {acc.name}", balance)
            total_equity += balance
    report.add_line("TOTAL PATRIMONIO", total_equity, is_bold=True)

    # Verification Line
    report.y -= 20
    diff = total_assets - (total_liabilities + total_equity)
    report.add_line("Comprobación (A - P - Pat)", diff, is_bold=True)

    pdf = report.generate()
    response = HttpResponse(pdf, content_type='application/pdf')
    response['Content-Disposition'] = 'attachment; filename="balance_general.pdf"'
    return response

def income_statement_view(request):
    report = PDFReport("Estado de Resultados")
    report.header()

    income = Account.objects.filter(account_type=AccountType.INCOME)
    expenses = Account.objects.filter(account_type=AccountType.EXPENSE)

    total_income = 0
    total_expenses = 0

    report.add_section_title("INGRESOS")
    for acc in income:
        # Income is Credit normal
        balance = JournalItem.objects.filter(account=acc).aggregate(
            balance=Sum('credit') - Sum('debit')
        )['balance'] or 0
        if balance != 0:
            report.add_line(f"{acc.code} {acc.name}", balance)
            total_income += balance
    report.add_line("TOTAL INGRESOS", total_income, is_bold=True)

    report.add_section_title("GASTOS")
    for acc in expenses:
        # Expense is Debit normal
        balance = JournalItem.objects.filter(account=acc).aggregate(
            balance=Sum('debit') - Sum('credit')
        )['balance'] or 0
        if balance != 0:
            report.add_line(f"{acc.code} {acc.name}", balance)
            total_expenses += balance
    report.add_line("TOTAL GASTOS", total_expenses, is_bold=True)

    report.y -= 20
    net_income = total_income - total_expenses
    report.add_line("UTILIDAD (PÉRDIDA) OPE", net_income, is_bold=True)

    pdf = report.generate()
    response = HttpResponse(pdf, content_type='application/pdf')
    response['Content-Disposition'] = 'attachment; filename="estado_resultados.pdf"'
    return response
