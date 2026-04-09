"use client"

import { X, Inbox } from "lucide-react"
import { Button } from "@/components/ui/button"
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
        <aside
            className={cn(
                "fixed top-0 h-screen w-1/4 min-w-[320px] max-w-[450px] bg-sidebar dark border-l border-white/5 flex flex-col will-change-transform overflow-hidden z-50 shadow-[0_0_50px_rgba(0,0,0,0.5)]",
                "transition-all duration-500 ease-in-out",
                // Horizontal position: pushed left by Hub panel when hub is open
                isHubEffectivelyOpen ? "right-[420px]" : "right-0",
                // Vertical slide-in: move off-screen to the right when closed
                isOpen ? "translate-x-0" : "translate-x-full"
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/5  bg-sidebar backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Inbox className="h-5 w-5 text-primary" />
                    </div>
                    <h2 className="text-lg font-bold tracking-tight text-white">Bandeja de Entrada</h2>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="rounded-lg h-9 w-9 hover:bg-white/10 text-muted-foreground hover:text-white transition-all"
                >
                    <X className="h-5 w-5" />
                </Button>
            </div>

            {/* Task Inbox Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {isOpen && <TaskInbox />}
            </div>
        </aside>
    )
}

