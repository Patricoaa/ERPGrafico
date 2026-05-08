from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey


def field_to_json(field) -> dict:
    """Convierte un Django field a su descriptor JSON."""
    base = {
        'label': str(field.verbose_name) if hasattr(field, 'verbose_name') else field.name,
        'help_text': str(field.help_text) if getattr(field, 'help_text', None) else '',
        'required': not field.blank if hasattr(field, 'blank') else True,
        'readonly': not field.editable if hasattr(field, 'editable') else False,
    }

    if isinstance(field, models.CharField) and field.choices:
        return {**base, 'type': 'enum', 'choices': [
            {'value': v, 'label': str(l)} for v, l in field.choices
        ]}
    if isinstance(field, models.CharField):
        return {**base, 'type': 'string', 'max_length': field.max_length}
    if isinstance(field, models.TextField):
        return {**base, 'type': 'text'}
    if isinstance(field, models.IntegerField):
        return {**base, 'type': 'integer'}
    if isinstance(field, models.DecimalField):
        return {**base, 'type': 'decimal',
                'max_digits': field.max_digits, 'decimal_places': field.decimal_places}
    if isinstance(field, models.BooleanField):
        return {**base, 'type': 'boolean'}
    if isinstance(field, models.DateField):
        return {**base, 'type': 'date'}
    if isinstance(field, models.DateTimeField):
        return {**base, 'type': 'datetime'}
    if isinstance(field, models.JSONField):
        return {**base, 'type': 'json'}
    if isinstance(field, models.ForeignKey):
        return {
            **base,
            'type': 'fk',
            'target': field.related_model._meta.label_lower,
            'limit_choices_to': field.remote_field.limit_choices_to or {},
        }
    if isinstance(field, models.ManyToManyField):
        return {**base, 'type': 'm2m', 'target': field.related_model._meta.label_lower}
    if isinstance(field, models.FileField):
        return {**base, 'type': 'image' if isinstance(field, models.ImageField) else 'file'}
    return {**base, 'type': 'unknown'}


def build_schema(model: type[models.Model], user=None) -> dict:
    from core.registry import UniversalRegistry

    entity = UniversalRegistry.get_for_model(model)
    form_meta = getattr(model, 'FormMeta', None)

    fields_dict = {}
    excluded = set(getattr(form_meta, 'exclude_fields', ()))
    for field in model._meta.get_fields():
        if isinstance(field, GenericForeignKey):
            continue  # GFK handled separately
        if field.name in excluded:
            continue
        if hasattr(field, 'attname'):  # excluye reverse relations
            f_json = field_to_json(field)
            if form_meta and hasattr(form_meta, 'field_config'):
                if field.name in form_meta.field_config:
                    f_json.update(form_meta.field_config[field.name])
            fields_dict[field.name] = f_json

    schema = {
        'label': model._meta.label_lower,
        'verbose_name': str(model._meta.verbose_name),
        'verbose_name_plural': str(model._meta.verbose_name_plural),
        'fields': fields_dict,
        'permissions': {
            'view': f'{model._meta.app_label}.view_{model._meta.model_name}',
            'add': f'{model._meta.app_label}.add_{model._meta.model_name}',
            'change': f'{model._meta.app_label}.change_{model._meta.model_name}',
            'delete': f'{model._meta.app_label}.delete_{model._meta.model_name}',
        },
    }

    if entity:
        schema.update({
            'icon': entity.icon,
            'list_url': entity.list_url,
            'detail_url_pattern': entity.detail_url_pattern,
        })

    if form_meta:
        raw_layout = getattr(form_meta, 'ui_layout', {'tabs': [{'id': 'main', 'label': 'General', 'fields': list(fields_dict.keys())}]})

        # Resolve child_collection tabs: inject child field descriptors
        resolved_tabs = []
        for tab in raw_layout.get('tabs', []):
            if 'child_collection' in tab:
                cc = tab['child_collection']
                child_model_label = cc.get('model', '')
                child_columns = cc.get('columns', [])
                # Lazy resolve child model fields
                try:
                    from django.apps import apps
                    child_app, child_name = child_model_label.split('.')
                    child_model = apps.get_model(child_app, child_name)
                    child_form_meta = getattr(child_model, 'FormMeta', None)
                    child_excluded = set(getattr(child_form_meta, 'exclude_fields', ()))
                    child_fields = {}
                    for f in child_model._meta.get_fields():
                        if isinstance(f, GenericForeignKey):
                            continue
                        if f.name in child_excluded:
                            continue
                        if f.name not in child_columns:
                            continue
                        if hasattr(f, 'attname'):
                            child_fields[f.name] = field_to_json(f)
                    # Preserve column order
                    ordered_child_fields = {c: child_fields[c] for c in child_columns if c in child_fields}
                except Exception:
                    ordered_child_fields = {}

                resolved_tabs.append({
                    **tab,
                    'child_collection': {
                        **cc,
                        'field_schemas': ordered_child_fields,
                    }
                })
            else:
                resolved_tabs.append(tab)

        schema['ui_layout'] = {**raw_layout, 'tabs': resolved_tabs}
        schema['actions'] = getattr(form_meta, 'actions', [])
        schema['transitions'] = getattr(form_meta, 'transitions', {})

    return schema
