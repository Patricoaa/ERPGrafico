// ─────────────────────────────────────────────────────────
// Shared Components — Barrel Export
// ─────────────────────────────────────────────────────────
// This is the public API for all shared components.
// Features MUST import from '@/components/shared' (this file),
// not from individual component files.
// ─────────────────────────────────────────────────────────

// Charts
export * from './charts';

// Search
export * from './UniversalSearch';

// Modals & Sheets
export * from './ActionConfirmModal';
export * from './BaseModal';
export * from './Drawer';
export * from './PanelHeader';
export * from './CollapsibleSheet';
export * from './SheetCloseButton';

export * from './GenericWizard';

// Buttons & Actions
export * from './ActionFoldButton';
export * from './ActionSlideButton';
export * from './ToolbarCreateButton';
export * from './ActionButtons'
export * from './StepHeader';
export * from './WizardStepsSidebar';
export * from './WizardSummarySidebar';
export * from './ActionDock';

// Cards & Containers
export * from './StatCard';
export * from './AnalyticsPanel';
export * from './CardSkeleton';
export * from './SkeletonShell';
export * from './LayoutSkeletons';
export { Skeleton } from '@/components/ui/skeleton';

// Data Display
export * from './ColorBar';
export * from './MoneyDisplay';
export * from './QuantityDisplay';
export * from './StatusBadge';
export * from './Chip';
export * from './HubStatus';
export * from './EntityBadge';
export * from './SourceDocumentLink';
export * from './ChartTooltip';
export * from './AutoSaveStatusBadge';
export * from './ReportTable';
export * from './DataManagement';
export * from './CommentSystem';
export * from './AttachmentList';
export * from './DocumentAttachmentDropzone';
export * from './DocumentCompletionModal';
export * from './Badge';
export * from './HeaderNavDropdowns';

// Navigation & Layout
export * from './EntityHeader';
export * from './PageHeader';
export * from './PageContainer';
export * from './PageSectionHeader';
export * from './TabBar';
export * from './FormFooter';
export * from './FormSplitLayout';
export * from './EmptyState';
export * from './SectionHeader';
export * from './ModuleLauncher';

export * from './Separators';
export * from './FormSection';

// Loading States
export * from './LoadingFallback';

// Animations
export * from './FadeIn';

// Generic Popover with search
export { SearchablePopover } from './SearchablePopover';
export type { SearchablePopoverProps } from './SearchablePopover';

/** Active filter params derived from a search definition, ready to send to the API. */
export type FilterState = Record<string, string>

// Toolbar styles (shared typography & layout tokens)
export { SEG_TEXT, SEG_WRAPPER, SEG_TRIGGER, SEG_ACTIVE, SEG_INACTIVE, SEG_DROPDOWN_ITEM, SEG_MENU_ITEM, SEG_CHECKBOX, SEG_INPUT, TOOLBAR_ICON_BTN, TOOLBAR_MENU_ITEM, TAB_TOOLBAR_TRIGGER } from './search-styles';

// Segmentation table context (for dynamic multi-select filters in UnifiedSearchBar)
export { useSegmentationTable } from './SegmentationTableContext';

// Unified Search (reemplaza SmartSearch + Segmentation + GroupBy)
export { UnifiedSearchBar, useUnifiedSearch } from './UnifiedSearchBar';
export type {
  UnifiedSearchConfig,
  UnifiedChip,
  UseUnifiedSearchReturn,
  TextFieldDef,
  ToggleFilterDef,
  DateFilterDef,
  RangeFilterDef,
  GroupByOptionDef,
  DropdownFilterDef,
  SingleSelectFilterDef,
  MultiSelectOption,
} from '@/types/unified-search';

// Filters & Inputs
export * from './DatePicker';
export * from './DateRangeFilter';
export * from './ReportToolbar';
export * from './FacetedFilter'
export * from './RadioCard';
export * from './FolioValidationInput';
export * from './LabeledInput';
export * from './LabeledSelect';
export * from './LabeledContainer';
export * from './LabeledSwitch';
export * from './LabeledCheckbox';
export * from './LabeledCheckboxGroup';
export * from './NotchedButton';
export * from './MultiTagInput';
export * from './MultiSelectTagInput';
export * from './PeriodValidationDateInput';
export * from './AccountField';
export * from './AccountingLinesTable';
export * from './FormLineItemsTable';

export * from './EntityCard'
export * from './DomainCard'
export * from './CardActions'
// ─── Migrated from components/ui — GOVERNANCE rule 21 compliance ─────────────
// Table system
export * from './emptyStateResolver';
export * from './DataTable';
export * from './DataTableView';
export * from './DataTableToolbar';
export * from './DataTablePagination';
export * from './DataTableColumnHeader';
export * from './DataTableFacetedFilter';
export * from './DataTableColumnToggle';
export * from './DataTableCells';

// Utilities
export * from './DynamicIcon'
export * from './ErrorBoundary'
export * from './CmykRing'
export * from './PrepressPanel'
export * from './entity-actions'
export * from './Numpad'

export * from './PrintableReceipt'

export * from './ContactSelector'
// Product Selector family (PR-1, PR-2, PR-3)
export { SearchBar, CategoryFilter, ProductGrid, VariantSelectorModal, ProductSelector, CategoryDropdown } from './ProductSelector'
export type { SearchBarProps, CategoryFilterProps, ProductGridProps, SharedStockLimits, VariantSelectorModalProps, ProductSelectorProps } from './ProductSelector'
export * from './manufacturing'
