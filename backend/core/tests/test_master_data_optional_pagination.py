"""Contrato ADR-0112: master data con paginación opt-in.

- Sin `page`/`page_size`: lista plana `T[]` (compatibilidad).
- Con `page_size` o `page`: envoltorio `{count, next, previous, results}`.
"""

import pytest

from accounting.models import Account, AccountType

MASTER_DATA_URLS = [
    "/api/accounting/accounts/",
    "/api/hr/employees/",
    "/api/treasury/accounts/",
]


@pytest.mark.django_db
@pytest.mark.parametrize("url", MASTER_DATA_URLS)
def test_flat_list_by_default(api_client, url):
    response = api_client.get(url)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.django_db
@pytest.mark.parametrize("url", MASTER_DATA_URLS)
def test_paginated_envelope_when_requested(api_client, url):
    response = api_client.get(url, {"page_size": 1})
    assert response.status_code == 200
    body = response.json()
    assert set(body) >= {"count", "next", "previous", "results"}
    assert isinstance(body["results"], list)


@pytest.mark.django_db
def test_accounts_paginated_slice_matches_full_list(api_client):
    for i in range(5):
        Account.objects.create(
            code=f"9{i:03d}", name=f"Cuenta test {i}", account_type=AccountType.ASSET
        )
    url = "/api/accounting/accounts/"

    full = api_client.get(url).json()
    page = api_client.get(url, {"page_size": 2, "page": 2}).json()

    assert page["count"] == len(full)
    assert len(page["results"]) == 2
    assert [a["id"] for a in page["results"]] == [a["id"] for a in full[2:4]]
