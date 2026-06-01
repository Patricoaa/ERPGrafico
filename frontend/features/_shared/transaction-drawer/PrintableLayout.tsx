'use client'

import React, { forwardRef } from 'react'

interface PrintableLayoutProps {
  title: string
  displayId: string
  subtitle?: string
  children: React.ReactNode
}

export const PrintableLayout = forwardRef<HTMLDivElement, PrintableLayoutProps>(
  function PrintableLayout({ title, displayId, subtitle, children }, ref) {
    return (
      <div ref={ref} className="hidden print:block print:p-4 font-mono text-xs">
        <style>{`
          @page { size: 80mm auto; margin: 4mm; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        `}</style>
        <div className="text-center border-b pb-2 mb-2">
          <p className="font-bold text-sm">{title}</p>
          <p className="text-[10px] text-gray-500">{displayId}</p>
          {subtitle && <p className="text-[10px]">{subtitle}</p>}
        </div>
        {children}
        <div className="text-center border-t pt-2 mt-4 text-[9px] text-gray-400">
          <p>Gracias por su preferencia</p>
          <p>Generado por ERPGrafico</p>
        </div>
      </div>
    )
  },
)
