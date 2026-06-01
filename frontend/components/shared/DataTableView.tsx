"use client"

import React, { useMemo } from "react"
import { type Row, type Table as ReactTable } from "@tanstack/react-table"
import { useViewMode } from "@/hooks/useViewMode"
import { ENTITY_REGISTRY } from "@/lib/entity-registry"
import { createDomainCardView, createEntityCardView, createCardLoadingView } from "@/lib/view-helpers"
import { DataTable, type DataTableProps } from "./DataTable"

interface DataTableViewProps<TData, TValue>
  extends Omit<DataTableProps<TData, TValue>,
    "viewOptions" | "currentView" | "onViewChange" | "renderCustomView" | "renderLoadingView"
  > {
  entityLabel: string
  renderCustomView?: (table: ReactTable<TData>) => React.ReactNode
  renderLoadingView?: () => React.ReactNode
  renderCard?: (data: TData, row: Row<TData>) => React.ReactNode
  isSelected?: (data: TData) => boolean
  isHubOpen?: boolean
}

export function DataTableView<TData, TValue>({
  entityLabel,
  renderCustomView: externalRenderCustomView,
  renderLoadingView: externalLoadingView,
  renderCard,
  isSelected,
  isHubOpen,
  ...dataTableProps
}: DataTableViewProps<TData, TValue>) {
  const policy = ENTITY_REGISTRY[entityLabel]?.viewPolicy
  const { currentView, handleViewChange, viewOptions, isCustomView } = useViewMode(entityLabel)

  const internalCustomView = useMemo(() => {
    if (!isCustomView) return undefined
    if (!policy && !externalRenderCustomView) return undefined
    if (externalRenderCustomView) return externalRenderCustomView
    if (!policy) return undefined

    switch (policy.cardComponent) {
      case "domain":
        return createDomainCardView(entityLabel, {
          onRowClick: dataTableProps.onRowClick ?? (() => {}),
          isSelected: isSelected ?? (() => false),
          isHubOpen: isHubOpen ?? false,
        })
      case "entity":
      case "entity-compact":
        if (!renderCard) return undefined
        return createEntityCardView(entityLabel, {
          renderCard: renderCard as (data: any, row: any) => React.ReactNode,
          gridLayout: policy.gridLayout,
        })
      default:
        return undefined
    }
  }, [externalRenderCustomView, isCustomView, policy, entityLabel, renderCard, isSelected, isHubOpen, dataTableProps.onRowClick])

  const internalLoadingView = useMemo(() => {
    if (externalLoadingView) return externalLoadingView
    if (!isCustomView) return undefined
    if (policy?.cardComponent === "domain" || policy?.cardComponent === "entity" || policy?.cardComponent === "entity-compact" || externalRenderCustomView) {
      return createCardLoadingView(policy?.gridLayout ?? "single-column")
    }
    return undefined
  }, [externalLoadingView, externalRenderCustomView, isCustomView, policy])

  return (
    <DataTable
      {...dataTableProps}
      viewOptions={viewOptions}
      currentView={currentView}
      onViewChange={handleViewChange}
      renderCustomView={internalCustomView}
      renderLoadingView={internalLoadingView}
    />
  )
}
