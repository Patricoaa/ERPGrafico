import os
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

def validate_file_size(value):
    """
    Validates that the file size is within the allowed limit.
    Default limit: 10MB
    """
    limit = 10 * 1024 * 1024 # 10MB
    if value.size > limit:
        raise ValidationError(_('El archivo es demasiado grande. El tamaño máximo permitido es 10MB.'))

def validate_file_extension(value):
    """
    Validates that the file has an allowed extension.
    """
    ext = os.path.splitext(value.name)[1].lower()
    valid_extensions = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.xls', '.xlsx', '.csv', '.zip', '.rar']
    if ext not in valid_extensions:
        raise ValidationError(_('Extensión de archivo no permitida. Permitidos: ') + ", ".join(valid_extensions))

def validate_image_extension(value):
    """
    Validates that the file is an image with an allowed extension.
    """
    ext = os.path.splitext(value.name)[1].lower()
    valid_extensions = ['.jpg', '.jpeg', '.png', '.webp']
    if ext not in valid_extensions:
        raise ValidationError(_('Extensión de imagen no permitida. Permitidos: ') + ", ".join(valid_extensions))
