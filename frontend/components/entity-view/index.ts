/**
 * Entity view system (ADR-0087, Accepted). Second authorized barrel (invariant #6);
 * contract: docs/20-contracts/component-entity-view.md. Importing it registers the core kinds.
 *
 * Order matters: the dependency-free core modules are evaluated first. The kinds and surfaces
 * import `@/components/shared`, whose graph can reach feature modules that import this barrel
 * back (e.g. a feature view that defines an entity at module level); those must find the core
 * (`defineEntity`, `registerValueKind`, formatters) already initialized.
 */
export * from "./core/value-kinds"
export * from "./core/formatters"
export * from "./core/define-entity"
export * from "./core/use-entity-collection"
export * from "./core/use-server-page"

import { registerCoreValueKinds } from "./kinds/core-kinds"

export * from "./surfaces/Collection"
export * from "./surfaces/EditableCollection"
export * from "./surfaces/EntityViewProvider"
export * from "./surfaces/CollectionModes"
export * from "./surfaces/useCollectionViewMode"

registerCoreValueKinds()
