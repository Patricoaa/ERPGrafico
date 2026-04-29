# ADR 0005: Bank Reconciliation Routing Strategy

## Status
Accepted

## Context
During Sprint 7 (S7.1) of the Bank Reconciliation feature implementation, we identified a convoluted routing patterns with four different ways to access the "Workbench" (reconciliation engine) for a given bank statement:
1. `/[id]/page.tsx` - Has an internal React state `view='matching'` that toggles the UI from the summary to the workbench inline.
2. `/[id]/workbench/page.tsx` - A dedicated route.
3. `/[id]/match/page.tsx` - A duplicate ("zombie") of the workbench route.
4. `/[id]/process/page.tsx` - Another duplicate route.

This caused navigation loops, unexpected interactions with the browser's history, missing contexts, and code duplication.

## Decision
We decided to adopt a strict, clean separation of concerns for the URLs related to a Bank Statement:
1. **Summary View (`/[id]`):** This generic detail page is solely responsible for presenting the overview of the statement, its progress, ledger reconciliation metrics, and the status of its lines. It will not render the `ReconciliationPanel` inline.
2. **Workbench View (`/[id]/workbench`):** This is the dedicated focus-mode UI for executing the actual reconciliation matches, allocating splits, and reviewing suggestions.

Whenever a user wants to "Reconcile" a statement from the Summary view, they will be navigated to `/[id]/workbench`. When they hit "Back" from the Workbench, they will be navigated to `/[id]`.

## Consequences
**Positive:**
- URLs are clean and represent a single conceptual view.
- Users can bookmark the Workbench directly without relying on an internal React state.
- Elimination of zombie routes reduces bundle size and code maintenance overhead.
- Predictable browser navigation (`router.back()` or explicit backwards links will not loop).

**Negative:**
- Requires cleaning up hardcoded links in other components (e.g. `DashboardPendingTable`) that pointed to the zombie routes. 

## References
- Playbook Roadmap: `docs/30-playbooks/bank-reconciliation-roadmap.md` (Gap F1, F4, Jira/Sprint S7.1)
