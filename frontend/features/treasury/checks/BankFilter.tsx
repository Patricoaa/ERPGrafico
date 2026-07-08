"use client"

import { useCallback } from 'react'
import { useQueryState, parseAsString } from 'nuqs'
import { ChevronDown, Landmark } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useBanks } from '@/features/treasury'

export function BankFilter() {
    const [bankParam, setBankParam] = useQueryState('bank', parseAsString)
    const { banks, isLoading } = useBanks()

    const selectedBank = banks.find((b) => String(b.id) === bankParam)

    const handleChange = useCallback(
        (value: string) => {
            setBankParam(value || null)
        },
        [setBankParam],
    )

    return (
        <div className="flex items-center shrink-0 bg-background rounded-sm px-1 h-9">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                            'h-7 px-2 text-[10px] uppercase font-bold tracking-widest gap-1 rounded-sm shrink-0',
                            bankParam
                                ? 'bg-accent/50 text-foreground'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        <Landmark className="h-3 w-3" />
                        <span className="truncate max-w-[80px]">
                            {selectedBank?.name ?? 'Banco'}
                        </span>
                        <ChevronDown className="h-3 w-3 shrink-0" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[200px] p-1">
                    <DropdownMenuRadioGroup
                        value={bankParam ?? ''}
                        onValueChange={handleChange}
                    >
                        <DropdownMenuRadioItem value="" className="text-[10px] uppercase tracking-widest">
                            Todos
                        </DropdownMenuRadioItem>
                        {!isLoading && banks.map((bank) => (
                            <DropdownMenuRadioItem
                                key={bank.id}
                                value={String(bank.id)}
                                className="text-[10px] uppercase tracking-widest"
                            >
                                {bank.name}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}
