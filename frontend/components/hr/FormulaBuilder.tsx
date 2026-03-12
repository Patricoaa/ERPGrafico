"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
    Calculator, 
    Variable, 
    FunctionSquare, 
    Plus,
    Minus,
    X,
    Divide,
    ChevronRight
} from "lucide-react"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { IndustrialCard } from "@/components/shared/IndustrialCard"

interface FormulaBuilderProps {
    value: string;
    onChange: (value: string) => void;
}

const VARIABLES = [
    { label: "BASE", val: "BASE", desc: "Sueldo Base del empleado" },
    { label: "IMPONIBLE", val: "IMPONIBLE", desc: "Acumulado de haberes imponibles hasta el momento" },
    { label: "MIN_WAGE", val: "MIN_WAGE", desc: "Sueldo Mínimo Nacional configurado" },
    { label: "UF", val: "UF", desc: "Valor UF del mes" },
    { label: "UTM", val: "UTM", desc: "Valor UTM del mes" },
    { label: "AFP_PERCENT", val: "AFP_PERCENT", desc: "Tasa AFP del empleado (ej: 0.1145)" },
    { label: "ISAPRE_UF", val: "ISAPRE_UF", desc: "Monto salud en UF pactado" },
    { label: "CONTRATO_INDEFINIDO", val: "CONTRATO_INDEFINIDO", desc: "1 si es indefinido, 0 si plazo fijo" },
]

const FUNCTIONS = [
    { label: "min(a, b)", val: "min(", desc: "Retorna el valor mínimo entre dos números" },
    { label: "max(a, b)", val: "max(", desc: "Retorna el valor máximo entre dos números" },
    { label: "abs(x)", val: "abs(", desc: "Retorna el valor absoluto" },
]

const OPERATORS = [
    { label: "+", val: " + ", icon: Plus },
    { label: "-", val: " - ", icon: Minus },
    { label: "*", val: " * ", icon: X },
    { label: "/", val: " / ", icon: Divide },
    { label: "(", val: "(", icon: null },
    { label: ")", val: ")", icon: null },
    { label: ",", val: ", ", icon: null },
]

export function FormulaBuilder({ value, onChange }: FormulaBuilderProps) {
    const insert = (token: string) => {
        onChange(value + token)
    }

    return (
        <IndustrialCard variant="standard" className="flex flex-col gap-3 border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-2 mb-1">
                <Calculator className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Asistente de Fórmulas</span>
            </div>

            <TooltipProvider>
                <div className="space-y-4">
                    {/* Variables */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <Variable className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Variables</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {VARIABLES.map((v) => (
                                <Tooltip key={v.val}>
                                    <TooltipTrigger asChild>
                                        <Badge 
                                            variant="secondary" 
                                            className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors py-1 px-2 font-mono text-[10px]"
                                            onClick={() => insert(v.val)}
                                        >
                                            {v.label}
                                        </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        <p className="text-xs">{v.desc}</p>
                                    </TooltipContent>
                                </Tooltip>
                            ))}
                        </div>
                    </div>

                    {/* Funciones y Operadores */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <FunctionSquare className="h-3 w-3 text-muted-foreground" />
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Funciones</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {FUNCTIONS.map((f) => (
                                    <Tooltip key={f.val}>
                                        <TooltipTrigger asChild>
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="h-7 px-2 text-[10px] font-mono hover:border-primary hover:text-primary"
                                                onClick={() => insert(f.val)}
                                            >
                                                {f.label}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                            <p className="text-xs">{f.desc}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Calculator className="h-3 w-3 text-muted-foreground" />
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Operadores</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {OPERATORS.map((op) => (
                                    <Button 
                                        key={op.label}
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-7 w-7 p-0 flex items-center justify-center font-bold text-xs ring-1 ring-border"
                                        onClick={() => insert(op.val)}
                                    >
                                        {op.icon ? <op.icon className="h-3 w-3" /> : op.label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Lógica Estructurada */}
                    <div className="border-t pt-2 mt-2">
                         <div className="flex items-center gap-2 mb-2">
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Lógica Condicional</span>
                        </div>
                        <Button 
                            variant="secondary" 
                            size="sm" 
                            className="w-full h-8 text-[10px] font-mono gap-2 border border-dashed border-primary/40 bg-transparent text-primary hover:bg-primary/10"
                            onClick={() => insert(" VALOR if CONDICION else OTRO_VALOR")}
                        >
                            IF TERNARIO: [Ture] if [Cond] else [False]
                        </Button>
                    </div>
                </div>
            </TooltipProvider>
        </IndustrialCard>
    )
}
