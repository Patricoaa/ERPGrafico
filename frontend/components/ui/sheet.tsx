"use client"

import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  container,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal> & { container?: HTMLElement }) {
  const [target, setTarget] = React.useState<HTMLElement | null>(null)

  React.useEffect(() => {
    requestAnimationFrame(() => {
      setTarget(
        document.getElementById("main-content") ??
        document.getElementById("module-sheets-portal-container") ??
        document.body
      )
    })
  }, [])

  return (
    <SheetPrimitive.Portal 
      container={container || target || undefined} 
      data-slot="sheet-portal" 
      {...props} 
    />
  )
}

function SheetOverlay({
  className,
  isPlain = false,
  style,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay> & { isPlain?: boolean; style?: React.CSSProperties }) {
  const classes = cn(
    "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed top-[var(--header-height)] inset-x-0 bottom-0 z-50 bg-overlay/50 backdrop-blur-sm ease-[cubic-bezier(0.16,1,0.3,1)] duration-500",
    className
  )

  if (isPlain) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { forceMount, asChild, ...divProps } = props
    return (
      <div
        data-slot="sheet-overlay"
        data-state="open"
        className={classes}
        style={style}
        {...divProps}
      />
    )
  }

  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={classes}
      style={style}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  hideOverlay = false,
  isPlainOverlay = false,
  onPointerDownOutside,
  onFocusOutside,
  onInteractOutside,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left"
  hideOverlay?: boolean
  hideCloseButton?: boolean
  onPointerDownOutside?: (event: Event) => void
  onFocusOutside?: (event: Event) => void
  onInteractOutside?: (event: Event) => void
  container?: HTMLElement
  overlayClassName?: string
  overlayStyle?: React.CSSProperties
  isPlainOverlay?: boolean
}) {
  const { hideCloseButton, container, overlayClassName, overlayStyle, ...restProps } = props
  return (
    <SheetPortal container={container}>
      {!hideOverlay && <SheetOverlay className={overlayClassName} style={overlayStyle} isPlain={isPlainOverlay} />}
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "bg-card text-card-foreground rounded-xl border border-border/15 shadow-overlay data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col ease-[cubic-bezier(0.16,1,0.3,1)] duration-500",
          side === "right" &&
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
          side === "left" &&
            "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
          side === "top" &&
            "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 border-b border-border/15",
          side === "bottom" &&
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 border-t border-border/15",
          className
        )}
        onPointerDownOutside={onPointerDownOutside}
        onFocusOutside={onFocusOutside}
        onInteractOutside={onInteractOutside}
        {...restProps}
      >
        {children}
        <SheetPrimitive.Close 
          className={cn(
            "ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none",
            hideCloseButton && "hidden"
          )}
        >
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-foreground font-semibold", className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
