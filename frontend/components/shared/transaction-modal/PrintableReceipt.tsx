import React from "react"
import { Button } from "@/components/ui/button"
import { X, Printer } from "lucide-react"
import { formatPlainDate, translateStatus, translateReceivingStatus, translatePaymentMethod, formatCurrency, cn } from "@/lib/utils"
import { useBranding } from "@/contexts/BrandingProvider"

export const PrintableReceipt = React.memo(({ data, currentType, mainTitle, subTitle, onClose, isPreview = false }: { data: any, currentType: string, mainTitle: string, subTitle: string, onClose?: () => void, isPreview?: boolean }) => {
    const { logo } = useBranding()
    if (!data) return null

    const renderHeader = () => (
        <div className="text-center space-y-1 mb-4 border-b-2 border-black pb-4 flex flex-col items-center">
            {logo && (
                <div className="mb-2">
                    <img src={logo} alt="Logo" className="max-h-16 object-contain" />
                </div>
            )}
            <h1 className="text-sm font-black uppercase tracking-widest leading-tight">{mainTitle}</h1>
            <h2 className="text-lg font-black font-mono tracking-tighter">{subTitle}</h2>
            <p className="text-[10px] font-bold uppercase text-black/60">{formatPlainDate(data.date || data.created_at)}</p>
        </div>
    )

    const renderContextualInfo = () => {
        const contactName = data.customer_name || data.supplier_name || data.partner_name || data.contact_name
        const contactRut = data.customer_rut || data.supplier_rut || data.partner_rut

        return (
            <div className="space-y-4 mb-4 text-[11px] leading-tight">
                {/* Contact Section */}
                {contactName && (
                    <div className="border-b border-black/10 pb-2">
                        <div className="font-black uppercase text-[9px] text-black/50">Asociado a:</div>
                        <div className="font-bold uppercase tracking-tight">{contactName}</div>
                        {contactRut && <div className="font-mono text-[10px] opacity-70">{contactRut}</div>}
                    </div>
                )}

                {/* Specific Details Grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    {currentType === 'sale_order' && (
                        <>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Vendedor:</span> {data.salesperson_name || 'N/A'}</div>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Canal:</span> {data.channel || 'SISTEMA'}</div>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Estado:</span> {translateStatus(data.status)}</div>
                        </>
                    )}
                    {currentType === 'invoice' && (
                        <>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Tipo DTE:</span> {data.dte_type}</div>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Folio:</span> {data.folio_number || 'S/N'}</div>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Vencimiento:</span> {formatPlainDate(data.due_date)}</div>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Estado Pago:</span> {data.payment_status}</div>
                        </>
                    )}
                    {currentType === 'payment' && (
                        <>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Método:</span> {translatePaymentMethod(data.payment_method)}</div>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Referencia:</span> {data.transaction_number || data.reference || '-'}</div>
                            {data.invoice_display_id && <div className="col-span-2"><span className="font-black uppercase text-[8px] text-black/40 block">Documento Relacionado:</span> {data.invoice_display_id}</div>}
                        </>
                    )}
                    {(currentType === 'sale_delivery' || currentType === 'purchase_receipt') && (
                        <>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Almacén:</span> {data.warehouse_name || '-'}</div>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Estado:</span> {translateReceivingStatus(data.status)}</div>
                            {data.origin_document && <div className="col-span-2"><span className="font-black uppercase text-[8px] text-black/40 block">Origen:</span> {data.origin_document}</div>}
                        </>
                    )}
                    {currentType === 'journal_entry' && (
                        <>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Diario:</span> {data.journal_name || '-'}</div>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Periodo:</span> {data.period_name || '-'}</div>
                            <div className="col-span-2"><span className="font-black uppercase text-[8px] text-black/40 block">Referencia:</span> {data.reference || '-'}</div>
                        </>
                    )}
                    {currentType === 'inventory' && (
                        <>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Tipo:</span> {data.move_type_display || '-'}</div>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Origen/Destino:</span> {data.warehouse_name || '-'}</div>
                        </>
                    )}
                    {currentType === 'cash_movement' && (
                        <>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Origen:</span> {data.from_container_name || 'Ext.'}</div>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Destino:</span> {data.to_container_name || 'Ext.'}</div>
                        </>
                    )}
                    {currentType === 'work_order' && (
                        <>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Prioridad:</span> {data.priority || 'BAJA'}</div>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Progreso:</span> {data.completion_percentage}%</div>
                        </>
                    )}
                </div>
            </div>
        )
    }

    const renderItemsTable = () => {
        const lines = data.lines || data.items || []
        if (lines.length === 0) return null

        // Accounting specific table
        if (currentType === 'journal_entry') {
            return (
                <div className="mb-4">
                    <div className="grid grid-cols-[1fr,60px,60px] gap-1 border-b-2 border-black pb-1 mb-1 text-[8px] font-black uppercase tracking-widest">
                        <div>Cuenta</div>
                        <div className="text-right">Debe</div>
                        <div className="text-right">Haber</div>
                    </div>
                    <div className="space-y-2">
                        {lines.map((item: any, idx: number) => (
                            <div key={item.id || idx} className="grid grid-cols-[1fr,60px,60px] gap-1 text-[9px] leading-tight border-b border-black/5 pb-1">
                                <div className="font-bold flex flex-col">
                                    <span>{item.account_name}</span>
                                    <span className="text-[7px] font-mono text-black/40">{item.account_code}</span>
                                </div>
                                <div className="text-right font-mono">{Number(item.debit) > 0 ? formatCurrency(item.debit) : '-'}</div>
                                <div className="text-right font-mono">{Number(item.credit) > 0 ? formatCurrency(item.credit) : '-'}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )
        }

        // Logistics specific table (PrintableReceipt)
        if (currentType === 'sale_delivery' || currentType === 'purchase_receipt') {
            const isOutbound = currentType === 'sale_delivery';
            return (
                <div className="mb-4">
                    <div className="grid grid-cols-[1fr,40px,50px] gap-2 border-b-2 border-black pb-1 mb-1 text-[8px] font-black uppercase tracking-widest">
                        <div>Producto</div>
                        <div className="text-right">Cant</div>
                        <div className="text-center">UOM</div>
                    </div>
                    <div className="space-y-2">
                        {lines.map((item: any, idx: number) => (
                            <div key={item.id || idx} className="grid grid-cols-[1fr,40px,50px] gap-2 text-[10px] leading-tight border-b border-black/5 pb-1">
                                <div className="font-bold flex flex-col">
                                    <span>{item.product_name || item.product?.name}</span>
                                    {item.product_code && <span className="text-[7px] font-mono text-black/40 uppercase">{item.product_code}</span>}
                                </div>
                                <div className="text-right font-black font-mono">
                                    {isOutbound ? `-${Math.round(item.quantity || 0)}` : `+${Math.round(item.quantity || 0)}`}
                                </div>
                                <div className="text-center font-bold text-[8px] uppercase text-black/60 pt-0.5">
                                    {item.uom_name || item.uom?.name || 'UN'}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )
        }

        return (
            <div className="mb-4">
                <div className="grid grid-cols-[1fr,30px,50px,40px,60px] gap-1 border-b-2 border-black pb-1 mb-1 text-[7px] font-black uppercase tracking-widest">
                    <div>Descripción</div>
                    <div className="text-center">Cant</div>
                    <div className="text-right">P. Unit</div>
                    <div className="text-right">Desc.</div>
                    <div className="text-right">Total</div>
                </div>
                <div className="space-y-2">
                    {lines.map((line: any, idx: number) => {
                        const hasDiscount = parseFloat(line.discount_amount || 0) > 0;
                        return (
                            <div key={line.id || idx} className="grid grid-cols-[1fr,30px,50px,40px,60px] gap-1 text-[9px] leading-tight border-b border-black/5 pb-1">
                                <div className="font-bold flex flex-col">
                                    <span>{line.description || line.product_name}</span>
                                    {line.product_code && <span className="text-[7px] font-mono text-black/40 uppercase">{line.product_code}</span>}
                                </div>
                                <div className="text-center font-mono">{Math.round(line.quantity || 0)}</div>
                                <div className="text-right font-mono">{formatCurrency(line.unit_price_gross || line.unit_price || line.unit_cost)}</div>
                                <div className="text-right font-mono text-black/60">{hasDiscount ? `-${formatCurrency(line.discount_amount)}` : '-'}</div>
                                <div className="text-right font-black font-mono">
                                    {formatCurrency(line.subtotal || line.amount || (line.unit_price * line.quantity) || 0)}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    const renderTotals = () => {
        if (currentType === 'payment' || currentType === 'cash_movement') {
            return (
                <div className="border-t-2 border-black pt-4 text-center">
                    <div className="text-[10px] font-black uppercase text-black/50 tracking-widest">Total Movimiento</div>
                    <div className="text-2xl font-black font-mono tracking-tighter">{formatCurrency(data.amount)}</div>
                </div>
            )
        }

        if (currentType === 'journal_entry') {
            const lines = data.lines || data.items || []
            const totalDebit = lines.reduce((acc: number, cur: any) => acc + Number(cur.debit), 0)
            const totalCredit = lines.reduce((acc: number, cur: any) => acc + Number(cur.credit), 0)

            return (
                <div className="border-t-2 border-black pt-2 space-y-1">
                    <div className="flex justify-between text-[10px] font-bold">
                        <span className="uppercase">Total Debe:</span>
                        <span className="font-mono">{formatCurrency(totalDebit)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold">
                        <span className="uppercase">Total Haber:</span>
                        <span className="font-mono">{formatCurrency(totalCredit)}</span>
                    </div>
                    <div className="pt-2 border-t border-dashed border-black/20 flex justify-center">
                        <span className="text-[8px] font-black uppercase text-black/40">Asiento Cuadrado</span>
                    </div>
                </div>
            )
        }

        if (!data.total && !data.amount) return null

        const totalValue = data.total || data.amount

        return (
            <div className="border-t-2 border-black pt-2 space-y-1">
                {data.total_net !== undefined && (
                    <div className="flex justify-between text-[9px] font-bold opacity-60">
                        <span className="uppercase tracking-wider">Subtotal Neto:</span>
                        <span className="font-mono">{formatCurrency(data.total_net || 0)}</span>
                    </div>
                )}
                {data.total_tax !== undefined && (
                    <div className="flex justify-between text-[9px] font-bold opacity-60">
                        <span className="uppercase tracking-wider">IVA (19%):</span>
                        <span className="font-mono">{formatCurrency(data.total_tax || 0)}</span>
                    </div>
                )}
                {parseFloat(data.total_discount_amount || 0) > 0 && (
                    <div className="flex justify-between text-[9px] font-black text-red-600">
                        <span className="uppercase tracking-wider">Descuento Global:</span>
                        <span className="font-mono">-{formatCurrency(data.total_discount_amount)}</span>
                    </div>
                )}
                <div className="flex justify-between items-center pt-2 mt-1 border-t border-dashed border-black/20">
                    <span className="text-xs font-black uppercase tracking-tight">Total Final:</span>
                    <span className="text-xl font-black font-mono tracking-tighter">{formatCurrency(totalValue)}</span>
                </div>
            </div>
        )
    }

    return (
        <div className={cn(
            "print:block w-[80mm] mx-auto bg-white text-black font-sans relative",
            isPreview ? "block p-6 rounded-2xl shadow-2xl border border-black/5" : "hidden p-4"
        )}>
            {/* Close button for preview */}
            {onClose && (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-white shadow-lg border border-black/10 hover:bg-black/5 print:hidden group z-10"
                >
                    <X className="h-4 w-4 text-black group-hover:scale-110 transition-transform" />
                </Button>
            )}

            {renderHeader()}
            {renderContextualInfo()}
            {renderItemsTable()}
            {renderTotals()}

            <div className="mt-8 text-center space-y-2 border-t border-black/10 pt-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-black/40">Gracias por su preferencia</p>
                <p className="text-[8px] font-mono text-black/20 italic">Generado por ERPGrafico</p>
            </div>

            {/* Print button inside preview */}
            {isPreview && (
                <div className="mt-6 pt-6 border-t border-dashed border-black/20 flex justify-center print:hidden">
                    <Button
                        onClick={() => window.print()}
                        className="bg-black text-white hover:bg-black/90 font-black uppercase tracking-widest text-[10px] h-10 px-8 rounded-xl shadow-lg border-2 border-black"
                    >
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimir Ahora
                    </Button>
                </div>
            )}
        </div>
    )
})

PrintableReceipt.displayName = "PrintableReceipt"
