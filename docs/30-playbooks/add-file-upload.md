---
layer: 30-playbooks
doc: add-file-upload
task: "Add file upload field to a model and expose it via API + frontend"
triggers: ["file upload", "attachment", "image upload", "document", "FileField", "ImageField", "MinIO", "S3"]
preconditions:
  - 10-architecture/backend-apps.md
  - 20-contracts/api-contracts.md
  - 20-contracts/component-contracts.md
validation:
  - pytest backend/[app]/tests -v
  - npx tsc --noEmit
  - npm run lint
forbidden:
  - Storing files in local filesystem in production (USE_S3=True in prod)
  - Serving private files via direct URL (must use signed URLs)
  - Saving file path as CharField instead of FileField
  - Skipping validate_file_size and validate_file_extension
status: active
owner: core-team
last_review: 2026-04-22
---

# Playbook — Add file upload

## When to use

A model needs to store a user-uploaded file (PDF, image, CSV, XML, etc.) or an entity needs a generic attachment list.

Two scenarios:

| Scenario | When |
|----------|------|
| **A. Dedicated field** | File is intrinsic to the model (e.g., invoice PDF, company logo) |
| **B. Generic attachment** | Entity can have N attachments of any type (e.g., work order attachments) |

---

## Pre-flight checklist

- [ ] Decided: dedicated field (A) vs. generic attachment (B).
- [ ] For images: confirm public (logo, avatar) vs. private (invoice scan).
- [ ] Confirmed max file size (default 10 MB) and allowed extensions are sufficient.
- [ ] Endpoint exists or will be created alongside this field.

---

## Scenario A — Dedicated FileField / ImageField

### 1. Add field to model

```python
# backend/[app]/models.py
from core.utils import generic_upload_path
from core.storages import PrivateMediaStorage, PublicMediaStorage
from core.validators import validate_file_size, validate_file_extension, validate_image_extension

class MyModel(models.Model):
    # Private document (signed URL, 30-min expiry)
    document = models.FileField(
        _("Documento"),
        upload_to=generic_upload_path('my_app/documents/'),
        storage=PrivateMediaStorage(),
        null=True, blank=True,
        validators=[validate_file_size, validate_file_extension],
    )

    # Public image (no auth required to view)
    thumbnail = models.ImageField(
        _("Miniatura"),
        upload_to=generic_upload_path('my_app/thumbnails/'),
        storage=PublicMediaStorage(),
        null=True, blank=True,
        validators=[validate_file_size, validate_image_extension],
    )
```

Storage rules:
- `PrivateMediaStorage` — invoices, contracts, payroll PDFs, signed documents
- `PublicMediaStorage` — logos, product images, public thumbnails

### 2. Generate and review migration

```bash
python manage.py makemigrations [app]
python manage.py showmigrations [app]
```

Review SQL — confirm no data loss on existing rows.

### 3. Compress images (optional, for ImageField)

Call `compress_image` in model `save()` if the field stores user-uploaded images:

```python
from core.utils import compress_image

class MyModel(models.Model):
    thumbnail = models.ImageField(...)

    def save(self, *args, **kwargs):
        if self.pk:
            try:
                old = MyModel.objects.get(pk=self.pk)
                if old.thumbnail != self.thumbnail and self.thumbnail:
                    compressed = compress_image(self.thumbnail, quality=70, max_width=1200)
                    if compressed:
                        self.thumbnail = compressed
            except MyModel.DoesNotExist:
                pass
        super().save(*args, **kwargs)
```

### 4. Update serializer

```python
# backend/[app]/serializers.py
class MyModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = MyModel
        fields = ['id', 'document', 'thumbnail', ...]
        # FileField serializes as URL string — no extra config needed
```

For write operations that accept file uploads, the view must use `multipart/form-data`. DRF handles this automatically when the serializer includes a FileField.

### 5. Handle file in view action (if not standard CRUD)

```python
# backend/[app]/views.py
@action(detail=True, methods=['post'])
def attach_document(self, request, pk=None):
    instance = self.get_object()
    uploaded_file = request.FILES.get('document')  # key matches frontend FormData key

    if not uploaded_file:
        return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

    instance.document = uploaded_file
    instance.save(update_fields=['document'])
    return Response(MyModelSerializer(instance).data)
```

### 6. Frontend — hook

```ts
// features/[name]/hooks/useUploadDocument.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useUploadDocument(id: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('document', file)
      const { data } = await api.post(`/[app]/[endpoint]/${id}/attach_document/`, formData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['[name]', id] })
    },
    onError: () => {
      // showApiError handled by axios interceptor
    },
  })
}
```

### 7. Frontend — component

Use `DocumentAttachmentDropzone` from shared components (see [component-contracts.md](../20-contracts/component-contracts.md)):

```tsx
import { DocumentAttachmentDropzone } from '@/components/shared'

function MyForm() {
  const [file, setFile] = useState<File | null>(null)
  const { mutate: upload } = useUploadDocument(id)

  return (
    <DocumentAttachmentDropzone
      file={file}
      onFileChange={setFile}
      dteType={dteType}   // omit if not a DTE document
    />
  )
}
```

---

## Scenario B — Generic attachment list

Use the `Attachment` generic model from `core`. No new FileField needed on the target model.

### 1. Verify model has GenericRelation

```python
# backend/[app]/models.py
from django.contrib.contenttypes.fields import GenericRelation
from core.models import Attachment

class MyModel(models.Model):
    ...
    attachments = GenericRelation(Attachment, related_query_name='my_model')
```

### 2. Add upload action to ViewSet

```python
# backend/[app]/views.py
from core.models import Attachment
from core.serializers import AttachmentSerializer

class MyModelViewSet(viewsets.ModelViewSet):
    ...

    @action(detail=True, methods=['post'], url_path='attachments')
    def upload_attachment(self, request, pk=None):
        instance = self.get_object()
        uploaded_file = request.FILES.get('file')

        if not uploaded_file:
            return Response({'error': 'No file provided'}, status=400)

        attachment = Attachment.objects.create(
            content_object=instance,
            file=uploaded_file,
            original_filename=uploaded_file.name,
            user=request.user,
            file_size=uploaded_file.size,
            mime_type=uploaded_file.content_type,
        )
        return Response(AttachmentSerializer(attachment).data, status=201)

    @action(detail=True, methods=['delete'], url_path=r'attachments/(?P<attachment_id>\d+)')
    def delete_attachment(self, request, pk=None, attachment_id=None):
        instance = self.get_object()
        attachment = get_object_or_404(Attachment, pk=attachment_id, object_id=instance.pk)
        attachment.file.delete(save=False)  # delete from storage
        attachment.delete()
        return Response(status=204)
```

### 3. Include attachments in list serializer

```python
class MyModelSerializer(serializers.ModelSerializer):
    attachments = AttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = MyModel
        fields = ['id', ..., 'attachments']
```

### 4. Frontend — component

Use `AttachmentList` for display and `DocumentAttachmentDropzone` for upload (see component-contracts.md):

```tsx
import { AttachmentList } from '@/components/shared'

<AttachmentList
  attachments={entity.attachments}
  onDelete={handleDelete}
  isDeleting={deletingId}
/>
```

---

## Validation

```bash
# Backend
pytest backend/[app]/tests -v

# Frontend
npx tsc --noEmit
npm run lint
npm run test -- features/[name]
```

Manual: upload a file, verify it appears in MinIO bucket (dev: http://localhost:9001), verify download works.

## Definition of done

- [ ] `PrivateMediaStorage` used for sensitive documents; `PublicMediaStorage` for public images.
- [ ] `validate_file_size` and `validate_file_extension` (or `validate_image_extension`) applied.
- [ ] Upload path uses `generic_upload_path()` — never a raw string.
- [ ] Migration reviewed, no destructive SQL.
- [ ] Serializer returns URL string for FileField (not raw path).
- [ ] Frontend uses `DocumentAttachmentDropzone` (new upload) and/or `AttachmentList` (display).
- [ ] Tests cover: upload success, file too large, invalid extension, delete.
- [ ] No direct `MEDIA_ROOT` path string in code (breaks when `USE_S3=True`).
