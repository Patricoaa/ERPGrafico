"use client"

import { WorkOrderWizard } from "@/components/production/WorkOrderWizard"

// ... existing code ...

export function OrderCommandCenter({
    orderId,
    type,
    open,
    onOpenChange,
    onActionSuccess
}: OrderCommandCenterProps) {
    const [order, setOrder] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [userPermissions, setUserPermissions] = useState<string[]>([])
    const [detailsModal, setDetailsModal] = useState<{ open: boolean, type: any, id: number | string }>({ open: false, type: 'sale_order', id: 0 })
    const [otWizard, setOtWizard] = useState<{ open: boolean, id: number | null }>({ open: false, id: null })
    const [trForm, setTrForm] = useState<{ open: boolean, id: number | null, initialValue: string }>({
        open: false,
        id: null,
        initialValue: ""
    })
    const actionEngineRef = useRef<any>(null)

    // ... existing code ...

    const openDetails = (docType: string, docId: number | string) => {
        if (docType === 'work_order') {
            setOtWizard({ open: true, id: Number(docId) })
            return
        }
        setDetailsModal({ open: true, type: docType, id: docId })
    }

    // ... existing code ...

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                {/* ... existing DialogContent ... */}
            </Dialog >

            <TransactionViewModal
                open={detailsModal.open}
                onOpenChange={(isOpen) => setDetailsModal(prev => ({ ...prev, open: isOpen }))}
                type={detailsModal.type}
                id={detailsModal.id}
                view="details"
            />

            {otWizard.id && (
                <WorkOrderWizard
                    orderId={otWizard.id}
                    open={otWizard.open}
                    onOpenChange={(isOpen) => setOtWizard(prev => ({ ...prev, open: isOpen }))}
                    onSuccess={() => {
                        fetchOrderDetails()
                        onActionSuccess?.()
                    }}
                />
            )}

            <TransactionNumberForm
                open={trForm.open}
                onOpenChange={(isOpen) => setTrForm(prev => ({ ...prev, open: isOpen }))}
                paymentId={trForm.id}
                initialValue={trForm.initialValue}
                onSuccess={fetchOrderDetails}
            />
        </>
    )
}


function PhaseCard({
    title,
    icon: Icon,
    children,
    actions,
    order,
    userPermissions,
    onActionSuccess,
    variant = 'neutral',
    documents = [],
    onViewDetail,
    emptyMessage = "No disponible",
    actionEngineRef,
    showDocProgress = false,
    stageId = '',
    isComplete = false
}: any) {
    const isSuccess = variant === 'success' || isComplete
    const isActive = variant === 'active'

    const variantStyles: Record<string, string> = {
        success: 'border-green-500/40 bg-green-500/5 shadow-[0_0_20px_rgba(34,197,94,0.1)]',
        active: 'border-primary/40 bg-primary/5 shadow-[0_0_20px_rgba(var(--primary),0.1)]',
        neutral: 'border-white/10 bg-white/5',
    }

    const iconStyles: Record<string, string> = {
        success: 'bg-green-500/20 text-green-400',
        active: 'bg-primary/20 text-primary',
        neutral: 'bg-white/10 text-muted-foreground',
    }

    const statusDot: Record<string, string> = {
        success: 'bg-green-500 shadow-green-500/50',
        active: 'bg-primary shadow-primary/50 animate-pulse',
        neutral: 'bg-white/20',
    }

    // Separate actions into primary (closing) and secondary
    const categorizedActions = (() => {
        const filtered = actions?.filter((action: any) => {
            if (action.requiredPermissions && !action.requiredPermissions.some((p: string) => userPermissions.includes(p))) {
                return false
            }
            if (action.checkAvailability && !action.checkAvailability(order)) {
                return false
            }
            return true
        }) || []

        const secondaryIds = ['history', 'note', 'view-']
        const secondary = filtered.filter((a: any) => secondaryIds.some(id => a.id.toLowerCase().includes(id)))
        const primary = filtered.filter((a: any) => !secondaryIds.some(id => a.id.toLowerCase().includes(id)))

        return { primary, secondary }
    })()

    return (
        <Card className={cn(
            "flex flex-col h-full transition-all duration-500 border-2 rounded-3xl relative overflow-hidden backdrop-blur-sm group/card",
            variantStyles[isSuccess ? 'success' : (isActive ? 'active' : 'neutral')],
            "hover:translate-y-[-4px] hover:shadow-2xl hover:border-white/20",
            isSuccess && "animate-in fade-in zoom-in-95 duration-700"
        )}>
            {/* Background Gradient for Success */}
            {isSuccess && (
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent pointer-events-none" />
            )}

            <div className="p-4 border-b border-white/5 flex items-center gap-3 bg-white/5">
                <div className={cn("p-2 rounded-xl shadow-inner transition-transform duration-500 group-hover/card:scale-110", iconStyles[isSuccess ? 'success' : (isActive ? 'active' : 'neutral')])}>
                    {isSuccess ? <div className="relative">
                        <Icon className="h-4 w-4" />
                        <div className="absolute -top-1 -right-1 bg-green-500 rounded-full border-2 border-background">
                            <svg className="w-2 h-2 text-white" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        </div>
                    </div> : <Icon className="h-4 w-4" />}
                </div>
                <div className="flex-1">
                    <h3 className="font-black text-[12px] uppercase tracking-widest text-foreground/90 leading-none">
                        {title}
                    </h3>
                </div>
                <div className={cn("w-2 h-2 rounded-full shadow-[0_0_8px]", statusDot[isSuccess ? 'success' : (isActive ? 'active' : 'neutral')])} />
            </div>

            <CardContent className="p-5 flex-1 flex flex-col gap-6 relative z-10">
                {/* Documents List - Flat Design */}
                <div className="space-y-2 min-h-[60px]">
                    {documents.length > 0 ? (
                        documents.map((doc: any, i: number) => (
                            <div key={i} className="flex flex-col p-3 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all duration-300 gap-2 group/doc shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="p-2 bg-background/50 rounded-xl shadow-sm shrink-0">
                                            <doc.icon className="h-4 w-4 text-primary/80" />
                                        </div>
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="text-[11px] font-black text-foreground/90 truncate max-w-[140px]" title={doc.number}>{doc.number}</span>
                                            {doc.status && (
                                                <span className="text-[8px] font-black uppercase text-muted-foreground/40 tracking-widest">{doc.status}</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 opacity-40 group-hover/doc:opacity-100 transition-opacity">
                                        {doc.actions?.map((action: any, idx: number) => (
                                            <Button
                                                key={idx}
                                                variant="ghost"
                                                size="icon"
                                                className={cn("h-7 w-7 rounded-lg", action.color, action.isPrimary && "animate-[pulse-glow_2s_infinite] bg-primary/10")}
                                                onClick={(e) => { e.stopPropagation(); action.onClick() }}
                                                title={action.title}
                                            >
                                                <action.icon className="h-4 w-4" />
                                            </Button>
                                        ))}

                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/20 rounded-lg"
                                            onClick={() => !doc.disabled && onViewDetail?.(doc.docType, doc.id)}
                                            disabled={doc.disabled}
                                            title="Ver Detalles"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                {showDocProgress && (doc.progressValue !== undefined) && (
                                    <div className="px-1">
                                        <div className="flex items-center justify-between text-[8px] font-black uppercase mb-1 text-muted-foreground/40 tracking-widest">
                                            <span>Avance</span>
                                            <span>{Math.round(doc.progressValue)}%</span>
                                        </div>
                                        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full bg-primary/50 transition-all duration-700" style={{ width: `${doc.progressValue}%` }} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-6 border border-dashed border-white/10 rounded-2xl bg-white/2">
                            <Info className="h-5 w-5 text-muted-foreground/20 mb-2" />
                            <span className="text-[10px] text-muted-foreground/40 font-black uppercase tracking-widest">{emptyMessage}</span>
                        </div>
                    )}
                </div>

                <div className="flex-1 flex flex-col justify-center">
                    {children}
                </div>

                {/* Actions Section */}
                <div className="mt-auto space-y-4">
                    {isSuccess ? (
                        <div className="flex flex-col items-center justify-center py-5 px-3 border border-dotted border-white/10 rounded-2xl bg-white/2">
                            <Settings2 className="h-5 w-5 text-muted-foreground/10 mb-2" />
                            <span className="text-[9px] text-muted-foreground/30 font-black uppercase tracking-widest">Etapa Completada</span>
                        </div>
                    ) : (
                        categorizedActions.primary.length > 0 && (
                            <div className="space-y-3">
                                <div className="h-px bg-white/5 w-full" />
                                <ActionCategory
                                    category={{ actions: categorizedActions.primary } as any}
                                    order={order}
                                    userPermissions={userPermissions}
                                    onActionSuccess={onActionSuccess}
                                    layout="grid"
                                    compact={true}
                                />
                            </div>
                        )
                    )}

                    {categorizedActions.secondary.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 px-1">
                                <div className="h-[1px] bg-white/5 flex-1" />
                                <span className="text-[7px] font-black uppercase tracking-[0.2em] text-muted-foreground/30">Opciones</span>
                                <div className="h-[1px] bg-white/5 flex-1" />
                            </div>
                            <ActionCategory
                                category={{ actions: categorizedActions.secondary } as any}
                                order={order}
                                userPermissions={userPermissions}
                                onActionSuccess={onActionSuccess}
                                layout="grid"
                                compact={true}
                            />
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

function PhaseConnector({ active, complete }: { active: boolean, complete: boolean }) {
    return (
        <div className="hidden lg:flex absolute top-1/2 -right-2 transform -translate-y-1/2 z-0 items-center justify-center w-4 h-full">
            <div className={cn(
                "w-full h-[2px] transition-all duration-1000 ease-in-out",
                complete ? "bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]" :
                    active ? "bg-primary shadow-[0_0_15px_rgba(var(--primary),0.5)]" :
                        "bg-white/10"
            )} />
            <div className={cn(
                "absolute w-2 h-2 rounded-full transition-all duration-1000",
                complete ? "bg-green-500 scale-125" :
                    active ? "bg-primary animate-pulse" :
                        "bg-white/20"
            )} />
        </div>
    )
}
