---
layer: 90-governance
doc: versioning-policy
status: active
owner: core-team
last_review: 2026-05-21
stability: stable
---

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

## Changelog

El `CHANGELOG.md` en la raíz del proyecto se actualiza **manualmente** con cada release. El proceso automatizado vía `standard-version` o GitHub Actions está planificado pero no está activo.

### Conventional Commits — qué va en el changelog:

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

## Release Process (manual actual)

1.  Asegúrate de que el directorio de trabajo está limpio.
2.  Bump de versión en `frontend/package.json`.
3.  Commit: `chore(release): X.Y.Z`
4.  Tag y push:
    ```bash
    git tag vX.Y.Z && git push && git push --tags
    ```
