"use client"

import { Inbox } from "lucide-react"
import { CollapsibleSheet, PanelHeader } from "@/components/shared"
import { TaskInbox } from "@/features/workflow/components/TaskInbox"
import { useState } from "react"

interface TaskInboxSidebarProps {
    isOpen: boolean
    onClose: () => void
}

export function TaskInboxSidebar({ isOpen, onClose }: TaskInboxSidebarProps) {
    const [taskCount, setTaskCount] = useState(0)

    return (
        <CollapsibleSheet
            sheetId="task-inbox-sidebar"
            open={isOpen}
            onOpenChange={(open) => !open && onClose()}
            tabLabel="Bandeja de Entrada"
            tabIcon={Inbox}
            variant="global"
            fullWidth={360}
            priority={0}
            badge={taskCount}
            className="w-[360px] max-w-[360px] bg-muted/30"
        >
            {/* Header — same height as entity drawers (h-14 = 56 px) */}
            <div className="border-b border-border shrink-0 h-14 flex items-center px-4">
                <PanelHeader
                    title="Bandeja de Entrada"
                    icon={Inbox}
                    onClose={onClose}
                    closeTooltip="Cerrar bandeja"
                />
            </div>

            {/* Task Inbox Content */}
            <div className="flex-1 overflow-hidden min-h-0">
                {isOpen && <TaskInbox onCountChange={(c) => setTaskCount(c.total)} />}
            </div>
        </CollapsibleSheet>
    )
}
