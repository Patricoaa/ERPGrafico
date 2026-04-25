"use client"

import { useState, useEffect, useRef } from "react"
import JsBarcode from "jsbarcode"
import { BaseModal } from "@/components/shared/BaseModal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LabeledContainer } from "@/components/shared/LabeledContainer"
import { Barcode, Download, Printer, RefreshCw, Check } from "lucide-react"
import { toast } from "sonner"

interface BarcodeModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    initialValue?: string
    onApply: (value: string) => void
}

export function BarcodeModal({ open, onOpenChange, initialValue = "", onApply }: BarcodeModalProps) {
    const [barcodeValue, setBarcodeValue] = useState(initialValue)
    const [mounted, setMounted] = useState(false)
    const barcodeSvgRef = useRef<SVGSVGElement | null>(null)

    const generateBarcode = (node: SVGSVGElement | null, value: string) => {
        if (!node || !value || !open) return
        
        try {
            JsBarcode(node, value, {
                format: "CODE128",
                width: 2,
                height: 100,
                displayValue: true,
                fontSize: 16,
                margin: 10,
                background: "white", // High contrast white for machine reading
                lineColor: "black", // High contrast black for machine reading
            })
        } catch (error) {
            console.error("Barcode generation failed:", error)
        }
    }

    // Synchronize state with initialValue when opening
    useEffect(() => {
        if (open) {
            requestAnimationFrame(() => {
                setBarcodeValue(initialValue || "")
                // Reset mount flag to force re-render/re-generation
                setMounted(false)
            })
            
            // Short delay to allow Dialog to start opening
            const timer = setTimeout(() => {
                requestAnimationFrame(() => setMounted(true))
            }, 50)
            return () => clearTimeout(timer)
        } else {
            requestAnimationFrame(() => setMounted(false))
        }
    }, [open, initialValue])

    // Main generation effect
    useEffect(() => {
        if (open && mounted && barcodeSvgRef.current && barcodeValue) {
            // Use rAF to ensure the SVG is actually in the layout
            const rafId = requestAnimationFrame(() => {
                generateBarcode(barcodeSvgRef.current, barcodeValue)
            })
            return () => cancelAnimationFrame(rafId)
        }
    }, [barcodeValue, open, mounted])

    const setRef = (node: SVGSVGElement | null) => {
        barcodeSvgRef.current = node
        if (node && barcodeValue) {
            generateBarcode(node, barcodeValue)
        }
    }

    const generateRandomBarcode = () => {
        // Generate a 12-digit random number (for EAN-13, we or simple numeric)
        const randomStr = Math.floor(Math.random() * 900000000000 + 100000000000).toString()
        setBarcodeValue(randomStr)
    }

    const downloadBarcode = () => {
        if (!barcodeSvgRef.current) return

        const svg = barcodeSvgRef.current
        const svgData = new XMLSerializer().serializeToString(svg)
        const canvas = document.createElement("canvas")
        const svgSize = svg.getBBox()
        canvas.width = svgSize.width + 20
        canvas.height = svgSize.height + 20
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const img = new Image()
        img.onload = () => {
            ctx.fillStyle = "white"
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(img, 10, 10)
            const pngFile = canvas.toDataURL("image/png")
            const downloadLink = document.createElement("a")
            downloadLink.download = `barcode-${barcodeValue}.png`
            downloadLink.href = pngFile
            downloadLink.click()
            toast.success("Código de barras descargado")
        }
        img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)))
    }

    const printBarcode = () => {
        if (!barcodeSvgRef.current) return
        
        const svgData = new XMLSerializer().serializeToString(barcodeSvgRef.current)
        const printWindow = window.open('', '_blank')
        if (!printWindow) return

        printWindow.document.write(`
            <html>
                <head>
                    <title>Imprimir Código de Barras</title>
                    <style>
                        body { display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                        @media print {
                            body { margin: 0; }
                            svg { width: 100%; max-width: 300px; }
                        }
                    </style>
                </head>
                <body>
                    ${svgData}
                    <script>
                        window.onload = () => {
                            window.print();
                            window.close();
                        }
                    </script>
                </body>
            </html>
        `)
        printWindow.document.close()
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="md"
            title={
                <div className="flex items-center gap-2">
                    <Barcode className="h-5 w-5 text-primary" />
                    Código de Barras
                </div>
            }
            description="Visualice, genere o descargue el código de barras para este producto."
            footer={
                <div className="flex w-full justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button 
                        type="button" 
                        variant="default" 
                        className="gap-2"
                        onClick={() => {
                            onApply(barcodeValue)
                            onOpenChange(false)
                            toast.success("Código de barras aplicado")
                        }}
                        disabled={!barcodeValue}
                    >
                        <Check className="h-4 w-4" />
                        Aplicar al Producto
                    </Button>
                </div>
            }
        >
            <div className="space-y-6">
                    <LabeledContainer label="Valor del Código">
                        <div className="flex gap-2 py-0.5">
                            <Input
                                value={barcodeValue}
                                onChange={(e) => setBarcodeValue(e.target.value)}
                                placeholder="Ingrese el código..."
                                className="font-mono font-bold border-0 focus-visible:ring-0 h-8 flex-1"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={generateRandomBarcode}
                                title="Generar nuevo código"
                                className="h-8 w-8 shrink-0"
                            >
                                <RefreshCw className="h-4 w-4" />
                            </Button>
                        </div>
                    </LabeledContainer>

                    <div className="flex flex-col items-center justify-center p-6 bg-high-contrast-bg rounded-md border-2 border-dashed border-border min-h-[160px]">
                        {barcodeValue ? (
                            <svg ref={setRef} className="max-w-full h-auto" />
                        ) : (
                            <div className="text-center text-muted-foreground italic text-sm">
                                Ingrese un valor para previsualizar
                            </div>
                        )}
                    </div>

                    <div className="flex justify-center gap-4">
                        <Button 
                            type="button" 
                            variant="secondary" 
                            className="flex-1 gap-2"
                            onClick={downloadBarcode}
                            disabled={!barcodeValue}
                        >
                            <Download className="h-4 w-4" />
                            Descargar
                        </Button>
                        <Button 
                            type="button" 
                            variant="secondary" 
                            className="flex-1 gap-2"
                            onClick={printBarcode}
                            disabled={!barcodeValue}
                        >
                            <Printer className="h-4 w-4" />
                            Imprimir
                        </Button>
                    </div>
                </div>
        </BaseModal>
    )
}
