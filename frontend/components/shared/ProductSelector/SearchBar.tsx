"use client"

// ProductSelector/SearchBar
// Generic product search input matching SmartSearchBar visual style,
// with touch optimization for POS devices.

import { Button } from "@/components/ui/button"
import { useRef } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDeviceContext, MIN_MOBILE_FONT_SIZE } from '@/hooks/useDeviceContext'

export interface SearchBarProps {
    value: string
    onChange: (value: string) => void
    /** Called when the user presses Enter — typically triggers exact-match product lookup */
    onEnter?: () => void
    placeholder?: string
    /** Auto-focus the input on mount. Disabled automatically on touch devices to prevent keyboard pop-up. */
    autoFocus?: boolean
    /** Optional element rendered to the right of the input (before clear button) */
    rightAction?: React.ReactNode
    className?: string
}

export function SearchBar({
    value,
    onChange,
    onEnter,
    placeholder = "Buscar por nombre, código o código de barras...",
    autoFocus = true,
    rightAction,
    className
}: SearchBarProps) {
    const inputRef = useRef<HTMLInputElement>(null)
    const { isTouch, isTouchPOS } = useDeviceContext()

    // Disable autoFocus on touch devices to prevent unexpected keyboard pop-up
    const shouldAutoFocus = autoFocus && !isTouch

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && onEnter) {
            onEnter()
        }
    }

    const isTouchDevice = isTouch || isTouchPOS

    return (
        <div
            className={cn(
                'group flex items-center gap-1.5 rounded-sm transition-all border border-border/60',
                'bg-background',
                'hover:bg-muted/50 hover:text-foreground hover:ring-2 hover:ring-primary/10',
                'focus-within:bg-muted/50 focus-within:ring-2 focus-within:ring-primary/20',
                isTouchDevice ? 'h-12 px-3' : 'h-9 px-2',
                className
            )}
        >
            <Search className={cn(
                'shrink-0 transition-colors group-hover:text-foreground ml-1',
                isTouchDevice ? 'size-5 text-muted-foreground/50' : 'size-3.5 text-muted-foreground/50'
            )} />
            <input
                ref={inputRef}
                placeholder={placeholder}
                className={cn(
                    'flex-1 bg-transparent border-none outline-none py-0',
                    'text-muted-foreground placeholder:text-muted-foreground/40',
                    isTouchDevice ? 'h-10 text-base' : 'h-7 text-xs'
                )}
                style={isTouch ? { fontSize: `${MIN_MOBILE_FONT_SIZE}px` } : undefined}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus={shouldAutoFocus}
                autoComplete="off"
                spellCheck={false}
            />
            {rightAction}
            {value && (
                <Button
                    type="button"
                    onClick={() => onChange('')}
                    className="shrink-0 rounded-sm p-1 text-muted-foreground/40 hover:text-foreground transition-colors"
                    aria-label="Limpiar búsqueda"
                >
                    <X className={isTouchDevice ? 'size-4' : 'size-3'} />
                </Button>
            )}
        </div>
    )
}
