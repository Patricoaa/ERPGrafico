// First, before anything that can reach an import cycle: the `docRef` builder has no runtime imports (lote 3a).
export { docRef, type DocRefValue } from './entity-view/docRef'
export { DocumentRelationsTab, DocumentRefLink, DocumentRelationsButton, DocumentResolverView, DocumentSheet, SHEET_LEFT, type DocumentRelationsTabProps, type DocumentSheetProps, type DocumentSheetSection } from './components'
export { DOCUMENTS_KEYS } from './hooks/queryKeys'
export { useDocumentRef } from './hooks/useDocumentRef'
export { useDocumentRelations } from './hooks/useDocumentRelations'
export type { DocumentDomain, DocumentLink, DocumentRef, DocumentRelations, DocumentRelationsFilters, DocumentSemantic } from './types'
export { DOCUMENT_DOMAINS } from './types'
export { DOCUMENT_DOMAIN_META } from './utils/domains'
export { useOpenRelatedDocument } from './hooks/useOpenRelatedDocument'
export { useInvalidateDocuments } from './hooks/useInvalidateDocuments'
export { resolveRegistryActions, type ResolvedDocumentAction } from './utils/actions'
// entity-view extension (ADR-0087 A1): registers the `docRef` kind (the builder is exported first, above).
import './entity-view/docRef.kind'
