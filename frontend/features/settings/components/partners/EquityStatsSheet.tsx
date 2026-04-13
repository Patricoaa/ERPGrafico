import React from "react"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { SheetCloseButton } from "@/components/shared/SheetCloseButton"
import { formatCurrency } from "@/lib/utils"
import {
    TrendingUp,
    PieChart as PieChartIcon,
    AlertCircle,
    Building2,
    BarChart3
} from "lucide-react"
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Legend
} from "recharts"

const COLORS = [
    'var(--primary)',
    'var(--success)',
    'var(--warning)',
    'var(--info)',
    'var(--destructive)',
    'var(--accent)',
    'var(--neutral)'
]

interface EquityStatsSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    partners: any[]
    summary: any
}

export function EquityStatsSheet({ open, onOpenChange, partners, summary }: EquityStatsSheetProps) {
    if (!summary || !partners) return null

    // Prepare data for Pie Chart (Ownership)
    const pieData = partners
        .filter(p => parseFloat(p.partner_equity_percentage) > 0)
        .map(p => ({
            name: p.name,
            value: parseFloat(p.partner_net_equity)
        }))

    // Prepare data for Bar Chart (Paid vs Pending)
    const barData = partners.map(p => ({
        name: p.name.split(' ')[0], // Short name
        paid: parseFloat(p.partner_total_paid_in),
        pending: parseFloat(p.partner_pending_capital)
    }))

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-background/95 backdrop-blur border border-border p-3 rounded-lg shadow-xl">
                    <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mb-2">
                        {payload[0].name || payload[0].payload.name}
                    </p>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center gap-2 mt-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-xs font-medium">
                                {entry.name}: <span className="font-mono font-bold">{formatCurrency(entry.value)}</span>
                            </span>
                        </div>
                    ))}
                </div>
            )
        }
        return null
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
            <SheetContent 
                side="right" 
                hideOverlay={true}
                hideCloseButton={true}
                className="w-[90vw] sm:max-w-md p-0 flex flex-col"
            >
                <SheetCloseButton 
                    onClick={() => onOpenChange(false)} 
                    className="absolute top-6 right-6 z-50"
                />

                <SheetHeader className="px-8 pt-8 pb-4 space-y-0">
                    <SheetTitle>
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                                <BarChart3 className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xl font-black tracking-tight text-foreground leading-none">Análisis Societario</span>
                                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mt-1 opacity-60">
                                    Estadísticas de Composición
                                </span>
                            </div>
                        </div>
                    </SheetTitle>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-8 scrollbar-thin scrollbar-thumb-primary/10 scrollbar-track-transparent">
                    {/* General Summary Metrics */}
                    <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                        <div className="p-5 bg-primary/5 border border-primary/20 rounded-lg flex flex-col justify-center ring-1 ring-primary/10">
                            <div className="flex items-center gap-2 mb-2 text-primary shrink-0">
                                <Building2 className="h-4 w-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest leading-none">Patrimonio Neto</span>
                            </div>
                            <span className="text-2xl font-black font-mono leading-none text-primary">{formatCurrency(summary.total_net_equity || 0)}</span>
                            <span className="text-[9px] font-black text-primary mt-2 uppercase tracking-tighter opacity-60">
                                Valor Libro de la Compañía
                            </span>
                        </div>
                    </div>

                    {/* Chart 1: Equity Ownership */}
                    <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-700 delay-100">
                        <div className="flex items-center gap-2 opacity-80">
                            <PieChartIcon className="h-4 w-4" />
                            <h3 className="text-[11px] font-black uppercase tracking-widest">Participación Patrimonial</h3>
                        </div>
                        <div className="h-64 bg-background border border-border rounded-xl p-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend 
                                        wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 900, opacity: 0.8 }}
                                        iconType="circle"
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Chart 2: Paid vs Pending Capital */}
                    <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-1000 delay-200">
                        <div className="flex items-center gap-2 opacity-80">
                            <TrendingUp className="h-4 w-4" />
                            <h3 className="text-[11px] font-black uppercase tracking-widest">Capital Enterado vs Pendiente</h3>
                        </div>
                        <div className="h-64 bg-background border border-border rounded-xl p-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10" />
                                    <XAxis 
                                        dataKey="name" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fontSize: 10, fontWeight: 900, fill: 'currentColor', opacity: 0.6 }} 
                                    />
                                    <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tickFormatter={(value) => `$${value/1000}k`}
                                        tick={{ fontSize: 10, fontWeight: 900, fill: 'currentColor', opacity: 0.6 }} 
                                    />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'currentColor', opacity: 0.05 }} />
                                    <Legend 
                                        wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 900, opacity: 0.8 }}
                                        iconType="circle"
                                    />
                                    <Bar dataKey="paid" name="Enterado" stackId="a" fill="hsl(var(--success))" radius={[0, 0, 4, 4]} />
                                    <Bar dataKey="pending" name="Pendiente" stackId="a" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}
