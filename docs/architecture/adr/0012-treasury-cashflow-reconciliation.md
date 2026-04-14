# ADR 0012: Sincronización de Tesorería e Integridad del Flujo de Caja

## Status
Proposed (Pending Approval)

## Context
The system currently implements a Cash Flow Statement using the Indirect Method based on `CFCategory` mappings in the Chart of Accounts. However, there is no structural link between these mappings and the actual liquid accounts managed in the Treasury module (`TreasuryAccount`). 

This creates a risk where the reported "Net Increase/Decrease in Cash" does not match the actual balance changes in the company's bank accounts and cash drawers, leading to unreliable financial reporting.

## Decision
We will establish the Treasury module as the "Boundary" of the Cash Pool for all financial reporting.

1.  **Accounting Restriction**: `TreasuryAccount` instances can only be linked to accounting accounts (`Account`) that:
    -   Follow the code prefix designated for Liquid Assets (default: `1.1.01`).
    -   Are "Leaf" accounts (no children) allowed for direct posting.
2.  **Cash Flow Baseline**: The Cash Flow Statement will no longer rely solely on cumulative sum of categories. It will:
    -   Calculate a "Baseline" by summing the starting and ending balances of all accounts linked to `TreasuryAccount`.
    -   Calculate the "Activity Flow" by summing variations in accounts mapped to `OPERATING`, `INVESTING`, and `FINANCING`.
3.  **Mandatory Reconciliation**: The `get_cash_flow` service will perform a real-time reconciliation: `(Ending Cash - Starting Cash) - (Net Flow From Activities) = Discrepancy`.
4.  **Anomaly Detection**: If a discrepancy exists, the system will identify accounts that have balance changes but are neither in the "Cash Pool" nor mapped to a `CFCategory`.

## Consequences
-   **Positive**: Financial reports will have 100% integrity with bank reality. Users will be alerted if their configuration is incomplete.
-   **Negative**: Initial setup requires stricter data entry. Users cannot link treasury to arbitrary asset accounts.
-   **Neutral**: Changes to `Account` mappings might temporarily "unbalance" the cash flow until corrected.
