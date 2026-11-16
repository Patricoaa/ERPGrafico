"""``manage.py debug_clock set "AAAA-MM-DD HH:MM" | reset | show`` (ADR-0139 D4)."""

from django.core.management.base import BaseCommand, CommandError

from core import debug_clock


class Command(BaseCommand):
    help = "Reloj de depuración (solo DEBUG=True y DEBUG_CLOCK_ENABLED=1). Hora local America/Santiago."

    def add_arguments(self, parser):
        parser.add_argument("action", choices=["set", "reset", "show"])
        parser.add_argument("datetime", nargs="?", help='"AAAA-MM-DD HH:MM" en hora local (solo para set)')

    def handle(self, *args, **options):
        if not debug_clock.is_enabled():
            raise CommandError(debug_clock.DISABLED_MESSAGE)
        action = options["action"]
        if action == "set":
            if not options["datetime"]:
                raise CommandError('Indica la hora: debug_clock set "AAAA-MM-DD HH:MM".')
            try:
                target = debug_clock.parse_local_datetime(options["datetime"])
            except ValueError as exc:
                raise CommandError("Formato esperado: AAAA-MM-DD HH:MM (hora local).") from exc
            debug_clock.set_clock(target)
            debug_clock.audit_change("debug_clock.set", None, target=target)
        elif action == "reset":
            debug_clock.reset_clock()
            debug_clock.audit_change("debug_clock.reset", None)
        self._show()

    def _show(self):
        offset = debug_clock.current_offset()
        if offset is None:
            self.stdout.write("Reloj de depuración inactivo (hora real).")
            return
        now = debug_clock.debug_now().strftime("%Y-%m-%d %H:%M:%S")
        self.stdout.write(f"Reloj de depuración: {now} (desfase {offset:+.0f} s)")
