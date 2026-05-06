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

### Fase de Desarrollo Inicial (Versiones `0.x.x`)

Mientras el proyecto se encuentre en una versión menor a `1.0.0` (fase de desarrollo inicial), el estándar SemVer aplica reglas especiales, ya que asume que la API aún no es estable:
- Los commits `feat:` incrementarán el nivel **PATCH** (tercer nivel) en lugar de MINOR.
- Los commits `fix:` incrementarán el nivel **PATCH**.

### Cómo pasar a la Versión Estable (`1.0.0`)

Cuando el sistema esté listo para salir de su fase inicial y comportarse con las reglas definitivas (donde `feat:` cambia el segundo nivel), debes forzar el salto a la versión `1.0.0`.

Para hacerlo de forma automatizada mediante GitHub Actions (creando un commit que le indique a `standard-version` que debe lanzar la `1.0.0`), haz lo siguiente:

1. Realiza un commit vacío o acompaña un cambio con la indicación de **Breaking Change**:
   ```bash
   git commit -m "feat!: primera versión estable del sistema ERP"
   ```
2. Al hacer `push`, el sistema detectará el `feat!:` (Major) y saltará automáticamente a `v1.0.0`.
3. A partir de ese momento, `feat:` incrementará el nivel MINOR y `fix:` el nivel PATCH.

## Automated Changelog

ERPGrafico features an automated `CHANGELOG.md` at the root of the project. This file is updated every time a release is created (either locally or via GitHub Actions).

### How it works:
1.  **Parsing Commits**: The system scans all commit messages since the last tag.
2.  **Grouping**: It groups them by type (Features, Bug Fixes, etc.) based on the prefix.
3.  **Versioning**: It calculates whether to bump the Major, Minor, or Patch level automatically.

### Conventional Commits Guide:

| Prefix | Changelog Section | Description |
| :--- | :--- | :--- |
| `feat:` | ✨ Features | New functionality for the user. |
| `fix:` | 🐛 Bug Fixes | A bug fix for the user. |
| `chore:` | 🚀 Maintenance | Build process, auxiliary tools, or library updates. |
| `docs:` | 📚 Documentation | Documentation changes only. |
| `style:` | 💅 Styling | Changes that do not affect the meaning of the code (white-space, formatting, etc). |
| `refactor:` | ⚙️ Refactors | A code change that neither fixes a bug nor adds a feature. |
| `perf:` | ⚡ Performance | A code change that improves performance. |
| `test:` | 🧪 Testing | Adding missing tests or correcting existing tests. |

## Release Process

We use an automated release process to ensure the Frontend and Backend are always in sync and the Changelog is updated.

### Local Release (Manual):

1.  **Prepare**: Ensure your working directory is clean.
2.  **Execute**: Run the release script:
    ```bash
    ./release.sh [patch|minor|major]
    ```
    *If you don't provide a level, the system will try to calculate it automatically based on your commits.*
3.  **Publish**: Push the code and tags:
    ```bash
    git push && git push --tags
    ```

### Automated Release (CI/CD):

Every push to `master` or `main` triggers the automated versioning pipeline. If the commits contain `feat:` or `fix:`, the system will automatically:
1.  Bump the version.
2.  Update the `CHANGELOG.md`.
3.  Push a new commit and tag back to the repository.

## Traceability

Every build displayed in the "Settings > System Status" includes:
-   **Version Number**: Synchronized across Frontend and Backend.
-   **Git Hash**: The short SHA of the commit.
-   **Build Date**: The timestamp of the build.

This information is critical for debugging issues in production environments.
