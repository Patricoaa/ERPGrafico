"use client"

/**
 * ManufacturingConfigFields
 *
 * The one definition of "what we ask when configuring a fabrication":
 * contact/reference, job description and per-stage specifications.
 * Shared by the work-order wizard (step 3) and the POS manufacturing drawer.
 * Identity, volume and planning are deliberately not here: the sale order
 * already owns them.
 */

import { ManufacturingSpecsEditor, type ManufacturingData, type ManufacturingSpecsEditorProps } from "./ManufacturingSpecsEditor"
import { ManufacturingContactField, type ManufacturingContact } from "./ManufacturingContactField"

interface ManufacturingConfigFieldsProps {
  data: ManufacturingData
  onDataChange: (next: ManufacturingData) => void
  contact: ManufacturingContact | null
  onContactChange: (next: ManufacturingContact | null) => void
  /** Locks the specifications (their stage has started) while the contact stays editable. */
  specsDisabled?: boolean
  /** Locks everything (read-only view). */
  disabled?: boolean
  /** Phases whose stage already started, with the reason: they can't be toggled nor edited. */
  lockedPhases?: ManufacturingSpecsEditorProps["lockedPhases"]
  /** Openable URL per existing design file name. */
  existingFileUrls?: Record<string, string>
}

export function ManufacturingConfigFields({ data, onDataChange, contact, onContactChange, specsDisabled, disabled, lockedPhases, existingFileUrls }: ManufacturingConfigFieldsProps) {
  return (
    <div className="space-y-6">
      <ManufacturingContactField value={contact} onChange={onContactChange} disabled={disabled} />
      <ManufacturingSpecsEditor
        value={data}
        onChange={onDataChange}
        showProductDescription
        showInternalNotes={false}
        variant="inline"
        disabled={disabled || specsDisabled}
        lockedPhases={lockedPhases}
        existingFileUrls={existingFileUrls}
      />
    </div>
  )
}
