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
    Activity
} from "lucide-react";
import api from "@/lib/api";

export default function AuditHubPage() {
    const [logs, setLogs] = useState<ActionLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const response = await api.get("/core/action-logs/");
                setLogs(response.data);
            } catch (error) {
                console.error("Error fetching audit logs:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    const getActionIcon = (type: string) => {
        switch (type) {
            case "LOGIN": return <LogIn className="h-4 w-4 text-green-500" />;
            case "LOGOUT": return <LogOut className="h-4 w-4 text-slate-500" />;
            case "SETTINGS_CHANGE": return <Settings className="h-4 w-4 text-blue-500" />;
            case "SECURITY": return <ShieldAlert className="h-4 w-4 text-red-500" />;
            case "EXPORT": return <FileDown className="h-4 w-4 text-orange-500" />;
            case "PRINT": return <Printer className="h-4 w-4 text-indigo-500" />;
            default: return <Activity className="h-4 w-4 text-slate-400" />;
        }
    };

    const columns = [
        {
            accessorKey: "timestamp",
            header: "Fecha y Hora",
            cell: ({ row }: any) => {
                const date = new Date(row.original.timestamp);
                return (
                    <div className="flex flex-col">
                        <span className="font-medium">{format(date, "dd/MM/yyyy", { locale: es })}</span>
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
                    <Badge variant="outline" className="bg-slate-50 font-normal">
                        {row.original.user_name || "Sistema"}
                    </Badge>
                </div>
            )
        },
        {
            accessorKey: "action_type_display",
            header: "Acción",
            cell: ({ row }: any) => (
                <div className="flex items-center gap-2">
                    {getActionIcon(row.original.action_type)}
                    <span className="text-sm">{row.original.action_type_display}</span>
                </div>
            )
        },
        {
            accessorKey: "description",
            header: "Descripción",
            cell: ({ row }: any) => (
                <span className="text-xs text-slate-600 max-w-[300px] truncate block">
                    {row.original.description}
                </span>
            )
        },
        {
            accessorKey: "ip_address",
            header: "IP",
            cell: ({ row }: any) => (
                <span className="text-[10px] font-mono text-muted-foreground">
                    {row.original.ip_address || "Internal"}
                </span>
            )
        }
    ];

    return (
        <div className="container mx-auto py-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Centro de Auditoría</h1>
                    <p className="text-muted-foreground">
                        Registro completo de acciones y seguridad del sistema.
                    </p>
                </div>
                <History className="h-10 w-10 text-slate-200" />
            </div>

            <Card className="border-none shadow-md">
                <CardHeader className="bg-slate-50/50">
                    <CardTitle>Bitácora de Actividades</CardTitle>
                    <CardDescription>
                        Visualice quién, cuándo y qué se ha realizado en la plataforma.
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
                            globalFilterFields={["description"]}
                        />
                    )}
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                            <Settings className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider">Cambios Config.</p>
                            <p className="text-2xl font-bold text-blue-900">{logs.filter(l => l.action_type === 'SETTINGS_CHANGE').length}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-red-50/50 border-red-100 shadow-sm">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-2 bg-red-100 rounded-full">
                            <ShieldAlert className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-xs text-red-600 font-semibold uppercase tracking-wider">Incidentes/Seguridad</p>
                            <p className="text-2xl font-bold text-red-900">{logs.filter(l => l.action_type === 'SECURITY').length}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
