/**
 * WorkOrderMaterials — TASK-109
 *
 * This file is now a thin re-export shim.
 * All logic has moved to the shared ManufacturingSpecsEditor.
 *
 * Kept for backward compatibility with WorkOrderForm/index.tsx imports.
 * TODO: Remove once WorkOrderForm/index.tsx is updated to import directly.
 */
export { ManufacturingSpecsEditor as WorkOrderMaterials } from "@/components/shared/manufacturing"
export type { ManufacturingData as WorkOrderMaterialsData } from "@/components/shared/manufacturing"
