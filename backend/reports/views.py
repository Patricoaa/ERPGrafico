from django.http import HttpResponse, JsonResponse
from django.db.models import Sum
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from accounting.models import Account, AccountType, JournalItem
from datetime import date
from io import BytesIO
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .services import ReportService

# --- PDF Generation Classes (Legacy/Download) ---
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

# --- Original PDF Views ---

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


# --- New API Views (JSON) ---

@api_view(['GET'])
def get_balance_sheet_data(request):
    """
    Returns the Balance Sheet data as JSON.
    Query Params: end_date (YYYY-MM-DD), start_date (YYYY-MM-DD)
    """
    end_date = request.query_params.get('end_date', date.today())
    # Allow legacy 'date' param too
    if request.query_params.get('date'):
        end_date = request.query_params.get('date')
        
    start_date = request.query_params.get('start_date') # can be None
    
    comp_end = request.query_params.get('comp_end_date')
    comp_start = request.query_params.get('comp_start_date')
    
    if comp_end:
        from datetime import datetime
        comp_end = datetime.strptime(comp_end, '%yyyy-%mm-%dd').date() if isinstance(comp_end, str) else comp_end
        if comp_start:
            comp_start = datetime.strptime(comp_start, '%yyyy-%mm-%dd').date() if isinstance(comp_start, str) else comp_start

    # Handle string dates from query_params if necessary (ReportService might expect date objects or strings depending on internal usage)
    # Actually ReportService logic uses .replace so it expects date objects or we should convert them here.
    
    def to_date(d):
        if not d: return None
        if isinstance(d, date): return d
        from datetime import datetime
        try:
            return datetime.strptime(d, '%Y-%m-%d').date()
        except:
            return None

    end_date_obj = to_date(end_date)
    start_date_obj = to_date(start_date)
    comp_end_obj = to_date(comp_end)
    comp_start_obj = to_date(comp_start)

    data = ReportService.get_balance_sheet(end_date_obj, start_date_obj, comp_end_obj, comp_start_obj)
    return Response(data)

@api_view(['GET'])
def get_income_statement_data(request):
    """
    Returns the Income Statement data as JSON.
    Query Params: start_date, end_date (YYYY-MM-DD)
    """
    end_date = request.query_params.get('end_date', date.today())
    default_start = date(date.today().year, 1, 1)
    start_date = request.query_params.get('start_date', default_start)
    
    comp_end = request.query_params.get('comp_end_date')
    comp_start = request.query_params.get('comp_start_date')

    def to_date(d):
        if not d: return None
        if isinstance(d, date): return d
        from datetime import datetime
        try:
            return datetime.strptime(d, '%Y-%m-%d').date()
        except:
            return None

    data = ReportService.get_income_statement(
        to_date(start_date), 
        to_date(end_date), 
        to_date(comp_start), 
        to_date(comp_end)
    )
    return Response(data)

@api_view(['GET'])
def get_cash_flow_data(request):
    """
    Returns the Cash Flow data as JSON.
    Query Params: start_date, end_date (YYYY-MM-DD)
    """
    end_date = request.query_params.get('end_date', date.today())
    default_start = date(date.today().year, 1, 1)
    start_date = request.query_params.get('start_date', default_start)
    
    data = ReportService.get_cash_flow(start_date, end_date)
    return Response(data)

@api_view(['GET'])
def get_financial_analysis_data(request):
    """
    Returns key financial ratios and structure for dashboards.
    """
    end_date = request.query_params.get('end_date', date.today())
    if request.query_params.get('date'):
         end_date = request.query_params.get('date')
    
    start_date = request.query_params.get('start_date')

    # We reuse basic reports logic to get totals
    bs = ReportService.get_balance_sheet(end_date, start_date)
    
    total_assets = bs['total_assets']
    total_liabilities = bs['total_liabilities']
    total_equity = bs['total_equity']
    
    # Calculate Ratios
    # 1. Financing Structure
    # Debt Ratio = Liabilities / Assets
    debt_ratio = (total_liabilities / total_assets) if total_assets else 0
    # Equity Ratio = Equity / Assets
    equity_ratio = (total_equity / total_assets) if total_assets else 0
    # Debt to Equity = Liabilities / Equity
    debt_to_equity = (total_liabilities / total_equity) if total_equity else 0
    
    # Liquidity (Current Ratio) = Current Assets / Current Liabilities
    # We need to filter for Current (usually 1.1 and 2.1 in our simple tree check)
    current_assets = sum(n['balance'] for n in bs['assets'] if n['code'].startswith('1.1'))
    current_liabilities = sum(n['balance'] for n in bs['liabilities'] if n['code'].startswith('2.1'))
    
    current_ratio = (current_assets / current_liabilities) if current_liabilities else 0
    
    # Solvency (Solvency Ratio) = Total Assets / Total Liabilities (Inverse of Debt Ratio somewhat, or (NI + Dep) / Liab)
    # Let's use simple Assets / Liabilities
    solvency_ratio = (total_assets / total_liabilities) if total_liabilities else 0

    return Response({
        'structure': {
            'total_assets': total_assets,
            'total_liabilities': total_liabilities,
            'total_equity': total_equity,
            'debt_ratio': debt_ratio,
            'equity_ratio': equity_ratio,
            'debt_to_equity': debt_to_equity
        },
        'liquidity': {
            'current_assets': current_assets,
            'current_liabilities': current_liabilities,
            'current_ratio': current_ratio
        },
        'solvency': {
            'solvency_ratio': solvency_ratio
        }
    })
