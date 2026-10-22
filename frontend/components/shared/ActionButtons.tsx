import * as React from "react"
import { Loader2, type LucideIcon } from "lucide-react"
import { Button, type buttonVariants } from "@/components/ui/button"
import { type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

type ButtonBaseProps = React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }

type ActionIcon = React.ReactNode | LucideIcon

/**
 * Canonical Capa 2 typography (ADR-0088). The two quoted fragments are
 * asserted by lib/__tests__/typography.contract.test.ts — do not merge them.
 */
const ACTION_BUTTON_CLASSES = cn(
  "h-9 px-4 text-3xs",
  "font-black tracking-widest uppercase rounded-sm shadow-card cursor-pointer"
)

/** Renders a LucideIcon component (sized) or a plain ReactNode as-is. */
function renderActionIcon(icon: ActionIcon, sizeClassName: string) {
  if (!icon) return null
  if (typeof icon === 'function' || (typeof icon === 'object' && 'render' in icon)) {
    const Icon = icon as React.ComponentType<{ className?: string }>
    return <Icon className={sizeClassName} />
  }
  return icon
}

export type SubmitButtonProps = React.ComponentProps<typeof Button> & {
  /** Show loading spinner and disable interaction */
  loading?: boolean
  /** Leading icon (Lucide component or instance). Hidden while `loading`. */
  icon?: ActionIcon
}

export const SubmitButton = React.forwardRef<HTMLButtonElement, SubmitButtonProps>(
  ({ loading = false, children = "Guardar", icon, disabled, className, variant = "default", ...props }, ref) => {
    const isDisabled = disabled || loading
    return (
      <Button
        ref={ref}
        variant={variant}
        disabled={isDisabled}
        className={cn(ACTION_BUTTON_CLASSES, className)}
        {...props}
      >
        {loading ? (
          // eslint-disable-next-line no-restricted-syntax -- This IS the canonical loading implementation for action buttons
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          renderActionIcon(icon, "size-3.5")
        )}
        {children}
      </Button>
    )
  }
)
SubmitButton.displayName = "SubmitButton"

export type DangerButtonProps = React.ComponentProps<typeof Button> & {
  /** Show loading spinner and disable interaction */
  loading?: boolean
  /** Leading icon (Lucide component or instance). Hidden while `loading`. */
  icon?: ActionIcon
}

export const DangerButton = React.forwardRef<HTMLButtonElement, DangerButtonProps>(
  ({ loading = false, children = "Eliminar", icon, disabled, className, variant = "destructive", type = "button", ...props }, ref) => {
    const isDisabled = disabled || loading
    return (
      <Button
        ref={ref}
        variant={variant}
        type={type}
        disabled={isDisabled}
        className={cn(ACTION_BUTTON_CLASSES, className)}
        {...props}
      >
        {loading ? (
          // eslint-disable-next-line no-restricted-syntax -- This IS the canonical loading implementation for action buttons
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          renderActionIcon(icon, "size-3.5")
        )}
        {children}
      </Button>
    )
  }
)
DangerButton.displayName = "DangerButton"

export const CancelButton = React.forwardRef<HTMLButtonElement, ButtonBaseProps>(
  ({ children = "Cancelar", type = "button", className, ...props }, ref) => {
    return (
      <Button 
        ref={ref} 
        variant="outline" 
        type={type} 
        className={cn("h-9 px-5 text-3xs font-black tracking-widest uppercase shadow-card", className)}
        {...props}
      >
        {children}
      </Button>
    )
  }
)
CancelButton.displayName = "CancelButton"

export interface IconButtonProps extends ButtonBaseProps {
  circular?: boolean
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, circular = false, type = "button", ...props }, ref) => {
    return (
      <Button 
        ref={ref} 
        variant="ghost" 
        size="icon" 
        type={type} 
        className={cn(
          "h-9 w-9 hover:scale-110 transition-transform", 
          circular ? "rounded-full" : "rounded-sm",
          className
        )} 
        {...props} 
      />
    )
  }
)
IconButton.displayName = "IconButton"
