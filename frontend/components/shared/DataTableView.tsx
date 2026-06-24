"use client"

import React, { useMemo } from "react"
import { type Row, type SortingState, type Table as ReactTable } from "@tanstack/react-table"
import { useViewMode } from "@/hooks/useViewMode"
import { ENTITY_REGISTRY } from "@/lib/entity-registry"
import { createDomainCardView, createEntityCardView, createCardLoadingView, createCardGroupView, createCardGroupLoadingView } from "@/lib/view-helpers"
import { type AggregatorDef } from "@/lib/group-utils"
import { DataTable, type DataTableProps } from "./DataTable"
import { DomainCard } from "./DomainCard"

interface DataTableViewProps<TData, TValue>
  extends Omit<DataTableProps<TData, TValue>,
    "viewOptions" | "currentView" | "onViewChange" | "renderCustomView" | "renderLoadingView" | "sortOptions"
  > {
  entityLabel: string
  renderCustomView?: (table: ReactTable<TData>) => React.ReactNode
  renderLoadingView?: () => React.ReactNode
  renderCard?: (data: TData, row: Row<TData>) => React.ReactNode
  isSelected?: (data: TData) => boolean
  isHubOpen?: boolean
  cardGroupBy?: {
    field: string
    sort?: 'asc' | 'desc'
    labelFn?: (key: string, rawKey: unknown, items: TData[]) => { label: string; sublabel?: string }
    defaultLabel?: string
    aggregators?: AggregatorDef[]
  }
  cardSkeleton?: Pick<import("./EntityCard").EntityCardSkeletonProps, 'showHeader' | 'showBody' | 'showFooter'>
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

  const effectiveInitialSorting: SortingState | undefined = cardGroupBy
    ? [{ id: cardGroupBy.field, desc: cardGroupBy.sort !== 'asc' }]
    : undefined
  const { currentView, handleViewChange, viewOptions, isCustomView } = useViewMode(entityLabel)

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
            renderCard: (data: Record<string, unknown>) =>
              React.createElement(DomainCard, {
                label: entityLabel,
                data,
                isSelected: isSelected?.(data as TData) ?? false,
                isHubOpen: isHubOpen ?? false,
                onClick: () => dataTableProps.onRowClick?.(data as TData),
              }),
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
        }) as unknown as (table: ReactTable<TData>) => React.ReactNode
      case "entity":
        if (!renderCard) return undefined
        if (cardGroupByAsRecord) {
          return createCardGroupView({
            renderCard: renderCard as (data: Record<string, unknown>) => React.ReactNode,
            cardGroupBy: cardGroupByAsRecord,
            gridLayout: policy.gridLayout,
            emptyState: dataTableProps.emptyState,
            isFiltered: dataTableProps.isFiltered,
          }) as unknown as (table: ReactTable<TData>) => React.ReactNode
        }
        return createEntityCardView(entityLabel, {
          renderCard: renderCard as (data: Record<string, unknown>, row: Row<Record<string, unknown>>) => React.ReactNode,
          gridLayout: policy.gridLayout,
          emptyState: dataTableProps.emptyState,
          isFiltered: dataTableProps.isFiltered,
        }) as unknown as (table: ReactTable<TData>) => React.ReactNode
      default:
        return undefined
    }
  }, [externalRenderCustomView, isCustomView, policy, entityLabel, renderCard, isSelected, isHubOpen, cardGroupBy, dataTableProps.onRowClick, dataTableProps.emptyState, dataTableProps.isFiltered])

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
      initialSorting={effectiveInitialSorting}
    />
  )
}
