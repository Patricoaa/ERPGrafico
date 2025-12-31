from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Account, JournalEntry, AccountingSettings
from .serializers import AccountSerializer, JournalEntrySerializer, AccountingSettingsSerializer
from .services import JournalEntryService
from django.core.exceptions import ValidationError

class AccountingSettingsViewSet(viewsets.ModelViewSet):
    queryset = AccountingSettings.objects.all()
    serializer_class = AccountingSettingsSerializer

    @action(detail=False, methods=['get', 'put', 'patch'])
    def current(self, request):
        obj = AccountingSettings.objects.first()
        if not obj:
            if request.method == 'GET':
                 return Response({"detail": "Settings not found"}, status=status.HTTP_404_NOT_FOUND)
            obj = AccountingSettings.objects.create()
        
        if request.method == 'GET':
            serializer = self.get_serializer(obj)
            return Response(serializer.data)
        
        serializer = self.get_serializer(obj, data=request.data, partial=(request.method == 'PATCH'))
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

class AccountViewSet(viewsets.ModelViewSet):
    queryset = Account.objects.all()
    serializer_class = AccountSerializer

    def create(self, request, *args, **kwargs):
        print("DEBUG: ACCOUNT CREATE CALLED")
        print("Data:", request.data)
        try:
            return super().create(request, *args, **kwargs)
        except Exception as e:
            print(f"DEBUG: ACCOUNT CREATE ERROR: {e}")
            import traceback
            traceback.print_exc()
            raise e
    
    def destroy(self, request, *args, **kwargs):
        account = self.get_object()
        # Check if account has journal items
        if account.journal_items.filter(entry__state='POSTED').exists():
            return Response(
                {"error": "No se puede eliminar una cuenta con movimientos contables asociados."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)
    
    @action(detail=True, methods=['get'])
    def ledger(self, request, pk=None):
        """
        Returns the ledger (libro mayor) for a specific account.
        Shows all posted journal items with running balance.
        """
        account = self.get_object()
        items = account.journal_items.filter(entry__state='POSTED').select_related('entry').order_by('entry__date', 'entry__id')
        
        balance = 0
        ledger_data = []
        
        for item in items:
            balance += (item.debit - item.credit)
            ledger_data.append({
                'id': item.id,
                'date': item.entry.date,
                'entry_id': item.entry.id,
                'reference': item.entry.reference,
                'description': item.entry.description,
                'debit': float(item.debit),
                'credit': float(item.credit),
                'balance': float(balance),
                'partner': item.partner or '',
                'label': item.label or '',
                'source_document': item.entry.get_source_document
            })
        
        return Response({
            'account': AccountSerializer(account).data,
            'movements': ledger_data
        })

class JournalEntryViewSet(viewsets.ModelViewSet):
    queryset = JournalEntry.objects.all()
    serializer_class = JournalEntrySerializer
    
    @action(detail=True, methods=['post'])
    def post_entry(self, request, pk=None):
        entry = self.get_object()
        try:
            JournalEntryService.post_entry(entry)
            return Response({'status': 'posted'})
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            
    def create(self, request, *args, **kwargs):
        print("DEBUG: CUSTOM CREATE CALLED")
        data = request.data.copy()
        items_data = data.pop('items', [])
        
        try:
            entry = JournalEntryService.create_entry(data, items_data)
            serializer = self.get_serializer(entry)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        # For simplicity, we might re-create items on update or implement a specific update service
        # This is a basic implementation that wipes items and re-creates them
        instance = self.get_object()
        data = request.data.copy()
        items_data = data.pop('items', None)
        
        try:
            # Standard update for Entry fields
            serializer = self.get_serializer(instance, data=data, partial=kwargs.get('partial', False))
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
            
            if items_data is not None:
                # Replace items
                instance.items.all().delete()
                for item in items_data:
                    # Ensure account ID is passed correctly, might need adjustment depending on frontend payload
                    # Frontend usually sends 'account' as ID.
                    from .models import JournalItem
                    JournalItem.objects.create(entry=instance, **item)
            
            return Response(serializer.data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
