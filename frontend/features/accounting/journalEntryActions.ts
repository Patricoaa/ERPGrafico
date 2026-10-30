import type { ActionRegistry } from "@/types/actions"
import { FileText, RotateCcw, Trash2, Eye, FileEdit } from "lucide-react"
import type { JournalEntry } from "./hooks/useJournalEntries"

/**
 * Journal Entry Action Registry
 * Defines all available actions for journal entries with permission requirements
 */

export const journalEntryActions: ActionRegistry<JournalEntry> = {
    accounting: {
        id: "accounting",
        label: "Contabilidad",
        icon: FileText,
        actions: [
            {
                id: "post-entry",
                label: "Publicar Asiento",
                icon: FileEdit,
                requiredPermissions: ["accounting.post_journalentry"],
                checkAvailability: (entry) => {
                    if (!entry) return false
                    return entry.status === "DRAFT"
                },
                badge: { type: "warning", label: "Pendiente" },
                excludedStatus: ["CANCELLED"],
            },
            {
                id: "reverse-entry",
                label: "Reversar Asiento",
                icon: RotateCcw,
                requiredPermissions: ["accounting.reverse_journalentry"],
                checkAvailability: (entry) => {
                    if (!entry) return false
                    return entry.status === "POSTED" && !entry.reversal_of
                },
                excludedStatus: ["DRAFT", "CANCELLED", "REVERSAL"],
            },
            {
                id: "view-entry",
                label: "Ver Asiento",
                icon: Eye,
                requiredPermissions: ["accounting.view_journalentry"],
                checkAvailability: () => true,
            },
        ],
    },
    management: {
        id: "management",
        label: "Gestión",
        icon: FileText,
        actions: [
            {
                id: "delete-entry",
                label: "Eliminar Asiento",
                icon: Trash2,
                requiredPermissions: ["accounting.delete_journalentry"],
                checkAvailability: (entry) => {
                    if (!entry) return false
                    return entry.status === "DRAFT"
                },
                variant: "destructive",
                excludedStatus: ["POSTED", "CLOSED", "REVERSAL", "CANCELLED"],
            },
        ],
    },
}