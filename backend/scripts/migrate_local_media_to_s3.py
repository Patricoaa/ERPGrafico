import os
import boto3
import mimetypes
from pathlib import Path
from dotenv import load_dotenv

# Load dev env to get bucket details if running externally
load_dotenv('.env.dev')

# Setup MinIO / S3 config
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID', 'minioadmin')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY', 'minioadmin')
AWS_STORAGE_BUCKET_NAME = os.getenv('AWS_STORAGE_BUCKET_NAME', 'erpgrafico-media')
AWS_S3_ENDPOINT_URL = os.getenv('AWS_S3_ENDPOINT_URL', 'http://localhost:9000')  # Use localhost since this script runs on the host

def get_s3_client():
    return boto3.client(
        's3',
        endpoint_url=AWS_S3_ENDPOINT_URL,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        region_name=os.getenv('AWS_S3_REGION_NAME', 'us-east-1')
    )

def migrate_media():
    client = get_s3_client()
    media_dir = Path(os.path.join(os.path.dirname(__file__), '..', 'media'))
    
    if not media_dir.exists():
        print(f"Directory {media_dir} does not exist. Nothing to migrate.")
        return

    files_uploaded = 0
    for file_path in media_dir.rglob('*'):
        if file_path.is_file():
            # Calculate S3 Key (Relative path inside media directory)
            s3_key = str(file_path.relative_to(media_dir)).replace('\\', '/')
            
            # Guess MIME type
            content_type, _ = mimetypes.guess_type(str(file_path))
            if not content_type:
                content_type = 'application/octet-stream'

            try:
                print(f"Uploading: {s3_key}... ", end="")
                client.upload_file(
                    str(file_path),
                    AWS_STORAGE_BUCKET_NAME,
                    s3_key,
                    ExtraArgs={'ContentType': content_type}
                )
                print("OK")
                files_uploaded += 1
            except Exception as e:
                print(f"FAILED: {str(e)}")

    print(f"\nMigration complete. {files_uploaded} files uploaded to s3://{AWS_STORAGE_BUCKET_NAME}")

if __name__ == '__main__':
    migrate_media()
