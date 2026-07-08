import os
import uuid
from io import BytesIO

from django.core.files.base import ContentFile
from django.utils import timezone
from django.utils.deconstruct import deconstructible
from PIL import Image


def get_current_date():
    """
    Returns the current date from the server (respects mock time).
    Used as default for DateFields to avoid AssertionError with DRF serialization.
    """
    return timezone.now().date()


@deconstructible
class UploadPath:
    """
    Serializable class for generating UUID-based upload paths.
    """

    def __init__(self, folder):
        self.folder = folder

    def __call__(self, instance, filename):
        ext = filename.split(".")[-1]
        name = f"{uuid.uuid4()}.{ext}"
        return os.path.join(self.folder, name)


def generic_upload_path(folder):
    """
    Returns an instance of UploadPath (serializable for migrations).
    """
    return UploadPath(folder)


def compress_image(image_field, quality=80, max_width=1200):
    """
    Compresses an image from a FileField/ImageField.
    Preserves RGBA transparency, outputs WEBP format.
    Returns a ContentFile if compressed, else original.
    """
    if not image_field:
        return None

    try:
        img = Image.open(image_field)

        # Preserve alpha channel for WEBP (unlike JPEG)
        preserve_alpha = img.mode in ("RGBA", "P", "LA")

        if img.mode == "P":
            img = img.convert("RGBA" if img.info.get("transparency") else "RGB")
        elif img.mode == "LA":
            img = img.convert("RGBA")

        # Resize if too large (preserving aspect ratio)
        if img.width > max_width:
            ratio = max_width / float(img.width)
            new_height = int(float(img.height) * ratio)
            img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)

        if img.height > max_width:
            ratio = max_width / float(img.height)
            new_width = int(float(img.width) * ratio)
            img = img.resize((new_width, max_width), Image.Resampling.LANCZOS)

        output = BytesIO()
        save_kwargs = {"format": "WEBP", "quality": quality, "optimize": True}
        if preserve_alpha:
            save_kwargs["lossless"] = False
        img.save(output, **save_kwargs)
        output.seek(0)

        # Rename extension to .webp
        base = os.path.splitext(image_field.name)[0]
        new_name = f"{base}.webp"

        return ContentFile(output.read(), name=new_name)
    except Exception as e:
        print(f"Error compressing image: {e}")
        return image_field
