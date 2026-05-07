// ─────────────────────────────────────────────────────────
// Shared Components — Barrel Export
// ─────────────────────────────────────────────────────────
// This is the public API for all shared components.
// Features MUST import from '@/components/shared' (this file),
// not from individual component files.
// ─────────────────────────────────────────────────────────

// Search
export * from './UniversalSearch';

// Modals & Sheets
export * from './ActionConfirmModal';
export * from './BaseModal';
export * from './BaseDrawer';
export * from './CollapsibleSheet';
export * from './DocumentCompletionModal';
export * from './GenericWizard';

export * from './SheetCloseButton';
export * from './TransactionViewModal';
export * from './transaction-modal';

// Buttons & Actions
export * from './ActionFoldButton';
export * from './ActionSlideButton';
export * from './ToolbarCreateButton';
export * from './ActionButtons';
export * from './ActionDock';
export * from './BulkActionDock';

// Cards & Containers

export * from './CardSkeleton';
export * from './FormSkeleton';
export * from './TableSkeleton';
export * from './SkeletonShell';
export * from './LayoutSkeletons';
export { Skeleton } from '@/components/ui/skeleton';

// Data Display
export * from './ColorBar';
export * from './MoneyDisplay';
export * from './QuantityDisplay';
export * from './StatusBadge';
export * from './AutoSaveStatusBadge';
export * from './ReportTable';
export * from './DataManagement';
export * from './CommentSystem';
export * from './AttachmentList';
export * from './DocumentAttachmentDropzone';

// Navigation & Layout
export * from './PageHeader';
export * from './PageContainer';
export * from './FormTabs';
export * from './FormFooter';
export * from './FormSplitLayout';
export * from './EmptyState';

// Industrial Identity
export * from './CropFrame';
export * from './IndustryMark';
export * from './Separators';
export * from './FormSection';

// Loading States
export * from './LoadingFallback';

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

