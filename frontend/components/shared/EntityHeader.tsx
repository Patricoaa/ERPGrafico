"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getEntityMetadata, formatEntityDisplay } from "@/lib/entity-registry";
import { Package, ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
    label: string
    href: string
}

export interface EntityHeaderProps {
  /**
   * The canonical entity label (e.g., 'sales.saleorder', 'billing.invoice')
   */
  entityLabel: string;
  
  /**
   * Optional data record. Used to format the document number (e.g. NV-1234)
   * if editing or viewing an existing record.
   */
  data?: any;
  
  /**
   * The action context for the header.
   * 'view' will just display the title.
   * 'create' will prefix with 'Nueva/Nuevo'
   * 'edit' will prefix with 'Editar'
   */
  action?: 'create' | 'edit' | 'view';

  /**
   * Custom title override
   */
  customTitle?: string;

  /**
   * Optional children to render action buttons on the right side
   */
  children?: React.ReactNode;
  
  /**
   * Optional className for the root container
   */
  className?: string;

  /**
   * Breadcrumb trail: [{label, href}, ...]. Last item is the current page.
   */
  breadcrumb?: BreadcrumbItem[];

  /**
   * Read-only mode badge
   */
  readonly?: boolean;
}

export function EntityHeader({ 
  entityLabel, 
  data, 
  action = 'view', 
  customTitle,
  children,
  className,
  breadcrumb,
  readonly
}: EntityHeaderProps) {
  const metadata = getEntityMetadata(entityLabel);
  
  const Icon = metadata?.icon || Package;
  
  let mainTitle = customTitle;
  if (!mainTitle) {
    const baseTitle = metadata?.title || 'Registro';
    if (action === 'create') {
      mainTitle = `Nuevo/a ${baseTitle}`;
    } else if (action === 'edit') {
      mainTitle = `Editar ${baseTitle}`;
    } else {
      mainTitle = baseTitle;
    }
  }

  const subTitle = data ? formatEntityDisplay(entityLabel, data) : undefined;

  return (
    <div className={cn("border-b p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0 print:hidden bg-background", className)}>
      {/* Icon and Basic Info */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-lg shadow-sm border border-primary/20 flex-shrink-0">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div className="flex flex-col">
            <h2 className="text-2xl font-black tracking-tight text-primary uppercase leading-none">
              {mainTitle}
            </h2>
            {subTitle && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-mono font-black text-muted-foreground bg-muted/50 px-2 py-0.5 rounded border border-dashed uppercase tracking-wider">
                  {subTitle}
                </span>
                {readonly && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium shrink-0">
                    Solo lectura
                  </span>
                )}
              </div>
            )}
            {!subTitle && readonly && (
              <div className="mt-1">
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium shrink-0">
                  Solo lectura
                </span>
              </div>
            )}

            {/* Breadcrumb */}
            {breadcrumb && breadcrumb.length > 0 && (
                <nav
                    aria-label="Breadcrumb"
                    className="flex items-center gap-1 text-xs text-muted-foreground mt-2"
                >
                    {breadcrumb.map((item, index) => (
                        <React.Fragment key={item.href}>
                            {index > 0 && (
                                <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                            )}
                            <Link
                                href={item.href}
                                className="hover:text-foreground transition-colors truncate max-w-[120px]"
                            >
                                {item.label}
                            </Link>
                        </React.Fragment>
                    ))}
                </nav>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons (Children) */}
      {children && (
        <div className="flex items-center gap-4 print:hidden">
          {children}
        </div>
      )}
    </div>
  );
}
