"""
Management command para configurar la API Key de TUU en un PaymentTerminalProvider.

La clave se cifra con Fernet antes de persistir (ver ADR 002 §D4).

Uso:
    python manage.py set_tuu_api_key --provider-id 1 --api-key <KEY>
    python manage.py set_tuu_api_key --provider-id 1  # pide la clave de forma interactiva
"""
import getpass

from django.core.management.base import BaseCommand, CommandError

from treasury.models import PaymentTerminalProvider


class Command(BaseCommand):
    help = "Cifra y persiste la API Key de TUU en un PaymentTerminalProvider."

    def add_arguments(self, parser):
        parser.add_argument(
            "--provider-id",
            type=int,
            required=True,
            help="PK del PaymentTerminalProvider al que asignar la API Key.",
        )
        parser.add_argument(
            "--api-key",
            type=str,
            default=None,
            help=(
                "API Key en texto plano. "
                "Si se omite, se pedirá de forma interactiva (recomendado para producción)."
            ),
        )
        parser.add_argument(
            "--clear",
            action="store_true",
            default=False,
            help="Elimina la API Key almacenada para el proveedor.",
        )

    def handle(self, *args, **options):
        provider_id: int = options["provider_id"]
        api_key: str | None = options["api_key"]
        clear: bool = options["clear"]

        try:
            provider = PaymentTerminalProvider.objects.get(pk=provider_id)
        except PaymentTerminalProvider.DoesNotExist:
            raise CommandError(f"PaymentTerminalProvider con id={provider_id} no existe.")

        self.stdout.write(
            f"Proveedor: [{provider.pk}] {provider.name} — tipo {provider.provider_type}"
        )

        if clear:
            provider.set_api_key("")
            provider.save()
            self.stdout.write(self.style.SUCCESS("API Key eliminada."))
            return

        if api_key is None:
            api_key = getpass.getpass("API Key TUU (texto plano, no se mostrará): ").strip()

        if not api_key:
            raise CommandError("La API Key no puede estar vacía.")

        provider.set_api_key(api_key)
        provider.save()

        # Verificar round-trip antes de confirmar
        provider.refresh_from_db()
        if provider.get_api_key() != api_key:
            raise CommandError(
                "Error de cifrado: la clave leída no coincide con la ingresada. "
                "Verifica TUU_ENCRYPTION_KEY."
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"API Key cifrada y guardada correctamente para provider_id={provider_id}."
            )
        )
        self.stdout.write(
            "  Valor almacenado en gateway_config es un token Fernet (no la clave en claro)."
        )
