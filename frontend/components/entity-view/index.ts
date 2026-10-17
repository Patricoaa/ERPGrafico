/**
 * Entity view system (ADR-0087, Accepted). Second authorized barrel (invariant #6);
 * contract: docs/20-contracts/component-entity-view.md. Importing it registers the core kinds.
 */
import { registerCoreValueKinds } from "./kinds/core-kinds"

registerCoreValueKinds()

export * from "./core/value-kinds"
export * from "./core/formatters"
export * from "./core/define-entity"
export * from "./core/use-entity-collection"
export * from "./surfaces/Collection"
export * from "./surfaces/EditableCollection"
export * from "./surfaces/EntityViewProvider"
export * from "./surfaces/CollectionModes"
