import * as React from "react"
import { Loader2, Save } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

type ButtonBaseProps = React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }

export interface SubmitButtonProps extends ButtonBaseProps {
  loading?: boolean
  icon?: React.ReactNode
}

export const SubmitButton = React.forwardRef<HTMLButtonElement, SubmitButtonProps>(
  ({ loading = false, children = "Guardar", icon = <Save className="mr-2 h-4 w-4" />, disabled, type = "submit", ...props }, ref) => {
    return (
      <Button ref={ref} variant="default" type={type} disabled={loading || disabled} {...props}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : icon}
        {children}
      </Button>
    )
  }
)
SubmitButton.displayName = "SubmitButton"

export interface DangerButtonProps extends ButtonBaseProps {
  loading?: boolean
}

export const DangerButton = React.forwardRef<HTMLButtonElement, DangerButtonProps>(
  ({ loading = false, children = "Eliminar", disabled, type = "button", ...props }, ref) => {
    return (
      <Button ref={ref} variant="destructive" type={type} disabled={loading || disabled} {...props}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </Button>
    )
  }
)
DangerButton.displayName = "DangerButton"

export const CancelButton = React.forwardRef<HTMLButtonElement, ButtonBaseProps>(
  ({ children = "Cancelar", type = "button", ...props }, ref) => {
    return (
      <Button ref={ref} variant="outline" type={type} {...props}>
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
          "hover:scale-110 transition-transform", 
          circular ? "rounded-full" : "rounded-md",
          className
        )} 
        {...props} 
      />
    )
  }
)
IconButton.displayName = "IconButton"
