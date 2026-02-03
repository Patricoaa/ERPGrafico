from django.core.management.base import BaseCommand
from sales.draft_cart_service import DraftCartService


class Command(BaseCommand):
    help = 'Elimina borradores de carrito POS más antiguos que X días'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=1,
            help='Número de días de antigüedad para eliminar borradores (por defecto: 1)'
        )
    
    def handle(self, *args, **options):
        days = options['days']
        
        self.stdout.write(
            self.style.WARNING(f'Eliminando borradores de más de {days} día(s)...')
        )
        
        deleted_count = DraftCartService.cleanup_old_drafts(days=days)
        
        if deleted_count > 0:
            self.stdout.write(
                self.style.SUCCESS(f'✓ {deleted_count} borrador(es) eliminado(s) exitosamente')
            )
        else:
            self.stdout.write(
                self.style.SUCCESS('✓ No hay borradores antiguos para eliminar')
            )
