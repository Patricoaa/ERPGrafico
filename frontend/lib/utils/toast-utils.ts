import { toast } from "sonner"
import { CSSProperties } from "react"

export const showWarningToast = (message: string) => {
    toast.warning(message, {
        style: {
            '--normal-bg': 'light-dark(var(--color-amber-600), var(--color-amber-400))',
            '--normal-text': 'var(--color-white)',
            '--normal-border': 'light-dark(var(--color-amber-600), var(--color-amber-400))',
            backgroundColor: 'var(--warning)', // Fallback/Force amber-600 for visibility if vars fail
            color: 'var(--warning-foreground)',
            borderColor: 'var(--warning)'
        } as CSSProperties
    })
}
