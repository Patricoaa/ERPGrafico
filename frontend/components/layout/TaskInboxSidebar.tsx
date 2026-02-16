"use client"

import { X, Inbox } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TaskInbox } from "@/components/workflow/TaskInbox"
import { cn } from "@/lib/utils"

interface TaskInboxSidebarProps {
    isOpen: boolean
    onClose: () => void
}

export function TaskInboxSidebar({ isOpen, onClose }: TaskInboxSidebarProps) {
    return (
        <aside
            className={cn(
                "fixed right-0 top-0 w-1/4 min-w-[320px] max-w-[450px] bg-sidebar border-l border-white/5 h-screen flex flex-col transition-all duration-300 ease-in-out overflow-hidden z-50 shadow-[0_0_50px_rgba(0,0,0,0.5)]",
                isOpen ? "translate-x-0" : "translate-x-full"
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/5  bg-sidebar backdrop-blur-xl">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-xl">
                        <Inbox className="h-5 w-5 text-primary" />
                    </div>
                    <h2 className="text-lg font-bold tracking-tight text-white">Bandeja de Entrada</h2>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="rounded-xl h-9 w-9 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
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
