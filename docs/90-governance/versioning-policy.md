# Versioning Policy

This document defines how ERPGrafico manages its versioning and release lifecycle.

## Semantic Versioning (SemVer)

ERPGrafico follows the `MAJOR.MINOR.PATCH` format (e.g., `1.2.3`).

### Cuando incrementar:

| Nivel | Tipo de Cambio | Prefijo de Commit (VS Code) | Ejemplo |
|-------|----------------|-----------------------------|---------|
| **PATCH** | Bugfixes / Ajustes menores | `fix:` | `fix: corregido error en cálculo de IVA` |
| **MINOR** | Nuevas Funcionalidades | `feat:` | `feat: añadir módulo de RRHH` |
| **MAJOR** | Cambios que rompen (Breaking) | `feat!:` o `fix!:` | `feat!: rediseño de arquitectura de base de datos` |

> [!TIP]
> Para un **MAJOR**, también puedes añadir `BREAKING CHANGE:` en la descripción del commit.

## Release Process

We use an automated release process to ensure the Frontend and Backend are always in sync.

### Steps to create a release:

1.  **Prepare**: Ensure all your changes are committed and your working directory is clean.
2.  **Execute**: Run the release script with the desired level:
    ```bash
    ./release.sh patch
    ```
3.  **Publish**: Push the code and the new tags:
    ```bash
    git push && git push --tags
    ```

## Traceability

Every build displayed in the "Settings > System Status" includes:
-   **Version Number**: The SemVer version from `package.json`.
-   **Git Hash**: The short SHA of the commit that generated the build.
-   **Build Date**: The timestamp of the build.

This information is critical for debugging issues in production environments.
