---
status: active
owner: backend-team
last_review: 2026-05-10
---

# Playbook: Agregar Entidad a la Búsqueda Global

Este instructivo detalla cómo hacer que un nuevo modelo de Django sea buscable desde la barra de búsqueda global del ERP.

## Precondiciones
1. El modelo debe tener un identificador único (usualmente un número correlativo o `id`).
2. Debe estar definida la ruta de detalle en el frontend.

## Paso 1: Configuración en el Backend (`apps.py`)

Debes registrar la entidad en el `ready()` de tu aplicación utilizando el `UniversalRegistry`.

```python
# apps/[app_name]/apps.py

class MyAppConfig(AppConfig):
    ...
    def ready(self):
        try:
            from core.registry import UniversalRegistry, SearchableEntity
            from .models import MyModel
            
            UniversalRegistry.register(SearchableEntity(
                model=MyModel,
                label='myapp.mymodel',           # app_label.model_name
                title_singular='Mi Entidad',
                title_plural='Mis Entidades',
                icon='package',                  # Nombre del icono Lucide
                search_fields=('number', 'name', 'customer__name'), # Campos a indexar
                short_display_template='ENT-{number}', # Cómo se ve el ID corto
                display_template='ENT-{number} · {name}', # Título en resultados
                subtitle_template='{customer.name}',      # Subtítulo en resultados
                extra_info_template='{status}',           # Info adicional a la derecha
                list_url='/myapp/entities',
                detail_url_pattern='/myapp/entities/{id}',
                permission='myapp.view_mymodel', # Permiso requerido para ver
            ))
        except Exception:
            pass
```

### Reglas para `search_fields`:
- Campos directos (ej. `name`) se indexan mediante Full-Text Search (FTS).
- Campos relacionales (ej. `customer__name`) se indexan mediante la misma lógica pero se consultan por `icontains` en el fallback.

## Paso 2: Configuración en el Frontend (`lib/entity-registry.ts`)

Para que los iconos y formatos coincidan, añade la entidad al registro del frontend.

```typescript
// frontend/lib/entity-registry.ts

'myapp.mymodel': {
  label: 'myapp.mymodel',
  title: 'Mi Entidad',
  titlePlural: 'Mis Entidades',
  icon: Package, // Importar desde lucide-react
  shortTemplate: 'ENT-{number}',
  listUrl: '/myapp/entities',
  detailUrlPattern: '/myapp/entities/{id}',
},
```

## Paso 3: Sincronización Inicial

Al registrar la entidad, el sistema conectará automáticamente las `signals` para futuros cambios. Sin embargo, para indexar los datos **existentes**, debes ejecutar:

```bash
docker exec erpgrafico-backend-1 python manage.py rebuild_search_index
```

## Paso 4: Verificación
1. Reinicia el servidor de desarrollo.
2. Escribe el prefijo (ej. `ENT-`) en el buscador global. Deberían aparecer los registros recientes.
3. Busca por un nombre o número específico.

## Troubleshooting
- **No aparece nada**: Verifica que el usuario tenga el `permission` definido en el registro.
- **Error de campos**: Asegúrate que los nombres en `short_display_template` y `search_fields` existen en el modelo.
- **Icono no carga**: Verifica que el nombre del icono en el backend coincida (kebab-case) y esté importado en el frontend.
