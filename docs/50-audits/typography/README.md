# Auditoría de Tipografía — ERPGrafico

**Fecha:** 2026-05-15  
**Auditor:** Claude Sonnet 4.6  
**Estado global:** En ejecución

---

## Resumen ejecutivo

El sistema de design tokens y las primitivas compartidas están en excelente estado (~94/100). La deuda real vive en los `features/` donde ~2.400 instancias de tipografía ad-hoc reproducen patrones ya centralizados sin usar los componentes correctos.

| Área | Score | Estado |
|------|-------|--------|
| `components/ui/` (primitivas shadcn) | 98/100 | ✅ Excelente |
| `components/shared/` (sistema propio) | 94/100 | ✅ Bueno — 2 bugs menores |
| `features/` (aplicaciones) | 65/100 | ⚠️ Deuda activa |
| Documentación de contratos | 85/100 | ⚠️ 2 gaps críticos |

---

## Archivos de este audit

| Archivo | Contenido |
|---------|-----------|
| [audit-report.md](audit-report.md) | Hallazgos completos con evidencia por archivo |
| [implementation-plan.md](implementation-plan.md) | Plan de tareas priorizadas con contexto para ejecución |

---

## Invariantes del sistema (referencia rápida)

El sistema de 3 capas tipográficas es el núcleo del diseño:

| Capa | Componente | Tipografía canónica |
|------|------------|---------------------|
| **L1** Sección | `<FormSection>` | `text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground/70` |
| **L2** Etiqueta | `<LabeledInput>` legend | `text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground` |
| **L3** Valor | Input content | `text-sm font-normal text-foreground` |

Botón de acción canónico: `h-9 text-[10px] font-black uppercase tracking-widest`

---

## Quick reference: tokens disponibles

```
Fuentes:    font-sans (Onest) · font-heading (Syne) · font-mono
Colores:    text-primary · text-accent · text-success · text-warning · text-destructive · text-info
            text-foreground · text-muted-foreground · text-secondary-foreground
Estados:    bg-success · bg-warning · bg-destructive · bg-info · bg-primary · bg-accent
```
