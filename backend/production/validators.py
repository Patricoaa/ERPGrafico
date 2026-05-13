from rest_framework.exceptions import ValidationError


# Keys allowed at the root of stage_data and inside each phase sub-object
_PHASE_KEYS = frozenset({
    'internal_notes', 'product_description',
    'contact_id', 'contact_name', 'contact_tax_id',
    'folio_enabled', 'folio_start',
    'design_attachments', 'design_approved', 'approval_attachment',
    'prepress_specs', 'press_specs', 'postpress_specs',
    'design_needed', 'print_type', 'comments',
})

_ROOT_ONLY_KEYS = frozenset({
    'quantity', 'uom_id', 'uom_name', 'phases',
    'prepress', 'press', 'postpress',
})

_BOOL_FIELDS = {'folio_enabled', 'design_approved', 'design_needed'}
_STR_FIELDS = {
    'internal_notes', 'product_description', 'contact_name', 'contact_tax_id',
    'folio_start', 'approval_attachment', 'print_type',
    'prepress_specs', 'press_specs', 'postpress_specs', 'uom_name',
}


def _validate_phase_data(data: dict, prefix: str = '') -> None:
    """Validate the common shape shared by root and each phase sub-object."""
    for field in _BOOL_FIELDS:
        if field in data and not isinstance(data[field], bool):
            raise ValidationError({f'{prefix}{field}': 'Debe ser un booleano (true/false).'})

    for field in _STR_FIELDS:
        if field in data and data[field] is not None and not isinstance(data[field], str):
            raise ValidationError({f'{prefix}{field}': 'Debe ser una cadena de texto.'})

    if 'design_attachments' in data and not isinstance(data['design_attachments'], list):
        raise ValidationError({f'{prefix}design_attachments': 'Debe ser una lista de nombres de archivo.'})

    if 'comments' in data:
        comments = data['comments']
        if not isinstance(comments, list):
            raise ValidationError({f'{prefix}comments': 'Debe ser una lista.'})
        for i, comment in enumerate(comments):
            if not isinstance(comment, dict):
                raise ValidationError({f'{prefix}comments[{i}]': 'Cada comentario debe ser un objeto.'})
            for required in ('id', 'user', 'text', 'timestamp'):
                if required not in comment:
                    raise ValidationError({f'{prefix}comments[{i}].{required}': 'Campo requerido.'})

    if 'quantity' in data:
        try:
            float(data['quantity'])
        except (TypeError, ValueError):
            raise ValidationError({f'{prefix}quantity': 'Debe ser un número.'})


def validate_transition_data(data: dict, stage: str) -> dict:
    """
    Validate and return `data` before it is merged into stage_data[stage].
    Raises ValidationError with field-level messages on any violation.
    """
    if not isinstance(data, dict):
        raise ValidationError('El campo data debe ser un objeto JSON.')

    _validate_phase_data(data)
    return data


def validate_stage_data(stage_data: dict) -> dict:
    """
    Validate the full stage_data object (called on WorkOrder save).
    Raises ValidationError on structural violations.
    """
    if not isinstance(stage_data, dict):
        raise ValidationError({'stage_data': 'Debe ser un objeto JSON.'})

    _validate_phase_data(stage_data)

    if 'phases' in stage_data:
        phases = stage_data['phases']
        if not isinstance(phases, dict):
            raise ValidationError({'phases': 'Debe ser un objeto con claves prepress, press, postpress.'})
        for key in ('prepress', 'press', 'postpress'):
            if key in phases and not isinstance(phases[key], bool):
                raise ValidationError({f'phases.{key}': 'Debe ser un booleano.'})

    for phase in ('prepress', 'press', 'postpress'):
        if phase in stage_data:
            phase_data = stage_data[phase]
            if not isinstance(phase_data, dict):
                raise ValidationError({phase: 'Debe ser un objeto JSON.'})
            _validate_phase_data(phase_data, prefix=f'{phase}.')

    return stage_data
