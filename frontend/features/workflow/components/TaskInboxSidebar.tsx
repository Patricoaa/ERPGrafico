"use client"

import { Inbox } from "lucide-react"
import { CollapsibleSheet, PanelHeader } from "@/components/shared"
import { TaskInbox } from "@/features/workflow/components/TaskInbox"
import { useHubPanel } from "@/components/providers/HubPanelProvider"

interface TaskInboxSidebarProps {
    isOpen: boolean
    onClose: () => void
}

export function TaskInboxSidebar({ isOpen, onClose }: TaskInboxSidebarProps) {
    const { isHubEffectivelyOpen } = useHubPanel()

    return (
            <CollapsibleSheet
                sheetId="task-inbox-sidebar"
                open={isOpen}
                onOpenChange={(open) => !open && onClose()}
                tabLabel="Bandeja de Entrada"
                tabIcon={Inbox}
                variant="global"
                fullWidth={320}
                priority={0}
            >
                {/* Header */}
                <div className="border-b shrink-0">
                    <PanelHeader
                        title="Bandeja de Entrada"
                        description="Gestión de aprobaciones y tareas"
                        icon={Inbox}
                        onClose={onClose}
                        closeTooltip="Cerrar bandeja"
                    />
                </div>

                {/* Task Inbox Content */}
                <div className="flex-1 overflow-y-auto p-4 canvas-prepress">
                    {isOpen && <TaskInbox />}
                </div>
            </CollapsibleSheet>
    )
}

