/**
 * Entity view system — spike (ADR-0087, Proposed). Isolated namespace with its own barrel;
 * not used by production pages until Gate C.
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
