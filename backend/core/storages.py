from storages.backends.s3boto3 import S3Boto3Storage
import os

class PublicMediaStorage(S3Boto3Storage):
    bucket_name = 'erpgrafico-media-public'
    # Fallback to env var if defined (e.g. for prod bucket overrides)
    if os.getenv('AWS_STORAGE_PUBLIC_BUCKET_NAME'):
        bucket_name = os.getenv('AWS_STORAGE_PUBLIC_BUCKET_NAME')
        
    querystring_auth = False
    file_overwrite = False
    
    # We optionally can set custom domain independently
    # custom_domain = os.getenv('AWS_S3_PUBLIC_CUSTOM_DOMAIN', None)

class PrivateMediaStorage(S3Boto3Storage):
    bucket_name = 'erpgrafico-media-private'
    if os.getenv('AWS_STORAGE_PRIVATE_BUCKET_NAME'):
        bucket_name = os.getenv('AWS_STORAGE_PRIVATE_BUCKET_NAME')
        
    querystring_auth = True
    file_overwrite = False
    
    # Signature expires in 30 minutes by default
    querystring_expire = 1800 
