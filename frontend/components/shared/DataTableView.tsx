"use client"

import React, { useMemo } from "react"
import { type Row, type Table as ReactTable } from "@tanstack/react-table"
import { useViewMode } from "@/hooks/useViewMode"
import { ENTITY_REGISTRY } from "@/lib/entity-registry"
import { createDomainCardView, createEntityCardView, createCardLoadingView, createCardGroupView, createCardGroupLoadingView } from "@/lib/view-helpers"
import { type AggregatorDef } from "@/lib/group-utils"
import { DataTable, type DataTableProps } from "./DataTable"
import { DomainCard } from "./DomainCard"
import type { EntityCardSkeletonProps } from "./EntityCard"

interface DataTableViewProps<TData, TValue>
  extends Omit<DataTableProps<TData, TValue>,
    "viewOptions" | "currentView" | "onViewChange" | "renderCustomView" | "renderLoadingView" | "sortOptions"
  > {
  entityLabel: string
  renderCustomView?: (table: ReactTable<TData>) => React.ReactNode
  renderLoadingView?: () => React.ReactNode
  renderCard?: (data: TData, row: Row<TData>, table?: ReactTable<TData>) => React.ReactNode
  isSelected?: (data: TData) => boolean
  isHubOpen?: boolean
  cardGroupBy?: {
    field: string
    sort?: 'asc' | 'desc'
    labelFn?: (key: string, rawKey: unknown, items: TData[]) => { label: string; sublabel?: string }
    defaultLabel?: string
    aggregators?: AggregatorDef[]
  }
  cardSkeleton?: Pick<EntityCardSkeletonProps, 'showHeader' | 'showBody' | 'showFooter'>
}

export function DataTableView<TData, TValue>({
  entityLabel,
  renderCustomView: externalRenderCustomView,
  renderLoadingView: externalLoadingView,
  renderCard,
  isSelected,
  isHubOpen,
  cardGroupBy,
  cardSkeleton,
  ...dataTableProps
}: DataTableViewProps<TData, TValue>) {
  const policy = ENTITY_REGISTRY[entityLabel]?.viewPolicy

  const { currentView, handleViewChange, viewOptions, isCustomView } = useViewMode(entityLabel)
  const hasBulkActions = !!(dataTableProps.bulkActions?.length || dataTableProps.bulkDock)

  const internalCustomView = useMemo((): ((table: ReactTable<TData>) => React.ReactNode) | undefined => {
    if (!isCustomView) return undefined
    if (!policy && !externalRenderCustomView) return undefined
    if (externalRenderCustomView) return externalRenderCustomView
    if (!policy) return undefined

    const cardGroupByAsRecord = cardGroupBy as unknown as {
      field: string
      sort?: 'asc' | 'desc'
      labelFn?: (key: string, rawKey: unknown, items: Record<string, unknown>[]) => { label: string; sublabel?: string }
      defaultLabel?: string
      aggregators?: AggregatorDef[]
    } | undefined

    switch (policy.cardComponent) {
      case "domain":
        if (cardGroupByAsRecord) {
          return createCardGroupView({
            renderCard: (data: Record<string, unknown>, row?: Row<Record<string, unknown>>, table?: ReactTable<Record<string, unknown>>) => {
              const isAnySelected = table ? table.getSelectedRowModel().rows.length > 0 : false
              return React.createElement(DomainCard, {
                label: entityLabel,
                data,
                isSelected: isSelected?.(data as TData) ?? false,
                isHubOpen: isHubOpen ?? false,
                onClick: () => {
                  if (hasBulkActions && isAnySelected && row) {
                    row.toggleSelected()
                  } else {
                    dataTableProps.onRowClick?.(data as TData)
                  }
                },
                selectable: hasBulkActions,
                checked: row?.getIsSelected() ?? false,
                onCheckedChange: (checked) => row?.toggleSelected(checked),
                isAnySelected,
              })
            },
            cardGroupBy: cardGroupByAsRecord,
            gridLayout: policy.gridLayout,
            emptyState: dataTableProps.emptyState,
            isFiltered: dataTableProps.isFiltered,
          }) as unknown as (table: ReactTable<TData>) => React.ReactNode
        }
        return createDomainCardView(entityLabel, {
          onRowClick: dataTableProps.onRowClick as (data: Record<string, unknown>) => void,
          isSelected: isSelected as (data: Record<string, unknown>) => boolean,
          isHubOpen: isHubOpen ?? false,
          emptyState: dataTableProps.emptyState,
          isFiltered: dataTableProps.isFiltered,
          hasBulkActions,
        }) as unknown as (table: ReactTable<TData>) => React.ReactNode
      case "entity":
        if (!renderCard) return undefined
        if (cardGroupByAsRecord) {
          return createCardGroupView({
            renderCard: renderCard as (data: Record<string, unknown>, row?: Row<Record<string, unknown>>, table?: ReactTable<Record<string, unknown>>) => React.ReactNode,
            cardGroupBy: cardGroupByAsRecord,
            gridLayout: policy.gridLayout,
            emptyState: dataTableProps.emptyState,
            isFiltered: dataTableProps.isFiltered,
            hasBulkActions,
          }) as unknown as (table: ReactTable<TData>) => React.ReactNode
        }
        return createEntityCardView(entityLabel, {
          renderCard: renderCard as (data: Record<string, unknown>, row: Row<Record<string, unknown>>, table?: ReactTable<Record<string, unknown>>) => React.ReactNode,
          gridLayout: policy.gridLayout,
          emptyState: dataTableProps.emptyState,
          isFiltered: dataTableProps.isFiltered,
          hasBulkActions,
        }) as unknown as (table: ReactTable<TData>) => React.ReactNode
      default:
        return undefined
    }
  }, [externalRenderCustomView, isCustomView, policy, entityLabel, renderCard, isSelected, isHubOpen, cardGroupBy, dataTableProps.onRowClick, dataTableProps.emptyState, dataTableProps.isFiltered, hasBulkActions, dataTableProps.bulkActions, dataTableProps.bulkDock])

  const internalLoadingView = useMemo(() => {
    if (externalLoadingView) return externalLoadingView
    if (!isCustomView) return undefined
    if (policy?.cardComponent === "domain" || policy?.cardComponent === "entity" || externalRenderCustomView) {
      if (cardGroupBy) {
        return createCardGroupLoadingView({
          gridLayout: policy?.gridLayout,
          skeletonProps: cardSkeleton,
        })
      }
      return createCardLoadingView(policy?.gridLayout ?? "single-column", undefined, cardSkeleton)
    }
    return undefined
  }, [externalLoadingView, externalRenderCustomView, isCustomView, policy, cardSkeleton, cardGroupBy])

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
