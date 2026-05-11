import { cn } from "@/lib/utils"

interface FormSplitLayoutProps {
    /** Main form content or the Form component itself */
    children: React.ReactNode
    /** Sidebar content (usually Audit/Activity information) */
    sidebar?: React.ReactNode
    /** Whether to show the sidebar (typically only in edit mode) */
    showSidebar?: boolean
    /** Optional width override, defaults to w-72 */
    sidebarWidth?: string
    /** Additional classes for the form container */
    className?: string
}

/**
 
 * Handles the flexbox structure, internal scrolling, and the Audit Sidebar integration.
 */
export function FormSplitLayout({
    children,
    sidebar,
    showSidebar = false,
    sidebarWidth = "w-72",
    className
}: FormSplitLayoutProps) {
    return (
        <div className="flex-1 flex overflow-hidden min-h-[400px]">
            {/* Main Form Area */}
            <div className={cn(
                "flex-1 flex flex-col overflow-y-auto pr-6 pl-1 pb-4 pt-4 scrollbar-thin",
                className
            )}>
                {children}
            </div>

            {/* Audit/Activity Sidebar */}
            {showSidebar && sidebar && (
                <aside
                    className={cn(
                        sidebarWidth,
                        "border-l flex flex-col pt-4 hidden lg:flex"
                    )}
                >
                    {sidebar}
                </aside>
            )}
        </div>
    )
}
