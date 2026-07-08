import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Info, AlertTriangle, CheckCircle2 } from "lucide-react"
import type { LucideIcon } from "lucide-react"

const alertVariants = cva(
    "relative w-full rounded-sm border p-4 flex items-start gap-3 ",
    {
        variants: {
            variant: {
                default: "bg-background text-foreground",
                destructive:
                    "border-destructive/50 text-foreground bg-destructive/5 [&>svg]:text-destructive",
                warning:
                    "border-warning/50 text-foreground bg-warning/5 [&>svg]:text-warning",
                info:
                    "border-info/50 text-foreground bg-info/5 [&>svg]:text-info",
                success:
                    "border-success/50 text-foreground bg-success/5 [&>svg]:text-success",
                primary:
                    "border-primary/50 text-foreground bg-primary/5 [&>svg]:text-primary",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
)

const variantIcons: Record<string, LucideIcon | null> = {
    destructive: AlertTriangle,
    warning: AlertTriangle,
    info: Info,
    success: CheckCircle2,
    primary: Info,
}

interface AlertProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
    icon?: LucideIcon | null
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
    ({ className, variant, icon: Icon, children, ...props }, ref) => {
        const v = variant || "default"
        const DefaultIcon = variantIcons[v]
        const IconComponent = Icon !== undefined ? Icon : DefaultIcon

        return (
            <div
                ref={ref}
                role="alert"
                className={cn(alertVariants({ variant }), className)}
                {...props}
            >
                {IconComponent && <IconComponent className="h-4 w-4 shrink-0" />}
                {children}
            </div>
        )
    }
)
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
    <h5
        ref={ref}
        className={cn("mb-1 font-medium leading-none tracking-tight", className)}
        {...props}
    />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("text-sm [&_p]:leading-relaxed", className)}
        {...props}
    />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription, variantIcons }
