# ADR 0012: Unified System Versioning

## Status
Accepted

## Context
As the project grows, it becomes difficult to track which version of the frontend is compatible with which version of the backend. Furthermore, the lack of a standardized release process makes it hard to identify specific builds in production and link them back to the source code (traceability).

The previous approach used hardcoded strings in the UI and no formal Git tagging strategy.

## Decision
We will implement a **Unified Semantic Versioning (SemVer)** system that synchronizes both Frontend and Backend under a single version number.

Key technical components:
1.  **Single Source of Truth**: The version is managed via `frontend/package.json` and mirrored in `backend/VERSION`.
2.  **Automated Release Script**: A `./release.sh` script handles bumping versions, creating Git tags, and committing changes to prevent manual errors.
3.  **Git Hash Injection**: Every build automatically captures the short Git SHA and displays it in the system status, providing 100% traceability to the source code.
4.  **System Status API**: The backend exposes `/api/core/status/` to allow the frontend to verify cross-stack compatibility.

## Consequences
- **Pros**:
    - Guaranteed compatibility between frontend and backend versions.
    - Easy bug reporting (users can provide a specific version + hash).
    - Automated Git history with clear release markers (tags).
- **Cons**:
    - Requires a full project release even if only one side changed (this is acceptable for this project's scale).
    - Requires using the `./release.sh` script instead of manual edits.

## Industry Standard Reference
This implementation follows **Semantic Versioning 2.0.0 (SemVer)**:
- `MAJOR` version when you make incompatible API changes.
- `MINOR` version when you add functionality in a backwards compatible manner.
- `PATCH` version when you make backwards compatible bug fixes.
