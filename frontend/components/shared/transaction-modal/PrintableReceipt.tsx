import React from "react"
import { Button } from "@/components/ui/button"
import { X, Printer } from "lucide-react"
import { formatPlainDate, translateStatus, translateReceivingStatus, translatePaymentMethod, formatCurrency, cn } from "@/lib/utils"
import { useBranding } from "@/contexts/BrandingProvider"
import { formatEntityDisplay, getEntityMetadata } from "@/lib/entity-registry"
import type { TransactionData, TransactionLine } from "@/types/transactions"

const formatFullDateTime = (dateStr: string | Date | null | undefined) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return '-'

    return new Intl.DateTimeFormat('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(date)
}

export const PrintableReceipt = React.memo(React.forwardRef<HTMLDivElement, { data: any, currentType: string, mainTitle: string, subTitle: string }>(({ data, currentType, mainTitle, subTitle }, ref) => {
    const { logo, company } = useBranding()
    if (!data) return null

    const isSaleOrder = currentType === 'sale_order'
    const terminalName = data.terminal_name || data.pos_session?.terminal_name || data.session?.terminal_name

    const renderHeader = () => {
        const metadata = getEntityMetadata(
            currentType === 'sale_order' ? 'sales.saleorder' :
            currentType === 'payment' ? 'treasury.treasurymovement' :
            currentType === 'journal_entry' ? 'accounting.journalentry' :
            currentType === 'work_order' ? 'production.workorder' :
            currentType === 'sale_delivery' ? 'sales.saledelivery' :
            currentType === 'inventory' ? 'inventory.stockmove' : ''
        );

        const titleToShow = isSaleOrder ? "Comprobante de venta" : mainTitle
        const displayId = data.display_id || (metadata ? formatEntityDisplay(metadata.label, data) : (data.number || data.id));

        return (
            <div className="text-center space-y-2 mb-2 border-b border-dashed border-black/20 pb-2 flex flex-col items-center">
                {logo && (
                    <div className="mb-2 grayscale">
                        <img src={logo} alt="Logo" className="max-h-16 object-contain" />
                    </div>
                )}

                {/* Transaction Info Block (Now at the top) */}
                <div className="w-full flex flex-col items-center gap-1">
                    <h1 className="text-xs font-black uppercase tracking-widest leading-tight">{titleToShow}</h1>
                    <h2 className="text-xl font-black font-mono tracking-tighter">{displayId}</h2>
                </div>

                {/* Company Info Block (Now below transaction info) */}
                {company && (
                    <div className="pt-3 border-t border-dashed border-black/20 w-full space-y-0.5">
                        <div className="text-sm font-black uppercase tracking-tight">{company.name}</div>
                        <div className="text-[10px] font-bold">RUT: {company.tax_id}</div>
                        <div className="text-[9px] opacity-80 uppercase leading-none">{company.address}</div>
                        {company.phone && <div className="text-[9px] font-bold tracking-tighter">TEL: {company.phone}</div>}
                    </div>
                )}

                <style dangerouslySetInnerHTML={{
                    __html: `
                    @media print {
                        @page {
                            size: 80mm auto;
                            margin: 0;
                        }
                        html, body {
                            background: white !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            width: 80mm !important;
                            height: auto !important;
                            min-height: 100% !important;
                            overflow: visible !important;
                        }
                        
                        /* Override any parent visibility when printing into the react-to-print iframe */
                        body {
                            visibility: visible !important;
                        }

                        .print-section {
                            visibility: visible !important;
                            display: block !important;
                            width: 80mm !important;
                            margin: 0 !important;
                            padding: 8mm 4mm !important; 
                            background: white !important;
                            color: black !important;
                            box-shadow: none !important;
                            border: none !important;
                            height: auto !important;
                        }

                        /* Ensure ALL nested elements are visible */
                        .print-section, .print-section *:not(style):not(script) {
                            visibility: visible !important;
                        }

                        .no-print {
                            display: none !important;
                        }
                        
                        /* Forced Grayscale for all images */
                        img {
                            filter: grayscale(100%) !important;
                        }
                    }
                `}} />
            </div>
        )
    }

    const renderContextualInfo = () => {
        const contactName = (data.customer_name || data.supplier_name || data.partner_name || data.contact_name) as string | undefined
        const contactRut = (data.customer_rut || data.supplier_rut || data.partner_rut) as string | undefined

        return (
            <div className="space-y-2 mb-2 text-[11px] leading-tight">
                {/* Contact Section */}
                {contactName && (
                    <div className="pb-1">
                        <div className="font-black uppercase text-[8px] text-black/50 leading-none mb-1">Asociado a:</div>
                        <div className="font-bold uppercase tracking-tight text-[10px]">
                            {contactName} {contactRut && <span className="font-mono text-[9px] font-black opacity-80">({contactRut})</span>}
                        </div>
                        {isSaleOrder && terminalName && (
                            <div className="mt-1">
                                <span className="font-black uppercase text-[7px] text-black/40 block leading-none">Terminal / Caja:</span>
                                <span className="font-black uppercase text-[9px] tracking-tight">{String(terminalName)}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Specific Details Grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {!isSaleOrder && currentType === 'sale_order' && terminalName && (
                        <div className="col-span-2">
                            <span className="font-black uppercase text-[8px] text-black/40 block">Terminal / Caja:</span>
                            <span className="font-black uppercase">{terminalName}</span>
                        </div>
                    )}
                    {currentType === 'invoice' && (
                        <>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Tipo DTE:</span> {String(data.dte_type || '')}</div>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Folio:</span> {String(data.folio_number || data.folio || 'S/N')}</div>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Vencimiento:</span> {formatPlainDate(data.due_date)}</div>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Estado Pago:</span> {String(data.payment_status || '')}</div>
                        </>
                    )}
                    {currentType === 'payment' && (
                        <>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Método:</span> {translatePaymentMethod(String(data.payment_method || ''))}</div>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Referencia:</span> {String(data.transaction_number || data.reference || '-')}</div>
                            {data.invoice_display_id && <div className="col-span-2"><span className="font-black uppercase text-[8px] text-black/40 block">Documento Relacionado:</span> {String(data.invoice_display_id)}</div>}
                        </>
                    )}
                    {(currentType === 'sale_delivery' || currentType === 'purchase_receipt') && (
                        <>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Almacén:</span> {String(data.warehouse_name || '-')}</div>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Estado:</span> {translateReceivingStatus(String(data.status || ''))}</div>
                            {data.origin_document && <div className="col-span-2"><span className="font-black uppercase text-[8px] text-black/40 block">Origen:</span> {String(data.origin_document)}</div>}
                        </>
                    )}
                    {currentType === 'journal_entry' && (
                        <>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Diario:</span> {String(data.journal_name || '-')}</div>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Periodo:</span> {String(data.period_name || '-')}</div>
                            <div className="col-span-2"><span className="font-black uppercase text-[8px] text-black/40 block">Referencia:</span> {String(data.reference || '-')}</div>
                        </>
                    )}
                    {currentType === 'inventory' && (
                        <>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Tipo:</span> {String(data.move_type_display || '-')}</div>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Origen/Destino:</span> {String(data.warehouse_name || '-')}</div>
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
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Prioridad:</span> {String(data.priority || 'BAJA')}</div>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Progreso:</span> {String(data.completion_percentage || '0')}%</div>
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
                        {lines.map((item: TransactionLine, idx: number) => (
                            <div key={item.id || idx} className="grid grid-cols-[1fr,60px,60px] gap-1 text-[9px] leading-tight border-b border-black/5 pb-1">
                                <div className="font-bold flex flex-col">
                                    <span>{String(item.account_name || '')}</span>
                                    <span className="text-[7px] font-mono text-black/40">{String(item.account_code || '')}</span>
                                </div>
                                <div className="text-right font-mono">{Number(item.debit || 0) > 0 ? formatCurrency(Number(item.debit)) : '-'}</div>
                                <div className="text-right font-mono">{Number(item.credit || 0) > 0 ? formatCurrency(Number(item.credit)) : '-'}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )
        }

        // Logistics specific table
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
                        {lines.map((item: TransactionLine, idx: number) => (
                            <div key={item.id || idx} className="grid grid-cols-[1fr,40px,50px] gap-2 text-[10px] leading-tight border-b border-black/5 pb-1">
                                <div className="font-bold flex flex-col">
                                    <span>{item.product_name || item.product?.name || ''}</span>
                                    {item.product_code && <span className="text-[7px] font-mono text-black/40 uppercase">{item.product_code}</span>}
                                </div>
                                <div className="text-right font-black font-mono">
                                    {isOutbound ? `-${Math.round(Number(item.quantity) || 0)}` : `+${Math.round(Number(item.quantity) || 0)}`}
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

        const renderTableRow = (line: TransactionLine, idx: number) => {
            const hasDiscount = parseFloat(String(line.discount_amount || 0)) > 0;
            const quantity = Math.round(Number(line.quantity || 0));
            const deliveredQty = Math.round(Number(line.delivered_quantity !== undefined
                ? line.delivered_quantity
                : (line.qty_delivered !== undefined ? line.qty_delivered : (line.delivery_status === 'ENTREGADO' ? line.quantity : 0))));

            const isImmediate = deliveredQty === quantity;
            const productCode = line.sku || line.product_code || line.product?.sku || line.product?.default_code;

            return (
                <tr key={line.id || idx} className="border-b border-black/5 align-top text-[9px]">
                    <td className="py-1 pr-1 font-bold break-words leading-none">
                        <div className="flex flex-col">
                            <span>{line.description || line.product_name || line.product?.name}</span>
                            {productCode && <span className="text-[7px] font-mono text-black/40 uppercase mt-0.5">{productCode}</span>}
                            {!isSaleOrder && line.delivery_status && (
                                <span className={cn(
                                    "text-[7px] font-black uppercase inline-block w-fit px-1 rounded-sm mt-0.5",
                                    line.delivery_status === 'ENTREGADO' ? "bg-black/5 text-black" : "bg-black text-white"
                                )}>
                                    {line.delivery_status === 'ENTREGADO' ? '✓ Ent.' : '⏳ Pend.'}
                                </span>
                            )}
                        </div>
                    </td>
                    <td className="py-1 text-center font-mono w-8">{quantity}</td>
                    <td className="py-1 text-right font-mono w-14">{formatCurrency(Number(line.unit_price_gross || line.unit_price || line.unit_cost || 0))}</td>
                    <td className="py-1 text-right font-mono w-10 text-black/60">{hasDiscount ? `-${formatCurrency(Number(line.discount_amount || 0))}` : '-'}</td>
                    <td className="py-1 text-right font-black font-mono w-16">
                        {formatCurrency(Number(line.subtotal || line.amount || (Number(line.unit_price ?? 0) * Number(line.quantity ?? 0)) || 0))}
                    </td>
                    {isSaleOrder && (
                        <td className="py-1 text-center font-mono w-10">
                            {deliveredQty}{!isImmediate && <span className="font-black text-[10px] ml-0.5">*</span>}
                        </td>
                    )}
                </tr>
            )
        }

        return (
            <div className="mb-4 pt-2 border-y-2 border-black">
                {isSaleOrder && (
                    <div className="text-[9px] font-black uppercase mb-2 border-b border-dashed border-black/20 pb-1">
                        Detalle de los Productos
                    </div>
                )}
                <table className="w-full border-collapse mb-1">
                    <thead>
                        <tr className="border-b border-black text-[7px] font-black uppercase tracking-widest text-left">
                            <th className="pb-1 pl-0">Descripción</th>
                            <th className="pb-1 text-center w-8">Cant</th>
                            <th className="pb-1 text-right w-14">P. Uni</th>
                            <th className="pb-1 text-right w-10">Desc</th>
                            <th className="pb-1 text-right w-16">Total</th>
                            {isSaleOrder && <th className="pb-1 text-center w-10">Ent.</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {lines.map((line: any, idx: number) => renderTableRow(line, idx))}
                    </tbody>
                </table>
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

        const totalValue = data.total || data.amount
        const lines = data.lines || data.items || []
        const totalLineDiscounts = lines.reduce((acc: number, cur: any) => acc + parseFloat(String(cur.discount_amount || 0)), 0)

        return (
            <div className="pt-2 space-y-1">
                {data.total_net !== undefined && (
                    <div className="flex justify-between text-[9px] font-bold opacity-60">
                        <span className="uppercase tracking-wider">Subtotal Neto:</span>
                        <span className="font-mono">{formatCurrency(data.total_net || 0)}</span>
                    </div>
                )}

                {/* Always show discount rows for Sale Orders */}
                <div className="flex justify-between text-[9px] font-bold opacity-60">
                    <span className="uppercase tracking-wider">Descuento Unitario:</span>
                    <span className="font-mono">{totalLineDiscounts > 0 ? `-${formatCurrency(totalLineDiscounts)}` : formatCurrency(0)}</span>
                </div>
                <div className="flex justify-between text-[9px] font-bold opacity-60">
                    <span className="uppercase tracking-wider">Descuento Global:</span>
                    <span className="font-mono">{parseFloat(String(data.total_discount_amount || 0)) > 0 ? `-${formatCurrency(Number(data.total_discount_amount))}` : formatCurrency(0)}</span>
                </div>

                {data.total_tax !== undefined && (
                    <div className="flex justify-between text-[9px] font-bold opacity-60">
                        <span className="uppercase tracking-wider">IVA (19%):</span>
                        <span className="font-mono">{formatCurrency(data.total_tax || 0)}</span>
                    </div>
                )}
                <div className="flex justify-between items-center py-2 border-y border-black/10 mt-2 bg-black/5 px-1">
                    <span className="text-xs font-black uppercase tracking-tight">Total Final:</span>
                    <span className="text-xl font-black font-mono tracking-tighter">{formatCurrency(totalValue)}</span>
                </div>

                {isSaleOrder && (
                    <div className="pt-2 pb-1 space-y-1">
                        <div className="flex justify-between text-[10px] font-black uppercase">
                            <span>Medio de Pago:</span>
                            <span className="font-mono">{translatePaymentMethod(data.payment_method || (data.related_documents as any)?.payments?.[0]?.payment_method || 'CASH')}</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-black uppercase">
                            <span>Pagado:</span>
                            <span className="font-mono">{formatCurrency(data.total_paid || 0)}</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-black uppercase">
                            <span>Pendiente:</span>
                            <span className="font-mono">{formatCurrency(Math.max(0, Number(totalValue) - Number(data.total_paid || 0)))}</span>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div
            ref={ref}
            className="print:block print-section w-[80mm] mx-auto bg-white text-black font-sans relative hidden p-4"
        >
            {renderHeader()}
            {renderContextualInfo()}
            {renderItemsTable()}
            {renderTotals()}
 
            {/* Payments Section (Moved from items table to here) */}
            {(data.related_documents as any)?.payments && (data.related_documents as any).payments.length > 0 && (
                <div className="mt-2 border-t border-dashed border-black/20 pt-2">
                    <p className="text-[8px] font-black uppercase mb-1">Pagos Registrados:</p>
                    {(data.related_documents as any).payments.map((pay: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center py-0.5">
                            <div className="flex flex-col">
                                <div className="text-[9px] font-bold uppercase tracking-tight">
                                    {String(pay.payment_method_display || pay.method || pay.payment_method || 'Otro')}
                                </div>
                                <div className="text-[8px] opacity-70">
                                    {formatFullDateTime(pay.date ? String(pay.date) : (pay.created_at ? String(pay.created_at) : ''))}
                                </div>
                            </div>
                            <div className="font-black text-[10px]">
                                {formatCurrency(Number(pay.amount || 0))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isSaleOrder && (
                (() => {
                    const lines = data.lines || data.items || []
                    const hasPending = lines.some((line: any) => {
                        const qty = Math.round(Number(line.quantity) || 0)
                        const delivered = Math.round(Number(line.delivered_quantity !== undefined
                            ? line.delivered_quantity
                            : (line.qty_delivered !== undefined ? line.qty_delivered : (line.delivery_status === 'ENTREGADO' ? line.quantity : 0))))
                        return delivered < qty
                    })
                    const deliveryDate = (data.expected_delivery_date || data.scheduled_date || data.delivery_date) as string | undefined

                    if (!hasPending && !deliveryDate) return null

                    return (
                        <div className="mt-2 border-y-2 border-black py-2">
                            <p className="text-[8px] font-black uppercase mb-1 underline">Observaciones:</p>
                            <p className="text-[9px] leading-tight italic">
                                (*) Productos con entrega pendiente.
                                {deliveryDate && (
                                    <span className="block mt-1">Fecha estimada de entrega: {formatPlainDate(deliveryDate)}</span>
                                )}
                            </p>
                        </div>
                    )
                })()
            )}

            <div className="mt-8 text-center space-y-2 pt-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-black/40">Gracias por su preferencia</p>
                <p className="text-[8px] font-mono text-black/20 italic">Generado por ERPGrafico</p>
            </div>
        </div>
    )
}))

PrintableReceipt.displayName = "PrintableReceipt"
