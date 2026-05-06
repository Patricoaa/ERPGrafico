import * as React from "react"
import { Loader2, Save } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

import { ActionSlideButton } from "./ActionSlideButton"

type ButtonBaseProps = React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }

export interface SubmitButtonProps extends React.ComponentProps<typeof ActionSlideButton> {}

export const SubmitButton = React.forwardRef<HTMLButtonElement, SubmitButtonProps>(
  ({ loading = false, children = "Guardar", icon = <Save className="h-3.5 w-3.5" />, ...props }, ref) => {
    return (
      <ActionSlideButton
        ref={ref}
        variant="primary"
        loading={loading}
        icon={icon}
        {...props}
      >
        {children}
      </ActionSlideButton>
    )
  }
)
SubmitButton.displayName = "SubmitButton"

export interface DangerButtonProps extends React.ComponentProps<typeof ActionSlideButton> {}

export const DangerButton = React.forwardRef<HTMLButtonElement, DangerButtonProps>(
  ({ loading = false, children = "Eliminar", ...props }, ref) => {
    return (
      <ActionSlideButton
        ref={ref}
        variant="destructive"
        loading={loading}
        {...props}
      >
        {children}
      </ActionSlideButton>
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
        className={cn("h-9 px-5 text-[10px] font-black tracking-widest uppercase shadow-sm", className)}
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
