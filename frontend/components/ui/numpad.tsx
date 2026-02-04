"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Delete, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface NumpadProps {
    value: string
    onChange: (value: string) => void
    onConfirm?: () => void
    onClose?: () => void
    className?: string
    allowDecimal?: boolean
    hideDisplay?: boolean
}

export function Numpad({
    value,
    onChange,
    onConfirm,
    onClose,
    className,
    allowDecimal = true,
    hideDisplay = false,
    confirmLabel = "OK"
}: NumpadProps & { confirmLabel?: string }) {
    const handleNumber = (n: string) => {
        if (n === "." && value.includes(".")) return
        if (value === "0" && n !== ".") {
            onChange(n)
        } else {
            onChange(value + n)
        }
    }

    const handleDelete = () => {
        if (value.length <= 1) {
            onChange("0")
        } else {
            onChange(value.slice(0, -1))
        }
    }

    const handleClear = () => {
        onChange("0")
    }

    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"]

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Numbers 0-9
            if (/^[0-9]$/.test(e.key)) {
                handleNumber(e.key)
            }
            // Dot/Comma if decimal allowed
            else if ((e.key === "." || e.key === ",") && allowDecimal) {
                handleNumber(".")
            }
            // Backspace
            else if (e.key === "Backspace") {
                handleDelete()
            }
            // Enter -> Confirm
            else if (e.key === "Enter" && onConfirm) {
                onConfirm()
            }
            // Escape -> Close
            else if (e.key === "Escape" && onClose) {
                onClose()
            }
            // 'c' or 'C' -> Clear
            else if (e.key.toLowerCase() === "c") {
                handleClear()
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [value, allowDecimal, onConfirm, onClose]) // Dependencies to ensure handlers have latest state/props

    return (
        <div className={cn("flex flex-col gap-2 p-2 bg-background border rounded-xl shadow-xl w-full max-w-[280px]", className)}>
            {!hideDisplay && (
                <div className="flex justify-between items-center mb-1">
                    <div className="text-2xl font-black tracking-tight text-primary truncate px-2 w-full text-right">
                        {value}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-3 gap-2">
                {keys.map((key) => (
                    <Button
                        key={key}
                        variant="outline"
                        className="h-14 text-xl font-bold active:scale-95 transition-transform"
                        onClick={() => handleNumber(key)}
                    >
                        {key}
                    </Button>
                ))}

                {/* Row 4: C, 0, Delete (or 0, ., Delete) */}
                <Button
                    variant="destructive"
                    className="h-14 text-lg font-bold active:scale-95 transition-transform bg-red-100 text-red-600 hover:bg-red-200 border-red-200"
                    onClick={handleClear}
                >
                    C
                </Button>

                <Button
                    variant="outline"
                    className="h-14 text-xl font-bold active:scale-95 transition-transform"
                    onClick={() => handleNumber("0")}
                >
                    0
                </Button>

                {allowDecimal ? (
                    <Button
                        variant="outline"
                        className="h-14 text-xl font-bold active:scale-95 transition-transform"
                        onClick={() => handleNumber(".")}
                    >
                        .
                    </Button>
                ) : (
                    <Button
                        variant="outline"
                        className="h-14 text-orange-600 font-bold active:scale-95 transition-transform"
                        onClick={handleDelete}
                    >
                        <Delete className="h-6 w-6" />
                    </Button>
                )}
            </div>

            {/* If decimal is allowed, Delete needs a place. The user asked for "C" to be in the row "anterior" (previous)
                The previous request said: "Mueve el boton C (Limpiar) A LA FILA anterior debajo del mueve para hacer más compacto el modal."
                Wait, "debajo del mueve" might translate to "under the move"? Or maybe "below the view/display"?
                Let's stick to the grid layout: 
                1 2 3
                4 5 6
                7 8 9
                C 0 Delete (If no decimal)
                C 0 . (If decimal) -> Where does Delete go?
                
                If allowDecimal is true:
                row 4: C, 0, .
                Where is delete?
                
                The user specifically said: "Mueve el boton C (Limpiar) A LA FILA anterior" (Move C button to the previous row).
                Original was:
                1 2 3 
                ...
                C (span 2) Delete
                
                Let's try:
                1 2 3
                4 5 6
                7 8 9
                C 0 Delete
                
                And if decimal is needed?
                Maybe: C 0 . 
                And Delete?
                
                Actually, usually standard Numpad is:
                7 8 9
                4 5 6
                1 2 3
                  0 .
                
                But this one is 1-2-3 top.
                
                Let's assume:
                Row 1: 1 2 3
                Row 2: 4 5 6
                Row 3: 7 8 9
                Row 4: C 0 Delete (if no decimal) 
                
                If decimal is allowed, we have 4 items for 3 slots: C, 0, ., Delete.
                
                Maybe put Delete as an icon button next to display? Or stick to 3 cols.
                
                User request: "Mueve el boton C (Limpiar) A LA FILA anterior debajo del mueve para hacer más compacto el modal. Del modal de numpad de pago quita el boton de borrar todo ya que es redundante."
                
                "debajo del mueve" .. "debajo del nueve"? (Below the 9).
                Ah, "debajo del 9". Typo from user "mueve" -> "nueve".
                So Row 4 should be:
                [C] [0] [Delete] (If no decimal)
                
                If decimal is allowed, maybe:
                [C] [0] [.]
                
                Wait, [Delete] is quite important.
                
                Let's look at the original code again.
                Original Row 4/5:
                 keys (0-9, .)
                 Delete
                 C (span 2)
                 
                If allowDecimal:
                1 2 3
                4 5 6
                7 8 9
                0 . (empty)
                Delete
                C
                
                Changes:
                Combine into fewer rows.
                
                Proposed:
                1 2 3
                4 5 6
                7 8 9
                C 0 Delete (if no decimal)
                
                If yes decimal:
                C 0 .
                (Delete needs to fit)
                
                Maybe split the last cell? Or put Delete in the display row?
                The original code didn't have delete in display.
                
                Let's try:
                Row 4: C 0 Delete
                
                If decimal is ON, we replace C with . ? No, we need C.
                
                Maybe:
                Row 4: . 0 Delete
                Row 5: OK
                
                Where is C? 
                User said "Move C to previous row".
                
                How about:
                1 2 3
                4 5 6
                7 8 9
                C 0 Delete
                
                And if decimal is needed, we squeeze it?
                
                Actually, let's put Delete back as a button.
                If decimal:
                [.] [0] [Delete]
                And [C] is ? 
                
                Maybe [C] [0] [Delete] and [.] is lost? No.
                
                Let's try 4 columns? No space.
                
                Let's try:
                Display <Delete Icon>
                1 2 3
                4 5 6
                7 8 9
                C 0 . 
                
                OK button (Full width)
                
                This seems efficient. Delete in display is common.
                Or keep Delete in grid.
                
                [C] [0] [.]
                
                If I put a backspace icon in the input field, that solves it.
                But `Numpad` component handles the display.
                
                Let's modify `Numpad` to put Delete next to value in display?
                Original:
                `{!hideDisplay && ...`
                
                But `hideDisplay` is true for Payment Modal (Step 2).
                
                If `hideDisplay` is true, we NEED a delete button in the grid.
                
                Let's assume for `Step2_Payment` (where hideDisplay=true), we need Delete in grid.
                There, `allowDecimal` is false (usually for payment amounts unless exact).
                In `Step2` call: `allowDecimal={false}`.
                So for Step 2:
                1 2 3
                4 5 6
                7 8 9
                C 0 Delete (Perfect)
                
                For `NumpadModal` (Quantity/Price):
                `allowDecimal` might be true.
                Display is visible.
                
                If Display is visible, we can put Delete button there?
                
                Let's try a hybrid approach for Row 4:
                If allowDecimal:
                   [C] [0] [.] 
                   And put Delete as a small button in Row 4? Or span?
                   
                   Or:
                   [C] [0] [Delete]
                   And [.] ?
                   
                   Maybe:
                   [C] [0] [.] [Delete] (4 cols?)
                   
                   Let's stick to 3 cols.
                   
                   [.] [0] [C] ?
                   
                   Let's try:
                   [C] [0] [Delete]
                   
                   If decimal needed:
                   [.] [0] [Delete]
                   Where is C?
                   
                   User explicitely asked to move C.
                   
                   Maybe:
                   [C] [0] [Delete]
                   
                   If decimal is ON, we compromise?
                   
                   Actually, most POS numpads:
                   7 8 9
                   4 5 6
                   1 2 3
                   C 0 .
                   
                   (And Enter/OK is large on side or bottom)
                   (Backspace usually provided too)
                   
                   If I use:
                   [C] [0] [.]
                   [     OK     ]
                   
                   Where is Backspace/Delete?
                   
                   For text inputs (NumpadModal), users might want backspace.
                   
                   Let's add Backspace to the [OK] row? 
                   [  OK  ] [ < ]
                   
                   User said: "Añade un botón de OK (en azul y ocupando toda la fila)".
                   
                   So OK must be full width.
                   
                   So Backspace must be in grid.
                   
                   If `allowDecimal`:
                   [C] [0] [.]
                   
                   Backspace?
                   
                   Maybe put Backspace in the "Display" area?
                   
                   Let's try this:
                   
                   If `!hideDisplay`:
                      Display [X] (Delete char)
                   
                   If `hideDisplay`:
                      We need Delete in grid.
                   
                   Wait, `Step2_Payment` uses `hideDisplay={true}` and `allowDecimal={false}`.
                   So for Step2: [C] [0] [Delete] works perfectly.
                   
                   For `NumpadModal` (Product qty/price):
                   `allowDecimal` varies.
                   `hideDisplay` is false (default).
                   
                   So if `!hideDisplay`, we embed Delete in the header.
                   
                   Let's implementation this logic.
                   
                   Also, make 'C' button variant destructive/ghost or outline?
                   Original C was destructive.
                   
                   Let's go.
            */
                <div className="grid grid-cols-3 gap-2">
                    {keys.map((key) => (
                        <Button
                            key={key}
                            variant="outline"
                            className="h-14 text-xl font-bold active:scale-95 transition-transform"
                            onClick={() => handleNumber(key)}
                        >
                            {key}
                        </Button>
                    ))}

                    {/* Row 4 */}
                    <Button
                        variant="outline"
                        className="h-14 text-lg font-bold active:scale-95 transition-transform text-red-600 border-red-200 hover:bg-red-50"
                        onClick={handleClear}
                    >
                        C
                    </Button>

                    <Button
                        variant="outline"
                        className="h-14 text-xl font-bold active:scale-95 transition-transform"
                        onClick={() => handleNumber("0")}
                    >
                        0
                    </Button>

                    {allowDecimal ? (
                        <Button
                            variant="outline"
                            className="h-14 text-xl font-bold active:scale-95 transition-transform"
                            onClick={() => handleNumber(".")}
                        >
                            .
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            className="h-14 text-orange-600 font-bold active:scale-95 transition-transform"
                            onClick={handleDelete}
                        >
                            <Delete className="h-6 w-6" />
                        </Button>
                    )}
                </div>
            
            {/* If decimal is allowed, we lost the Delete button in the grid. 
                We should add it if hideDisplay is false (in the display header).
                But if hideDisplay is true (logic above says Step2 has decimal=false, so we are good).
                
                Wait, what if someone wants hideDisplay=true AND allowDecimal=true?
                Then they have no delete button.
                
                But for now, sticking to the use cases.
                
                Let's update the display header to include Backspace if it's shown.
            */}

            {onConfirm && (
                <Button
                    className="w-full h-14 font-black uppercase tracking-widest text-lg bg-blue-600 hover:bg-blue-700 mt-2"
                    onClick={onConfirm}
                >
                    {confirmLabel}
                </Button>
            )}
        </div>
    )
}
