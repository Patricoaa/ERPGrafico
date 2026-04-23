// ─────────────────────────────────────────────────────────
// Shared Components — Barrel Export
// ─────────────────────────────────────────────────────────
// This is the public API for all shared components.
// Features MUST import from '@/components/shared' (this file),
// not from individual component files.
// ─────────────────────────────────────────────────────────

// Modals & Sheets
export * from './ActionConfirmModal';
export * from './BaseModal';
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
export * from './ReportTable';
export * from './DataManagement';
export * from './CommentSystem';
export * from './AttachmentList';
export * from './DocumentAttachmentDropzone';

// Navigation & Layout
export * from './PageHeader';
export * from './PageTabs';
export * from './EmptyState';

// Industrial Identity
export * from './CropFrame';
export * from './IndustryMark';
export * from './Separators';

// Loading States
export * from './LoadingFallback';

// Filters & Inputs
export * from './DatePicker';
export * from './DateRangeFilter';
export * from './FacetedFilter';
export * from './FolioValidationInput';
export * from './PeriodValidationDateInput';
