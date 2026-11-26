"use client";

import React, { useState } from 'react';
import { Collection, useEntityCollection } from "@/components/entity-view";
import { cn } from "@/lib/utils";
import {AlertCircle, Info, Calendar} from "lucide-react";
import { Banner, BaseModal, Chip, MoneyDisplay } from '@/components/shared';
import type { CulpritAccount, MaturityItem, ReportNode } from '../types';
import { FinancialStatementTable } from './FinancialStatementTable';
import { cashFlowCulpritEntity, cashFlowCulpritViews, cashFlowMaturityEntity, cashFlowMaturityViews, toMaturityRows } from '../entity-view/cashFlow.entity';
import { Button } from "@/components/ui/button";

interface CashFlowItem {
    name: string;
    amount: number;
    amount_comp?: number;
}

export interface CashFlowData {
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
    calculated_net_increase_comp?: number;
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
    futureMaturities?: MaturityItem[];
}

export const CashFlowTable: React.FC<CashFlowTableProps> = ({ data, embedded, showComparison, periodLabel, compPeriodLabel, futureMaturities }) => {
    const [auditModalOpen, setAuditModalOpen] = useState(false);
    const maturities = React.useMemo(() => toMaturityRows(futureMaturities ?? []), [futureMaturities]);
    const maturityCollection = useEntityCollection(cashFlowMaturityEntity, { rows: maturities, rowCount: maturities.length }, { pagination: { mode: "none" } });
    const culprits = data.culprit_accounts ?? [];
    const culpritCollection = useEntityCollection(cashFlowCulpritEntity, { rows: culprits, rowCount: culprits.length }, { pagination: { mode: "none" } });

    const mapToNodes = (items: CashFlowItem[], activity: string): ReportNode[] => 
        (items || []).map((item, i) => ({
            id: `${activity}-${i}`,
            code: '',
            name: item.name,
            balance: item.amount,
            comp_balance: item.amount_comp,
            variance: (item.amount || 0) - (item.amount_comp || 0)
        }));

    const unifiedData: ReportNode[] = [
        { 
            id: 'init', 
            code: 'BASE', 
            name: 'SALDO INICIAL DE EFECTIVO (TESORERÍA)', 
            balance: data.beginning_cash, 
            comp_balance: data.beginning_cash_comp,
            isTotalRow: true
        },
        {
            id: 'op',
            code: '',
            name: 'Actividades de Operación',
            balance: data.total_operating,
            children: mapToNodes(data.operating, 'operating'),
        },
        {
            id: 'inv',
            code: '',
            name: 'Actividades de Inversión',
            balance: data.total_investing,
            children: mapToNodes(data.investing, 'investing'),
        },
        {
            id: 'fin',
            code: '',
            name: 'Actividades de Financiamiento',
            balance: data.total_financing,
            children: mapToNodes(data.financing, 'financing'),
        },
        { 
            id: 'net', 
            code: 'NET', 
            name: 'VARIACIÓN NETA DE EFECTIVO (Actividades)', 
            balance: data.calculated_net_increase, 
            comp_balance: data.calculated_net_increase_comp,
            isTotalRow: true
        },
        { 
            id: 'end', 
            code: 'FIN', 
            name: 'SALDO FINAL DE EFECTIVO (TESORERÍA)', 
            balance: data.ending_cash, 
            comp_balance: data.ending_cash_comp,
            isTotalRow: true
        }
    ];

    const tableContent = (
        <div className="space-y-8">
            <FinancialStatementTable
                data={unifiedData}
                showComparison={showComparison}
                periodLabel={periodLabel}
                compPeriodLabel={compPeriodLabel}
            />

            {/* Vencimientos Futuros (F5.3) */}
            {futureMaturities && futureMaturities.length > 0 && (
                <div className="pt-4 border-t-2 border-muted/30">
                    <div className="flex items-center gap-2 mb-3">
                        <Calendar className="h-4 w-4 text-primary" />
                        <span className="text-3xs font-bold uppercase text-muted-foreground tracking-widest">Vencimientos Futuros (Proyectado)</span>
                    </div>
                    <Collection.Root collection={maturityCollection} label="Vencimientos futuros">
                        <Collection.View table={cashFlowMaturityViews.table} />
                    </Collection.Root>
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Integrity Alert Banner */}
            {!data.is_balanced && (
                <Banner
                    tone="destructive"
                    title="Discrepancia detectada"
                    actions={
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setAuditModalOpen(true)}
                            className="font-medium uppercase tracking-widest text-3xs h-control-sm"
                        >
                            Auditar Diferencia
                        </Button>
                    }
                >
                    El flujo calculado por actividades difiere en <b><MoneyDisplay amount={data.discrepancy} inline weight="bold" /></b> del saldo real bancario.
                </Banner>
            )}

            {data.is_balanced && (
                <Banner tone="success" title="Estado: Conciliado con Tesorería" />
            )}

            <div className={cn(!embedded && "surface-panel shadow-card overflow-hidden", !data.is_balanced && "border-destructive/30")}>
                {!embedded && (
                    <div className="p-4 border-b bg-muted/30 flex justify-between items-center">
                        <h3 className="font-bold uppercase tracking-widest text-sm text-muted-foreground">Estado de Flujo de Efectivo (M. Indirecto)</h3>
                        <Chip size="xs" intent={data.is_balanced ? "neutral" : "destructive"}>
                            {data.is_balanced ? "CONCILIADO" : "PENDIENTE AUDITORÍA"}
                        </Chip>
                    </div>
                )}
                {tableContent}
            </div>

            {/* Audit Modal */}
            <BaseModal
                open={auditModalOpen}
                onOpenChange={setAuditModalOpen}
                icon={AlertCircle}
                title="Auditoría de Integridad del Flujo"
                description="Listado de cuentas contables con movimientos en el periodo que NO están mapeadas a una categoría de flujo de caja."
            >
                <div className="space-y-4">
                    <div className="p-4 bg-muted/50 rounded-md border border-dashed flex justify-between items-center">
                        <div>
                            <p className="text-3xs font-bold text-muted-foreground uppercase">Diferencia Total</p>
                            <MoneyDisplay amount={data.discrepancy} className="text-2xl font-black text-destructive" />
                        </div>
                        <Info className="h-8 w-8 text-muted-foreground opacity-30" />
                    </div>

                    <Collection.Root collection={culpritCollection} label="Cuentas sin mapeo de flujo">
                        <Collection.View table={cashFlowCulpritViews.table} emptyTitle="Sin cuentas pendientes de mapeo" />
                    </Collection.Root>

                    <p className="text-3xs text-muted-foreground leading-relaxed italic">
                        Tip: Para eliminar esta diferencia, accede a &quot;Configurar Mapeo&quot; y asigna estas cuentas a una de las categorías 
                        (Operación, Inversión o Financiamiento) según corresponda.
                    </p>
                </div>
            </BaseModal>
        </div>
    );
};
