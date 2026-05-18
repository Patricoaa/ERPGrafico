"use client"

import { Inbox } from "lucide-react"
import { SheetCloseButton, CollapsibleSheet } from "@/components/shared"
import { TaskInbox } from "@/features/workflow/components/TaskInbox"
import { cn } from "@/lib/utils"
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
                <div className="flex items-center justify-between px-4 pt-1 pb-4 border-b border-white/5 bg-sidebar backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <Inbox className="h-5 w-5 text-muted-foreground" />
                        <h2 className="text-lg font-bold tracking-tight text-white">Bandeja de Entrada</h2>
                    </div>
                    <SheetCloseButton onClick={onClose} />
                </div>

                {/* Task Inbox Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {isOpen && <TaskInbox />}
                </div>
            </CollapsibleSheet>
    )
}

