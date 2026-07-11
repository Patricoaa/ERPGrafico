"use client"

import React, { useMemo, useRef, useCallback } from "react"
import { type Row, type Table as ReactTable } from "@tanstack/react-table"
import { useViewMode } from "@/hooks/useViewMode"
import { ENTITY_REGISTRY } from "@/lib/entity-registry"
import { createDomainCardView, createEntityCardView, createCardLoadingView, createCardGroupView, createCardGroupLoadingView } from "@/lib/view-helpers"
import { DataTable, type DataTableProps } from "./DataTable"
import { DomainCard } from "./DomainCard"
import type { EntityCardSkeletonProps } from "./EntityCard"
import type { Group } from "@/lib/group-utils"
import { groupItems } from "@/lib/group-utils"
import type { UnifiedSearchConfig } from "@/types/unified-search"
import { TableRow, TableCell } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { AnalyticsPanelContent } from "./AnalyticsPanel"

interface CardGroupByDef {
  field: string
  sort?: 'asc' | 'desc'
  labelFn?: (key: string, rawKey: unknown, items: unknown[]) => { label: string; sublabel?: string }
  defaultLabel?: string
}

function getFieldValue(item: unknown, field: string): unknown {
  return (item as Record<string, unknown>)[field]
}

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
  /** @deprecated Migrate to unifiedSearchConfig + currentGroupBy */
  cardGroupBy?: CardGroupByDef
  unifiedSearchConfig?: UnifiedSearchConfig
  currentGroupBy?: string | null
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
  unifiedSearchConfig,
  currentGroupBy,
  cardSkeleton,
  ...dataTableProps
}: DataTableViewProps<TData, TValue>) {
  const policy = ENTITY_REGISTRY[entityLabel]?.viewPolicy

  const { currentView, handleViewChange, viewOptions, isCustomView } = useViewMode(entityLabel)
  const hasBulkActions = !!(dataTableProps.bulkActions?.length || dataTableProps.bulkDock)

  const derivedCardGroupBy = useMemo((): CardGroupByDef | undefined => {
    if (unifiedSearchConfig?.groupBy?.length && currentGroupBy) {
      const option = unifiedSearchConfig.groupBy.find(g => g.key === currentGroupBy)
      if (option) {
        return {
          field: option.field,
          sort: 'desc',
        }
      }
    }
    if (cardGroupBy) {
      return cardGroupBy
    }
    return undefined
  }, [unifiedSearchConfig, currentGroupBy, cardGroupBy])

  const isTableViewGrouped = derivedCardGroupBy && !isCustomView

  const internalCustomView = useMemo((): ((table: ReactTable<TData>) => React.ReactNode) | undefined => {
    if (!isCustomView) return undefined
    if (!policy && !externalRenderCustomView) return undefined
    if (externalRenderCustomView) return externalRenderCustomView
    if (!policy) return undefined

    const analyticsScreen = dataTableProps.analyticsPanel?.screen
    if (currentView === "analytics" && analyticsScreen) {
      return () => (
        <div className="flex-1 flex flex-col min-h-0 p-6">
          <AnalyticsPanelContent
            entityName={analyticsScreen.entityName}
            tabs={analyticsScreen.tabs}
            activeTab={analyticsScreen.activeTab}
            onTabChange={analyticsScreen.onTabChange}
          />
        </div>
      )
    }

    switch (policy.cardComponent) {
      case "domain":
        if (derivedCardGroupBy) {
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
            cardGroupBy: derivedCardGroupBy,
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
        if (derivedCardGroupBy) {
          return createCardGroupView({
            renderCard: renderCard as (data: Record<string, unknown>, row?: Row<Record<string, unknown>>, table?: ReactTable<Record<string, unknown>>) => React.ReactNode,
            cardGroupBy: derivedCardGroupBy,
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
  }, [externalRenderCustomView, isCustomView, policy, entityLabel, renderCard, isSelected, isHubOpen, derivedCardGroupBy, dataTableProps.onRowClick, dataTableProps.emptyState, dataTableProps.isFiltered, dataTableProps.analyticsPanel, currentView, hasBulkActions, dataTableProps.bulkActions, dataTableProps.bulkDock])

  const internalLoadingView = useMemo(() => {
    if (externalLoadingView) return externalLoadingView
    if (!isCustomView) return undefined
    if (policy?.cardComponent === "domain" || policy?.cardComponent === "entity" || externalRenderCustomView) {
      if (derivedCardGroupBy) {
        return createCardGroupLoadingView({
          gridLayout: policy?.gridLayout,
          skeletonProps: cardSkeleton,
        })
      }
      return createCardLoadingView(policy?.gridLayout ?? "single-column", undefined, cardSkeleton)
    }
    return undefined
  }, [externalLoadingView, externalRenderCustomView, isCustomView, policy, cardSkeleton, derivedCardGroupBy])

  // Group-by for table views
  const sortedData = useMemo(() => {
    if (!isTableViewGrouped) return dataTableProps.data
    const gb = derivedCardGroupBy
    const data = [...dataTableProps.data]
    return data.sort((a, b) => {
      const aVal = String(getFieldValue(a, gb.field) ?? '')
      const bVal = String(getFieldValue(b, gb.field) ?? '')
      return gb.sort === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal)
    })
  }, [isTableViewGrouped, derivedCardGroupBy, dataTableProps.data])

  const tableGroups = useMemo(() => {
    if (!isTableViewGrouped) return null
    const gb = derivedCardGroupBy
    return groupItems(
      sortedData,
      gb.field,
      {
        sort: gb.sort,
        labelFn: gb.labelFn,
        defaultLabel: gb.defaultLabel,
      },
    ) as Group<TData>[]
  }, [isTableViewGrouped, derivedCardGroupBy, sortedData])

  const groupsMap = useMemo(() => {
    if (!tableGroups) return undefined
    const map = new Map<string, Group<TData>>()
    for (const group of tableGroups) {
      map.set(group.key, group)
    }
    return map
  }, [tableGroups])

  const prevGroupKeyRef = useRef<string | null>(null)

  const internalRenderRow = useCallback(
    (row: Row<TData>, children: React.ReactNode) => {
      if (!isTableViewGrouped || !tableGroups) return children

      const gb = derivedCardGroupBy
      const rawVal = getFieldValue(row.original, gb.field)
      const groupKey = rawVal == null || rawVal === '' ? '' : String(rawVal)

      const prevKey = prevGroupKeyRef.current
      prevGroupKeyRef.current = groupKey

      if (prevKey !== null && prevKey === groupKey) {
        return children
      }

      const group = groupsMap?.get(groupKey)
      const headerLabel = group?.label ?? groupKey

      const colCount = dataTableProps.columns.length

      return (
        <React.Fragment>
          <TableRow className="bg-muted/30 hover:bg-muted/40 border-b border-border/60">
            <TableCell
              colSpan={colCount}
              className="py-1.5 px-3 text-xs font-semibold text-muted-foreground"
            >
              <span>{headerLabel}</span>
            </TableCell>
          </TableRow>
          {children}
        </React.Fragment>
      )
    },
    [isTableViewGrouped, tableGroups, derivedCardGroupBy, groupsMap, dataTableProps.columns],
  )

  return (
    <DataTable
      {...dataTableProps}
      data={isTableViewGrouped ? sortedData : dataTableProps.data}
      renderRow={isTableViewGrouped ? internalRenderRow : dataTableProps.renderRow}
      viewOptions={viewOptions}
      currentView={currentView}
      onViewChange={handleViewChange}
      renderCustomView={internalCustomView}
      renderLoadingView={internalLoadingView}
    />
  )
}
