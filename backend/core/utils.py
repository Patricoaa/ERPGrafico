import os
import uuid
from PIL import Image
from io import BytesIO
from django.core.files.base import ContentFile
from django.utils.deconstruct import deconstructible

@deconstructible
class UploadPath:
    """
    Serializable class for generating UUID-based upload paths.
    """
    def __init__(self, folder):
        self.folder = folder

    def __call__(self, instance, filename):
        ext = filename.split('.')[-1]
        name = f"{uuid.uuid4()}.{ext}"
        return os.path.join(self.folder, name)

def generic_upload_path(folder):
    """
    Returns an instance of UploadPath (serializable for migrations).
    """
    return UploadPath(folder)

def compress_image(image_field, quality=70, max_width=1200):
    """
    Compresses an image from a FileField/ImageField.
    Returns a ContentFile if compressed, else original.
    """
    if not image_field:
        return None
        
    try:
        img = Image.open(image_field)
        
        # Convert to RGB if necessary (e.g. RGBA -> RGB for JPEG)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
            
        # Resize if too large
        if img.width > max_width:
            ratio = max_width / float(img.width)
            new_height = int(float(img.height) * ratio)
            img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
            
        output = BytesIO()
        img.save(output, format='JPEG', quality=quality, optimize=True)
        output.seek(0)
        
        return ContentFile(output.read(), name=image_field.name)
    except Exception as e:
        print(f"Error compressing image: {e}")
        return image_field
