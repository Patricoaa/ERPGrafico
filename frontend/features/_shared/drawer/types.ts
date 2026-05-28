export type DrawerMode = 'create' | 'edit' | 'view'

export interface DrawerBaseProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    mode?: DrawerMode
    onSuccess?: () => void
}
