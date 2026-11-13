import { SectionAction } from "./SectionAction"
import { SectionChecklist } from "./SectionChecklist"
import { SectionHeader } from "./SectionHeader"
import { SectionNote } from "./SectionNote"
import { SectionRoot } from "./SectionRoot"
import { SectionRow } from "./SectionRow"

/**
 * Sección reutilizable (cabecera + filas). Compuesto:
 * `Section` · `Section.Header` · `Section.Row` · `Section.Note` · `Section.Action` · `Section.Checklist`.
 */
export const Section = Object.assign(SectionRoot, {
    Header: SectionHeader,
    Row: SectionRow,
    Note: SectionNote,
    Action: SectionAction,
    Checklist: SectionChecklist,
})

export type { SectionProps, SectionStateProps } from "./SectionRoot"
export type { SectionHeaderProps } from "./SectionHeader"
export type { SectionRowProps, SectionRowExpand } from "./SectionRow"
export type { SectionNoteProps } from "./SectionNote"
export type { SectionActionProps } from "./SectionAction"
export type {
    SectionChecklistProps, SectionChecklistItem, SectionChecklistDocument, SectionChecklistDocumentLabel,
} from "./SectionChecklist"
