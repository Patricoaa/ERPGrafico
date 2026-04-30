from django.conf import settings
from django.core.files.storage import FileSystemStorage
from storages.backends.s3boto3 import S3Boto3Storage
import os

# Base storage selection based on USE_S3 setting
StorageBase = S3Boto3Storage if getattr(settings, 'USE_S3', False) else FileSystemStorage

class PublicMediaStorage(StorageBase):
    bucket_name = 'erpgrafico-media-public'
    # Fallback to env var if defined (e.g. for prod bucket overrides)
    if os.getenv('AWS_STORAGE_PUBLIC_BUCKET_NAME'):
        bucket_name = os.getenv('AWS_STORAGE_PUBLIC_BUCKET_NAME')
        
    querystring_auth = False
    file_overwrite = False
    
    # We optionally can set custom domain independently
    # custom_domain = os.getenv('AWS_S3_PUBLIC_CUSTOM_DOMAIN', None)

class PrivateMediaStorage(StorageBase):
    bucket_name = 'erpgrafico-media-private'
    if os.getenv('AWS_STORAGE_PRIVATE_BUCKET_NAME'):
        bucket_name = os.getenv('AWS_STORAGE_PRIVATE_BUCKET_NAME')
        
    querystring_auth = True
    file_overwrite = False
    
    # Signature expires in 30 minutes by default
    querystring_expire = 1800 
