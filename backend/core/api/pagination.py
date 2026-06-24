"""
Shared pagination classes for the project.

Canonical contract: docs/20-contracts/pagination-contract.md

`StandardResultsSetPagination` is the project-wide page-number pagination
class. It matches the response envelope `{count, next, previous, results}`
that the frontend's `Page<T>` type and `toPage()` helper expect.

`max_page_size` is intentionally capped at 200 (not the DRF default 1000)
so a hostile or careless `?page_size=10000` cannot exhaust server memory
or trip the request timeout. Endpoints that genuinely need to dump large
datasets must go through a dedicated `/export/` action, not paginate.
"""

from rest_framework.pagination import PageNumberPagination


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200
