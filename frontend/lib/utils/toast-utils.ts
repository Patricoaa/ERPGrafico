import { toast } from "sonner"
import { CSSProperties } from "react"

export const showWarningToast = (message: string) => {
    toast.warning(message, {
        style: {
            '--normal-bg': 'light-dark(var(--color-amber-600), var(--color-amber-400))',
            '--normal-text': 'var(--color-white)',
            '--normal-border': 'light-dark(var(--color-amber-600), var(--color-amber-400))',
            backgroundColor: '#d97706', // Fallback/Force amber-600 for visibility if vars fail
            color: 'white',
            borderColor: '#d97706'
        } as CSSProperties
    })
}
