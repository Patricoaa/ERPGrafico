"use client";

import { useState, useEffect } from "react";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
    LogIn,
    LogOut,
    Settings,
    ShieldAlert,
    FileDown,
    Printer,
    Activity,
    Plus,
    Minus,
    RefreshCw
} from "lucide-react";
import { Skeleton } from "@/components/shared";
import api from "@/lib/api";
import { DataCell } from "@/components/ui/data-table-cells";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { ColumnDef } from "@tanstack/react-table";

interface GlobalAuditLog {
    date: string;
    user_name: string | null;
    entity_label: string | null;
    history_type: '+' | '~' | '-' | null;
    source: 'action_log' | 'history';
    action_type: string | null;
    type_label: string | null;
    description: string;
}

export default function AuditHubPage() {
    const [logs, setLogs] = useState<GlobalAuditLog[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const response = await api.get("/core/audit/global/");
            setLogs(response.data);
        } catch (error) {
            console.error("Error fetching audit logs:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const getActionIcon = (type: string, source: string) => {
        if (source === 'action_log') {
            switch (type) {
                case "LOGIN": return LogIn;
                case "LOGOUT": return LogOut;
                case "SETTINGS_CHANGE": return Settings;
                case "SECURITY": return ShieldAlert;
                case "EXPORT": return FileDown;
                case "PRINT": return Printer;
                default: return Activity;
            }
        } else {
            switch (type) {
                case '+': return Plus;
                case '~': return RefreshCw;
                case '-': return Minus;
                default: return Activity;
            }
        }
    };

    const columns: ColumnDef<GlobalAuditLog>[] = [
        {
            accessorKey: "date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha y Hora" />
            ),
            cell: ({ row }) => {
                const date = new Date(row.original.date);
                return (
                    <div className="flex flex-col">
                        <DataCell.Text className="text-xs font-semibold">
                            {format(date, "dd/MM/yyyy", { locale: es })}
                        </DataCell.Text>
                        <DataCell.Secondary className="text-[10px]">
                            {format(date, "HH:mm:ss")}
                        </DataCell.Secondary>
                    </div>
                );
            }
        },
        {
            accessorKey: "user_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Usuario" />
            ),
            cell: ({ row }) => (
                <DataCell.Badge variant="outline" className="bg-muted font-normal">
                    {row.original.user_name || "Sistema"}
                </DataCell.Badge>
            )
        },
        {
            accessorKey: "entity_label",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Entidad" />
            ),
            cell: ({ row }) => (
                <DataCell.Badge variant="secondary" className="font-normal capitalize">
                    {row.original.entity_label || "Sistema"}
                </DataCell.Badge>
            )
        },
        {
            accessorKey: "action_type_label", // Virtual key for filtering
            id: "action_type_label",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Acción" />
            ),
            cell: ({ row }) => {
                const hType = row.original.history_type;
                const source = row.original.source;
                const icon = getActionIcon((row.original.action_type || hType || 'default'), source);
                const label = row.original.type_label || (
                    hType === '+' ? 'Creación' :
                        hType === '~' ? 'Edición' :
                            hType === '-' ? 'Eliminación' : 'Cambio'
                );

                let variant: "outline" | "success" | "destructive" | "info" | "warning" | "secondary" | "default" = "outline";
                if (source === 'action_log') {
                    if (row.original.action_type === 'LOGIN') variant = "success";
                    if (row.original.action_type === 'SECURITY') variant = "destructive";
                } else {
                    if (hType === '+') variant = "info";
                    if (hType === '~') variant = "warning";
                    if (hType === '-') variant = "destructive";
                }

                return (
                    <div className="flex items-center gap-2">
                        <DataCell.Icon icon={icon} className="h-6 w-6" />
                        <DataCell.Badge variant={variant} className="font-semibold uppercase text-[9px]">
                            {label}
                        </DataCell.Badge>
                    </div>
                );
            }
        },
        {
            accessorKey: "description",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Descripción" />
            ),
            cell: ({ row }) => (
                <DataCell.Text className="text-xs text-muted-foreground truncate max-w-[500px]">
                    {row.original.description}
                </DataCell.Text>
            )
        },
        {
            accessorKey: "source",
            header: "Origen",
            id: "source",
            cell: ({ row }) => {
                const source = row.original.source;
                const label = source === 'action_log' ? 'Sistema' : 'Datos';
                const variant = source === 'action_log' ? 'default' : 'secondary';

                return (
                    <DataCell.Badge variant={variant} className="font-normal">
                        {label}
                    </DataCell.Badge>
                );
            }
        }
    ];

    const facetedFilters = [
        {
            column: "source",
            title: "Origen",
            options: [
                { label: "Sistema", value: "action_log" },
                { label: "Datos", value: "history" },
            ],
        },
        {
            column: "entity_label",
            title: "Entidad",
            options: Array.from(new Set(logs.map(l => l.entity_label))).filter(Boolean).map(label => ({
                label: label as string,
                value: label as string
            }))
        },
        {
            column: "action_type_label",
            title: "Acción",
            options: Array.from(new Set(logs.map(l => {
                const hType = l.history_type;
                if (l.source === 'action_log') return l.action_type || 'Unknown';
                if (l.source === 'history') {
                    if (hType === '+') return 'Creación';
                    if (hType === '~') return 'Edición';
                    if (hType === '-') return 'Eliminación';
                }
                return 'Cambio';
            }))).filter(Boolean).map(val => ({
                label: (val === 'LOGIN' ? 'Inicio de Sesión' :
                    val === 'LOGOUT' ? 'Cierre de Sesión' :
                        val === 'SETTINGS_CHANGE' ? 'Configuración' :
                            val === 'SECURITY' ? 'Seguridad' :
                                val === 'EXPORT' ? 'Exportación' :
                                    val === 'PRINT' ? 'Impresión' : val) as string,
                value: val as string
            }))
        }
    ];

    return (
        <div className="pt-4 space-y-8">
            <DataTable
                columns={columns}
                data={logs}
                isLoading={loading}
                variant="embedded"
                globalFilterFields={["entity_type", "action", "change_summary", "entity_label"]}
                searchPlaceholder="Buscar en la bitácora..."
                useAdvancedFilter={true}
                facetedFilters={facetedFilters}
                hiddenColumns={["source"]}
                defaultPageSize={50}
            />

            <div
                className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8"
                role={loading ? "status" : undefined}
                aria-label={loading ? "Cargando estadísticas" : undefined}
            >
                {loading ? (
                    <>
                        {[1, 2, 3, 4].map((i) => (
                            <Card key={i} className="shadow-sm">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <Skeleton className="h-10 w-10 rounded-full" />
                                    <div className="space-y-2">
                                        <Skeleton className="h-2 w-16" />
                                        <Skeleton className="h-6 w-10" />
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </>
                ) : (
                    <>
                        <Card className="bg-success/10 border-success/20 shadow-sm rounded-sm">
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className="p-2 bg-success/10 rounded-sm">
                                    <LogIn className="h-5 w-5 text-success" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-success font-black uppercase tracking-tight">Logins (Sesión)</p>
                                    <p className="text-2xl font-black text-success tabular-nums">{logs.filter(l => l.action_type === 'LOGIN').length}</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-primary/5 border-primary/10 shadow-sm rounded-sm">
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className="p-2 bg-primary/10 rounded-sm">
                                    <Activity className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-primary font-black uppercase tracking-tight">Cambios Datos</p>
                                    <p className="text-2xl font-black text-primary tabular-nums">{logs.filter(l => l.source === 'history').length}</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-info/5 border-info/10 shadow-sm rounded-sm">
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className="p-2 bg-info/10 rounded-sm">
                                    <Settings className="h-5 w-5 text-info" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-info font-black uppercase tracking-tight">Configuración</p>
                                    <p className="text-2xl font-black text-info tabular-nums">{logs.filter(l => l.action_type === 'SETTINGS_CHANGE').length}</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-destructive/5 border-destructive/10 shadow-sm rounded-sm">
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className="p-2 bg-destructive/10 rounded-sm">
                                    <ShieldAlert className="h-5 w-5 text-destructive" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-destructive font-black uppercase tracking-tight">Incidentes</p>
                                    <p className="text-2xl font-black text-destructive tabular-nums">{logs.filter(l => l.action_type === 'SECURITY').length}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </div>
    );
}
