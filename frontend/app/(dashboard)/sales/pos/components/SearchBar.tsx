"use client"

// SearchBar Component
// Product search input with keyboard shortcuts

import { useRef } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useDeviceContext, MIN_MOBILE_FONT_SIZE } from '@/hooks/useDeviceContext'

interface SearchBarProps {
    value: string
    onChange: (value: string) => void
    onEnter?: () => void
    placeholder?: string
    autoFocus?: boolean
}

export function SearchBar({
    value,
    onChange,
    onEnter,
    placeholder = "Buscar por nombre o código...",
    autoFocus = true
}: SearchBarProps) {
    const inputRef = useRef<HTMLInputElement>(null)
    const { isTouch, isTouchPOS } = useDeviceContext()

    // Disable autoFocus on touch devices to prevent unexpected keyboard
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
                    // Touch-optimized sizing and font (min 16px prevents iOS zoom)
                    isTouchPOS ? "h-14 text-base pl-10" : "h-12 text-lg pl-10"
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
