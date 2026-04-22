import React, { useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { MoneyDisplay } from "@/components/shared/MoneyDisplay";
import { WarningCircle, CheckCircle, Info, ArrowUpRight, ShieldCheck, ListDashes, Vault } from "@phosphor-icons/react";
import { BaseModal } from "@/components/shared/BaseModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReportTable, ReportNode } from "@/components/shared/ReportTable";

interface CulpritAccount {
    code: string;
    name: string;
    variation: number;
    type: string;
}

interface CashFlowItem {
    name: string;
    amount: number;
    amount_comp?: number;
}

interface CashFlowData {
    // Activities
    operating: CashFlowItem[];
    total_operating: number;
    investing: CashFlowItem[];
    total_investing: number;
    financing: CashFlowItem[];
    total_financing: number;
    
    // Treasury Baseline
    beginning_cash: number;
    ending_cash: number;
    beginning_cash_comp?: number;
    ending_cash_comp?: number;
    
    // Reconciliation
    net_increase: number;
    net_increase_comp?: number;
    calculated_net_increase: number;
    discrepancy: number;
    is_balanced: boolean;
    culprit_accounts: CulpritAccount[];
}

interface CashFlowTableProps {
    data: CashFlowData;
    embedded?: boolean;
    showComparison?: boolean;
    periodLabel?: string;
    compPeriodLabel?: string;
}



const SectionHeader = ({ title, showComparison, icon: Icon }: { title: string, showComparison?: boolean, icon?: React.ElementType }) => (
    <TableRow className="bg-muted/30 font-bold border-t-2 first:border-t-0">
        <TableCell colSpan={showComparison ? 4 : 2} className="py-2.5 px-4">
            <div className="flex items-center gap-2">
                {Icon && <Icon className="h-3.5 w-3.5 text-primary" weight="bold" />}
                <span className="uppercase tracking-widest text-[10px] text-muted-foreground">{title}</span>
            </div>
        </TableCell>
    </TableRow>
);

const SectionTotal = ({ title, amount, amountComp, showComparison, variant = 'default' }: { title: string, amount: number, amountComp?: number, showComparison?: boolean, variant?: 'default' | 'highlight' }) => (
    <TableRow className={cn(
        "font-bold border-t border-muted/50 transition-colors",
        variant === 'highlight' ? "bg-muted/10 text-base" : "bg-transparent text-sm"
    )}>
        <TableCell className="pl-8 italic text-muted-foreground">{title}</TableCell>
        <TableCell className="text-right">
            <MoneyDisplay amount={amount} showColor={false} className={cn("font-mono", variant === 'highlight' ? "text-lg" : "text-sm")} />
        </TableCell>
        {showComparison && (
            <>
                <TableCell className="text-right">
                    <MoneyDisplay amount={amountComp} showColor={false} className="font-mono text-xs text-muted-foreground" />
                </TableCell>
                <TableCell className="text-right">
                    <MoneyDisplay amount={amount - (amountComp || 0)} className="font-mono text-sm" />
                </TableCell>
            </>
        )}
    </TableRow>
);

export const CashFlowTable: React.FC<CashFlowTableProps> = ({ data, embedded, showComparison, periodLabel, compPeriodLabel }) => {
    const [auditModalOpen, setAuditModalOpen] = useState(false);

    const mapToNodes = (items: CashFlowItem[]): ReportNode[] => 
        (items || []).map((item, i) => ({
            id: i,
            code: '',
            name: item.name,
            balance: item.amount,
            comp_balance: item.amount_comp,
            variance: (item.amount || 0) - (item.amount_comp || 0)
        }));

    const tableContent = (
        <div className="space-y-8">
            {/* Saldo Inicial */}
            <ReportTable 
                data={[{ id: 'init', code: 'BASE', name: 'SALDO INICIAL DE EFECTIVO (TESORERÍA)', balance: data.beginning_cash, comp_balance: data.beginning_cash_comp }]}
                accentColor="primary"
                embedded
                showComparison={showComparison}
                periodLabel={periodLabel}
                compPeriodLabel={compPeriodLabel}
            />

            {/* Operación */}
            <ReportTable 
                title="Actividades de Operación"
                data={mapToNodes(data.operating)}
                totalLabel="Flujo de Efectivo de Actividades de Operación"
                totalValue={data.total_operating}
                accentColor="success"
                embedded
                showComparison={showComparison}
                periodLabel={periodLabel}
                compPeriodLabel={compPeriodLabel}
                mode="flat"
            />

            {/* Inversión */}
            <ReportTable 
                title="Actividades de Inversión"
                data={mapToNodes(data.investing)}
                totalLabel="Flujo de Efectivo de Actividades de Inversión"
                totalValue={data.total_investing}
                accentColor="info"
                embedded
                showComparison={showComparison}
                periodLabel={periodLabel}
                compPeriodLabel={compPeriodLabel}
                mode="flat"
            />

            {/* Financiamiento */}
            <ReportTable 
                title="Actividades de Financiamiento"
                data={mapToNodes(data.financing)}
                totalLabel="Flujo de Efectivo de Actividades de Financiamiento"
                totalValue={data.total_financing}
                accentColor="destructive"
                embedded
                showComparison={showComparison}
                periodLabel={periodLabel}
                compPeriodLabel={compPeriodLabel}
                mode="flat"
            />

            {/* Resumen Final */}
            <div className="pt-4 border-t-4 border-double border-muted/30">
                <ReportTable 
                    data={[
                        { id: 'net', code: 'NET', name: 'VARIACIÓN NETA DE EFECTIVO (Actividades)', balance: data.calculated_net_increase, comp_balance: data.net_increase_comp },
                        { id: 'end', code: 'FIN', name: 'SALDO FINAL DE EFECTIVO (TESORERÍA)', balance: data.ending_cash, comp_balance: data.ending_cash_comp }
                    ]}
                    accentColor="primary"
                    embedded
                    showComparison={showComparison}
                    periodLabel={periodLabel}
                    compPeriodLabel={compPeriodLabel}
                />
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Integrity Alert Banner */}
            {!data.is_balanced && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center justify-between animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-center gap-3">
                        <WarningCircle weight="fill" className="h-6 w-6" />
                        <div>
                            <h4 className="font-black text-destructive uppercase tracking-tighter text-sm">Discrepancia detectada</h4>
                            <p className="text-xs text-muted-foreground">
                                El flujo calculado por actividades difiere en <b><MoneyDisplay amount={data.discrepancy} inline /></b> del saldo real bancario.
                            </p>
                        </div>
                    </div>
                    <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => setAuditModalOpen(true)}
                        className="font-bold uppercase tracking-widest text-[10px] h-8"
                    >
                        Auditar Diferencia
                    </Button>
                </div>
            )}

            {data.is_balanced && (
                <div className="bg-success/5 border border-success/20 rounded-lg p-3 flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-success" />
                    <span className="text-xs font-bold text-success uppercase tracking-widest">Estado: Conciliado con Tesorería</span>
                </div>
            )}

            <div className={cn(!embedded && "rounded-md border bg-card shadow-sm overflow-hidden registration-marks", !data.is_balanced && "border-destructive/30")}>
                {!embedded && (
                    <div className="p-4 border-b bg-muted/30 flex justify-between items-center">
                        <h3 className="font-bold uppercase tracking-widest text-sm text-muted-foreground">Estado de Flujo de Efectivo (M. Indirecto)</h3>
                        <Badge variant={data.is_balanced ? "outline" : "destructive"} className="text-[10px]">
                            {data.is_balanced ? "CONCILIADO" : "PENDIENTE AUDITORÍA"}
                        </Badge>
                    </div>
                )}
                {tableContent}
            </div>

            {/* Audit Modal */}
            <BaseModal
                open={auditModalOpen}
                onOpenChange={setAuditModalOpen}
                title="Auditoría de Integridad del Flujo"
                description="Listado de cuentas contables con movimientos en el periodo que NO están mapeadas a una categoría de flujo de caja."
            >
                <div className="space-y-4">
                    <div className="p-4 bg-muted/50 rounded-lg border border-dashed flex justify-between items-center">
                        <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase">Diferencia Total</p>
                            <MoneyDisplay amount={data.discrepancy} className="text-2xl font-black text-destructive" />
                        </div>
                        <Info className="h-8 w-8 text-muted-foreground opacity-30" />
                    </div>

                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/30">
                                    <TableHead className="text-[10px] font-bold uppercase">Cuenta</TableHead>
                                    <TableHead className="text-right text-[10px] font-bold uppercase">Variación</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.culprit_accounts?.map((acc, i) => (
                                    <TableRow key={i}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-mono text-[10px] text-muted-foreground">{acc.code}</span>
                                                <span className="font-bold text-xs">{acc.name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <MoneyDisplay amount={acc.variation} className="font-mono text-sm" />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <p className="text-[10px] text-muted-foreground leading-relaxed italic">
                        Tip: Para eliminar esta diferencia, accede a &quot;Configurar Mapeo&quot; y asigna estas cuentas a una de las categorías 
                        (Operación, Inversión o Financiamiento) según corresponda.
                    </p>
                </div>
            </BaseModal>
        </div>
    );
};
