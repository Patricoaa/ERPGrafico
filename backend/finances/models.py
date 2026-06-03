"""
finances/models.py
Modelos del módulo finances: indicadores económicos diarios (UF, UTM, USD).

Hoy solo `IndicatorValue` — almacena el valor de un indicador (UF, UTM, USD)
para una fecha determinada. La unicidad por (indicator, date) garantiza que
no se dupliquen valores cargados manualmente.

Uso principal (Fase 2 — Créditos bancarios): conversión UF→CLP al pagar
cuotas de préstamos indexados. Diseño extensible a multi-moneda futura
en conciliación (gap B7 del roadmap de conciliación).
"""
from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _


class IndicatorValue(models.Model):
    """
    Valor diario de un indicador económico (UF, UTM, USD, etc.).

    Por ejemplo: UF al 2026-06-01 = $37.123,45.

    La unicidad (indicator, date) impide duplicar el valor de un mismo
    indicador en una fecha. `value` se guarda con 4 decimales para
    soportar UF/UTM con precisión.
    """

    class Indicator(models.TextChoices):
        UF  = 'UF',  _('Unidad de Fomento (UF)')
        UTM = 'UTM', _('Unidad Tributaria Mensual (UTM)')
        USD = 'USD', _('Dólar Observado (USD)')

    indicator = models.CharField(
        _("Indicador"), max_length=10,
        choices=Indicator.choices,
    )
    date = models.DateField(_("Fecha"))
    value = models.DecimalField(
        _("Valor"), max_digits=18, decimal_places=4,
        validators=[MinValueValidator(Decimal('0.0001'))],
        help_text=_("Valor del indicador en CLP (o USD mismo para USD)."),
    )
    source = models.CharField(
        _("Origen"), max_length=50, blank=True,
        help_text=_("Origen del valor: 'manual' (UI) o 'mindicador.cl' (feed)."),
    )
    notes = models.CharField(_("Notas"), max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("Valor de Indicador")
        verbose_name_plural = _("Valores de Indicadores")
        ordering = ['-date', 'indicator']
        constraints = [
            models.UniqueConstraint(
                fields=['indicator', 'date'],
                name='uniq_indicator_value_per_date',
            ),
        ]
        indexes = [
            models.Index(fields=['indicator', '-date']),
        ]

    def __str__(self) -> str:
        return f"{self.indicator} {self.date}: {self.value}"

    # ── Helpers de clase ──────────────────────────────────────────────────

    @classmethod
    def get_value(cls, indicator: str, on_date) -> Decimal:
        """
        Retorna el valor del `indicator` para `on_date`.

        Si no hay valor exacto, retorna el último valor previo disponible
        (fallback "last known good") para no romper flujos cuando el
        operador aún no ha cargado el valor del día.

        Lanza `IndicatorValue.DoesNotExist` solo si nunca se ha cargado
        ningún valor para ese indicador.
        """
        qs = cls.objects.filter(indicator=indicator, date__lte=on_date)
        row = qs.order_by('-date').values_list('value', flat=True).first()
        if row is None:
            raise cls.DoesNotExist(
                f"No hay valor cargado para {indicator} en o antes de {on_date}."
            )
        return row
