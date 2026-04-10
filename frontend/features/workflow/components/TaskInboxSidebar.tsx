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
                "fixed top-16 h-[calc(100vh-5rem)] w-[320px] bg-sidebar dark border border-white/5 flex flex-col will-change-transform overflow-hidden z-50 shadow-2xl rounded-2xl",
                "transition-all duration-500 ease-[var(--ease-premium)]",
                // Horizontal position: pushed left by Hub panel when hub is open
                isHubEffectivelyOpen ? "right-[calc(360px+2rem)]" : "right-4",
                // Vertical slide-in: move off-screen to the right when closed
                isOpen ? "translate-x-0 opacity-100" : "translate-x-[120%] opacity-0 pointer-events-none"
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-sidebar backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-md border border-border/50 shadow-sm shadow-black/5">
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

