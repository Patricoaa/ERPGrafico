---
id: 0106
title: Product creation continues into optional setup
status: Proposed
date: 2026-10-30
author: inventory-team
---

# 0106 — Product creation continues into optional setup

## Context

The product drawer currently closes immediately after saving. Product-specific price rules and bills of materials require the persisted product ID, so users must reopen the product to configure them. Initial variant generation is already designed as part of product creation, but the write serializer and multipart request did not carry all required fields consistently.

Price rules and bills of materials are optional; prompting users to create them as if they were required would add friction and imply a false business constraint.

## Decision

1. Keep initial template variant generation inside the atomic product-create service operation. The write contract accepts the product's variant flag and an optional attribute/value selection. Invalid selections fail the request and roll back product creation.
2. Keep price rules and BOMs as independent resources created through their existing endpoints after the product is persisted. Do not combine their lifecycles into a new cross-resource transaction.
3. After successful product creation, show an informational decision: continue editing the persisted product in the same drawer, or finish and close it. The prompt must state that price rules and BOMs are optional.
4. Fetch the canonical product detail before enabling dependent tabs. If that refresh fails, retain the successful create response as a fallback and allow the user to finish or retry.

## Consequences

- **Positive:** users can immediately configure dependent resources without reopening the product, while users who need no extra setup can finish with one click.
- **Positive:** product and initial variants remain all-or-nothing; later optional setup can be retried without recreating the product.
- **Neutral:** the UI must distinguish the create callback from final completion so a parent panel does not close after the first save.
- **Negative:** the product write contract expands and frontend/backend tests must keep it synchronized.

## Alternatives considered

- Close the drawer and require reopening the product. Rejected because it adds navigation and context switching after every create.
- Create price rules and BOMs in the product transaction. Rejected because they have separate endpoints, validation, and lifecycles, and are not universally required.
- Automatically open the first optional setup tab. Rejected because it assumes every product needs extra configuration.

## References

- [Product API contract](../../20-contracts/api-contracts.md#products)
- [Add endpoint playbook](../../30-playbooks/add-endpoint.md)
- [Form patterns](../../20-contracts/component-form-patterns.md)