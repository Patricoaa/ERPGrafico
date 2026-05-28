// ─────────────────────────────────────────────────────────
// Shared Components — Barrel Export
// ─────────────────────────────────────────────────────────
// This is the public API for all shared components.
// Features MUST import from '@/components/shared' (this file),
// not from individual component files.
// ─────────────────────────────────────────────────────────

// Search
export * from './UniversalSearch';

// Dynamic Entity Form (schema-driven)
export { EntityForm } from './EntityForm';
export type { EntityFormProps } from './EntityForm';
export type { EntitySchema, FieldSchema, TabSchema } from './EntityForm/hooks/useSchema';
export { useSchema } from './EntityForm/hooks/useSchema';

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
export * from './ActionButtons';
export * from './ActionDock';
export * from './BulkActionDock';

// Cards & Containers
export * from './StatCard';
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
export * from './AutoSaveStatusBadge';
export * from './ReportTable';
export * from './DataManagement';
export * from './CommentSystem';
export * from './AttachmentList';
export * from './DocumentAttachmentDropzone';

// Navigation & Layout
export * from './EntityHeader';
export * from './PageHeader';
export * from './PageContainer';
export * from './FormTabs';
export * from './FormFooter';
export * from './FormSplitLayout';
export * from './EntityDetailPage';
export * from './EmptyState';


// Industrial Identity
export * from './CropFrame';
export * from './IndustryMark';
export * from './Separators';
export * from './FormSection';

// Loading States
export * from './LoadingFallback';

// Animations
export * from './FadeIn';

// Smart Search
export { SmartSearchBar, useSmartSearch, useClientSearch } from './SmartSearchBar';
export type { FilterState } from './SmartSearchBar';

// Filters & Inputs
export * from './DatePicker';
export * from './DateRangeFilter';
export * from './FacetedFilter';
export * from './FolioValidationInput';
export * from './LabeledInput';
export * from './LabeledSelect';
export * from './LabeledContainer';
export * from './LabeledSwitch';
export * from './LabeledCheckbox';
export * from './MultiTagInput';
export * from './MultiSelectTagInput';
export * from './PeriodValidationDateInput';
export * from './AccountingLinesTable';
export * from './FormLineItemsTable';

export * from './EntityCard'
export * from './DomainCard'
export * from './CardActions'
export * from './ExpandableTableRow'

// ─── Migrated from components/ui — GOVERNANCE rule 21 compliance ─────────────
// Table system
export * from './DataTable';
export * from './DataTableView';
export * from './DataTableToolbar';
export * from './DataTableFilters';
export * from './DataTablePagination';
export * from './DataTableColumnHeader';
export * from './DataTableFacetedFilter';
export * from './DataTableCells';

// Utilities
export * from './DynamicIcon'
export * from './ErrorBoundary'
export * from './Numpad'
export * from './PrintableReceipt'

// Product Selector family (PR-1, PR-2, PR-3)
export { SearchBar, CategoryFilter, ProductGrid, VariantSelectorModal, ProductSelector } from './ProductSelector'
export type { SearchBarProps, CategoryFilterProps, ProductGridProps, SharedStockLimits, VariantSelectorModalProps, ProductSelectorProps } from './ProductSelector'
