"use client";

import React, { useState, useEffect } from "react";
import { ActionLog } from "@/types/audit";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
    History,
    LogIn,
    LogOut,
    Settings,
    ShieldAlert,
    FileDown,
    Printer,
    Activity,
    Edit
} from "lucide-react";
import api from "@/lib/api";

export default function AuditHubPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const response = await api.get("/core/audit/global/");
                setLogs(response.data);
            } catch (error) {
                console.error("Error fetching audit logs:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    const getActionIcon = (type: string, source: string) => {
        if (source === 'action_log') {
            switch (type) {
                case "LOGIN": return <LogIn className="h-4 w-4 text-green-500" />;
                case "LOGOUT": return <LogOut className="h-4 w-4 text-slate-500" />;
                case "SETTINGS_CHANGE": return <Settings className="h-4 w-4 text-blue-500" />;
                case "SECURITY": return <ShieldAlert className="h-4 w-4 text-red-500" />;
                case "EXPORT": return <FileDown className="h-4 w-4 text-orange-500" />;
                case "PRINT": return <Printer className="h-4 w-4 text-indigo-500" />;
                default: return <Activity className="h-4 w-4 text-slate-400" />;
            }
        } else {
            // Source is history
            switch (type) {
                case '+': return <Activity className="h-4 w-4 text-green-600" />;
                case '~': return <Activity className="h-4 w-4 text-blue-600" />;
                case '-': return <Activity className="h-4 w-4 text-red-600" />;
                default: return <Activity className="h-4 w-4 text-slate-400" />;
            }
        }
    };

    const columns = [
        {
            accessorKey: "date",
            header: "Fecha y Hora",
            cell: ({ row }: any) => {
                const date = new Date(row.original.date);
                return (
                    <div className="flex flex-col">
                        <span className="font-medium text-xs">{format(date, "dd/MM/yyyy", { locale: es })}</span>
                        <span className="text-[10px] text-muted-foreground">{format(date, "HH:mm:ss")}</span>
                    </div>
                );
            }
        },
        {
            accessorKey: "user_name",
            header: "Usuario",
            cell: ({ row }: any) => (
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-slate-50 font-normal text-[10px] h-5">
                        {row.original.user_name || "Sistema"}
                    </Badge>
                </div>
            )
        },
        {
            accessorKey: "entity_label",
            header: "Entidad",
            cell: ({ row }: any) => (
                <Badge variant="secondary" className="font-normal text-[10px] h-5">
                    {row.original.entity_label || "Sistema"}
                </Badge>
            )
        },
        {
            accessorKey: "action_type",
            header: "Acción",
            cell: ({ row }: any) => (
                <div className="flex items-center gap-2">
                    {getActionIcon(row.original.action_type || row.original.history_type, row.original.source)}
                    <span className="text-xs font-semibold">
                        {row.original.type_label || (
                            row.original.history_type === '+' ? 'Creación' :
                                row.original.history_type === '~' ? 'Edición' :
                                    row.original.history_type === '-' ? 'Eliminación' : 'Cambio'
                        )}
                    </span>
                </div>
            )
        },
        {
            accessorKey: "description",
            header: "Descripción",
            cell: ({ row }: any) => (
                <span className="text-xs text-slate-600 max-w-[400px] truncate block">
                    {row.original.description}
                </span>
            )
        },
    ];

    return (
        <div className="container mx-auto py-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Centro de Auditoría</h1>
                    <p className="text-muted-foreground">
                        Registro unificado de acciones y cambios en el sistema.
                    </p>
                </div>
                <History className="h-10 w-10 text-slate-200" />
            </div>

            <Card className="border-none shadow-md">
                <CardHeader className="bg-slate-50/50">
                    <CardTitle>Bitácora de Actividades</CardTitle>
                    <CardDescription>
                        Visualice los cambios en documentos y eventos importantes.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <Activity className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <DataTable
                            columns={columns}
                            data={logs}
                            globalFilterFields={["description", "user_name", "entity_label"]}
                        />
                    )}
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-green-50/50 border-green-100 shadow-sm">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-2 bg-green-100 rounded-full">
                            <LogIn className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-xs text-green-600 font-semibold uppercase tracking-wider">Logins (24h)</p>
                            <p className="text-2xl font-bold text-green-900">{logs.filter(l => l.action_type === 'LOGIN').length}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-blue-50/50 border-blue-100 shadow-sm">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-2 bg-blue-100 rounded-full">
                            <Edit className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider">Cambios Datos</p>
                            <p className="text-2xl font-bold text-blue-900">{logs.filter(l => l.source === 'history').length}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-indigo-50/50 border-indigo-100 shadow-sm">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-2 bg-indigo-100 rounded-full">
                            <Settings className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div>
                            <p className="text-xs text-indigo-600 font-semibold uppercase tracking-wider">Configuración</p>
                            <p className="text-2xl font-bold text-indigo-900">{logs.filter(l => l.action_type === 'SETTINGS_CHANGE').length}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-red-50/50 border-red-100 shadow-sm">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-2 bg-red-100 rounded-full">
                            <ShieldAlert className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-xs text-red-600 font-semibold uppercase tracking-wider">Seguridad</p>
                            <p className="text-2xl font-bold text-red-900">{logs.filter(l => l.action_type === 'SECURITY').length}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
