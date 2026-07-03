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
            fullWidth={320}
            priority={0}
            badge={taskCount}
        >
            {/* Header */}
            <div className="border-b shrink-0 px-6 pt-6 pb-4">
                <PanelHeader
                    title="Bandeja de Entrada"
                    icon={Inbox}
                    onClose={onClose}
                    closeTooltip="Cerrar bandeja"
                    titleClassName="text-md font-black tracking-tight"
                />
            </div>

            {/* Task Inbox Content */}
            <div className="flex-1 overflow-y-auto py-4">
                {isOpen && <TaskInbox onCountChange={(c) => setTaskCount(c.total)} />}
            </div>
        </CollapsibleSheet>
    )
}
