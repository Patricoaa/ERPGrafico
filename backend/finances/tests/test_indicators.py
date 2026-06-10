"""
Tests del modelo `IndicatorValue` (Fase 2 — F2.1):
- unicidad (indicator, date) impide duplicar
- get_value() retorna valor exacto si existe
- get_value() hace fallback al último valor previo si no hay exacto
- get_value() lanza DoesNotExist si nunca se cargó nada
- IndicatorService.upsert crea o actualiza
- IndicatorService.fetch_from_mindicador no rompe sin red
"""
from datetime import date
from decimal import Decimal

import pytest

from finances.models import IndicatorValue
from finances.services import IndicatorService


@pytest.mark.django_db
def test_unique_constraint_per_indicator_date():
    IndicatorValue.objects.create(
        indicator=IndicatorValue.Indicator.UF,
        date=date(2026, 6, 1),
        value=Decimal('37000.0000'),
    )
    with pytest.raises(Exception):
        IndicatorValue.objects.create(
            indicator=IndicatorValue.Indicator.UF,
            date=date(2026, 6, 1),
            value=Decimal('37100.0000'),
        )


@pytest.mark.django_db
def test_get_value_returns_exact_date():
    IndicatorValue.objects.create(
        indicator=IndicatorValue.Indicator.UF,
        date=date(2026, 6, 1),
        value=Decimal('37000.0000'),
    )
    IndicatorValue.objects.create(
        indicator=IndicatorValue.Indicator.UF,
        date=date(2026, 6, 2),
        value=Decimal('37100.0000'),
    )
    val = IndicatorValue.get_value('UF', date(2026, 6, 1))
    assert val == Decimal('37000.0000')


@pytest.mark.django_db
def test_get_value_falls_back_to_last_known():
    """Si no hay valor exacto, retorna el último valor previo (last known good)."""
    IndicatorValue.objects.create(
        indicator=IndicatorValue.Indicator.UF,
        date=date(2026, 5, 30),
        value=Decimal('36900.0000'),
    )
    val = IndicatorValue.get_value('UF', date(2026, 6, 5))
    assert val == Decimal('36900.0000')


@pytest.mark.django_db
def test_get_value_raises_if_no_data():
    with pytest.raises(IndicatorValue.DoesNotExist):
        IndicatorValue.get_value('UTM', date(2026, 6, 1))


@pytest.mark.django_db
def test_indicator_service_upsert_creates():
    obj, created = IndicatorService.upsert(
        'UF', date(2026, 6, 10), Decimal('37500.1234'),
        source='manual', notes='carga inicial',
    )
    assert created is True
    assert obj.value == Decimal('37500.1234')
    assert obj.source == 'manual'


@pytest.mark.django_db
def test_indicator_service_upsert_updates_existing():
    IndicatorService.upsert('UF', date(2026, 6, 10), Decimal('37500'))
    obj, created = IndicatorService.upsert(
        'UF', date(2026, 6, 10), Decimal('37600.50'),
        source='mindicador.cl', notes='corrección',
    )
    assert created is False
    assert obj.value == Decimal('37600.50')
    assert obj.source == 'mindicador.cl'


@pytest.mark.django_db
def test_indicator_service_fetch_feed_returns_zero_without_network(monkeypatch):
    """Sin red, el feed no rompe y retorna 0."""
    import urllib.request
    def _fail(*args, **kwargs):
        raise OSError('no network')
    monkeypatch.setattr(urllib.request, 'urlopen', _fail)
    n = IndicatorService.fetch_from_mindicador('UF')
    assert n == 0


@pytest.mark.django_db
def test_indicator_service_fetch_feed_inserts(monkeypatch):
    """Con respuesta simulada de mindicador, inserta valores."""
    import json
    from io import BytesIO

    class _FakeResp:
        def __init__(self, body):
            self._body = body.encode('utf-8')
        def read(self):
            return self._body
        def __enter__(self):
            return self
        def __exit__(self, *args):
            return False

    payload = {
        'serie': [
            {'fecha': '2026-06-01T03:00:00.000Z', 'valor': 37000.50},
            {'fecha': '2026-05-31T03:00:00.000Z', 'valor': 36950.25},
        ],
    }
    import urllib.request
    monkeypatch.setattr(
        urllib.request, 'urlopen',
        lambda *a, **k: _FakeResp(json.dumps(payload)),
    )
    n = IndicatorService.fetch_from_mindicador('UF', days=30)
    assert n == 2
    assert IndicatorValue.objects.filter(indicator='UF').count() == 2
