import { Minus } from "lucide-react"

export const MetadataItem = ({ label, value, icon: Icon, className = "" }: { label: string, value: React.ReactNode, icon?: React.ElementType, className?: string }) => {
    if (value === undefined || value === null || value === "") return null
    // Fallback icon if none provided
    const DisplayIcon = Icon || Minus
    return (
        <div className={`space-y-0.5 ${className}`}>
            <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <DisplayIcon className="h-3 w-3" />
                {label}
            </h4>
            <div className="text-[13px] font-medium text-foreground truncate">
                {typeof value === 'boolean' ? (value ? 'Sí' : 'No') : value}
            </div>
        </div>
    )
}
