"use client"

// ProductSelector/SearchBar
// Generic product search input with keyboard shortcut support and touch optimization.
// Extracted from @/features/pos/components/SearchBar (PR-1: ProductSelector migration).

import { useRef } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
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
}

export function SearchBar({
    value,
    onChange,
    onEnter,
    placeholder = "Buscar por nombre, código o código de barras...",
    autoFocus = true
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

    return (
        <div className="relative">
            <Search className={cn(
                "absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground",
                isTouchPOS ? "h-5 w-5" : "h-5 w-5"
            )} />
            <Input
                ref={inputRef}
                placeholder={placeholder}
                className={cn(
                    isTouchPOS ? "h-14 text-base pl-10" : "h-10 text-base pl-10"
                )}
                style={isTouch ? { fontSize: `${MIN_MOBILE_FONT_SIZE}px` } : undefined}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus={shouldAutoFocus}
            />
        </div>
    )
}
