---
target: wizard de la OT
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/home/pato/Nextcloud/Pato/Aplicaciones/ERPGrafico/frontend/features/production/components/WorkOrderWizard.tsx"
target_fingerprint: "sha256:269dd75fd46f4c9f071379a6c7e1a77b42c0a035e5cf58e0f307548eab6913b4"
target_path: /home/pato/Nextcloud/Pato/Aplicaciones/ERPGrafico/frontend/features/production/components/WorkOrderWizard.tsx
timestamp: 2026-10-27T14-49-23Z
slug: production-components-workorderwizard-tsx-e85d0673
---
# Critique: wizard de la OT (pasos, edición de etapas y retroceso)
Método: single-context (sin navegador; revisión desde código). Detector: 0 hallazgos.
Score 22/40. Problemas: [P1] riel sobrecargado (13 filas, ~24 iconos de acción por fila pasada); [P1] "Anterior"/"Seleccionar Producto"/texto de creación contradictorio; [P1] tres modos (ver/editar/retroceder) para un gesto -> Leer + Reabrir etapa; [P2] bloqueo avisado en 4 sitios; [P2] móvil sin editar/retroceder, Esc y Ctrl+→ sin confirmar, acciones bloqueadas al 30% de opacidad; [P3] duplicación (subtítulo, panel, cajas de instrucciones).
