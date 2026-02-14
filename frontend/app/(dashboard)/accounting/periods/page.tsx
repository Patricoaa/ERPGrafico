"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lock, LockOpen, Calendar, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { formatPlainDate } from '@/lib/utils';
import api from '@/lib/api';

interface AccountingPeriod {
    id: number;
    year: number;
    month: number;
    month_display: string;
    status: 'OPEN' | 'UNDER_REVIEW' | 'CLOSED';
    status_display: string;
    closed_at: string | null;
    closed_by: number | null;
    closed_by_name: string | null;
    tax_period_id: number | null;
    tax_period_status: string | null;
}

interface PeriodStatus {
    period_exists: boolean;
    period_status: string;
    has_draft_entries: boolean;
    total_entries: number;
    draft_entries: number;
}

export default function AccountingPeriodsPage() {
    const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<number | null>(null);

    useEffect(() => {
        fetchPeriods();

        // Poll every 10 seconds
        const interval = setInterval(fetchPeriods, 10000);
        return () => clearInterval(interval);
    }, []);

    const fetchPeriods = async () => {
        try {
            const response = await api.get('/tax/accounting-periods/?ordering=-year,-month');
            const data = response.data.results || response.data;
            setPeriods(data);
        } catch (error) {
            console.error('Error fetching periods:', error);
            toast.error('Error al cargar los periodos contables');
        } finally {
            setLoading(false);
        }
    };

    const closePeriod = async (periodId: number) => {
        setActionLoading(periodId);
        try {
            const response = await fetch(`/api/tax/accounting-periods/${periodId}/close/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            if (response.ok) {
                toast.success('Periodo contable cerrado exitosamente');
                fetchPeriods();
            } else {
                const error = await response.json();
                toast.error(error.error || 'Error al cerrar el periodo');
            }
        } catch (error) {
            toast.error('Error al cerrar el periodo');
        } finally {
            setActionLoading(null);
        }
    };

    const reopenPeriod = async (periodId: number) => {
        setActionLoading(periodId);
        try {
            const response = await fetch(`/api/tax/accounting-periods/${periodId}/reopen/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            if (response.ok) {
                toast.success('Periodo contable reabierto exitosamente');
                fetchPeriods();
            } else {
                const error = await response.json();
                toast.error(error.error || 'Error al reabrir el periodo');
            }
        } catch (error) {
            toast.error('Error al reabrir el periodo');
        } finally {
            setActionLoading(null);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'OPEN':
                return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Abierto</Badge>;
            case 'UNDER_REVIEW':
                return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />En Revisión</Badge>;
            case 'CLOSED':
                return <Badge variant="destructive"><Lock className="w-3 h-3 mr-1" />Cerrado</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <PageHeader
                    title="Periodos Contables"
                    description="Gestión de periodos contables mensuales"
                />
                <div className="text-center py-12">Cargando...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Periodos Contables"
                description="Gestión de periodos contables mensuales"
            />

            <div className="grid gap-4">
                {periods.map((period) => (
                    <Card key={period.id}>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Calendar className="w-5 h-5 text-muted-foreground" />
                                    <div>
                                        <CardTitle className="text-lg">
                                            {period.month_display} {period.year}
                                        </CardTitle>
                                        <CardDescription>
                                            Periodo {period.year}-{String(period.month).padStart(2, '0')}
                                        </CardDescription>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {getStatusBadge(period.status)}
                                    {period.tax_period_id && (
                                        <Badge variant="outline" className="text-xs">
                                            Periodo Tributario: {period.tax_period_status}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-muted-foreground">
                                    {period.closed_at && (
                                        <div className="flex items-center gap-2">
                                            <Lock className="w-4 h-4" />
                                            <span>
                                                Cerrado el {formatPlainDate(period.closed_at)}
                                                {period.closed_by_name && ` por ${period.closed_by_name}`}
                                            </span>
                                        </div>
                                    )}
                                    {period.status === 'OPEN' && (
                                        <div className="flex items-center gap-2 text-green-600">
                                            <CheckCircle2 className="w-4 h-4" />
                                            <span>Periodo abierto - Se pueden registrar asientos</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    {period.status === 'OPEN' && (
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => closePeriod(period.id)}
                                            disabled={actionLoading === period.id}
                                        >
                                            <Lock className="w-4 h-4 mr-2" />
                                            {actionLoading === period.id ? 'Cerrando...' : 'Cerrar Periodo'}
                                        </Button>
                                    )}
                                    {period.status === 'CLOSED' && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => reopenPeriod(period.id)}
                                            disabled={actionLoading === period.id}
                                        >
                                            <LockOpen className="w-4 h-4 mr-2" />
                                            {actionLoading === period.id ? 'Reabriendo...' : 'Reabrir Periodo'}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {period.tax_period_id && period.tax_period_status === 'CLOSED' && (
                                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                                    <p className="text-sm text-amber-800">
                                        El periodo tributario asociado está cerrado. No se puede reabrir el periodo contable sin reabrir primero el periodo tributario.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}

                {periods.length === 0 && (
                    <Card>
                        <CardContent className="py-12 text-center text-muted-foreground">
                            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>No hay periodos contables registrados</p>
                            <p className="text-sm mt-2">Los periodos se crean automáticamente al registrar asientos contables</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
