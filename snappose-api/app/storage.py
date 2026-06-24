import io
import json

from minio import Minio

from app.config import settings


def _client() -> Minio:
    return Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
    )


def ensure_bucket() -> None:
    client = _client()
    if not client.bucket_exists(settings.minio_bucket):
        client.make_bucket(settings.minio_bucket)
        policy = {
            "Version": "2012-10-17",
            "Statement": [{
                "Effect": "Allow",
                "Principal": {"AWS": ["*"]},
                "Action": ["s3:GetObject"],
                "Resource": [f"arn:aws:s3:::{settings.minio_bucket}/*"],
            }],
        }
        client.set_bucket_policy(settings.minio_bucket, json.dumps(policy))


def upload(object_name: str, data: bytes, content_type: str) -> str:
    ensure_bucket()
    _client().put_object(
        settings.minio_bucket,
        object_name,
        io.BytesIO(data),
        length=len(data),
        content_type=content_type,
    )
    return public_url(object_name)


def public_url(object_name: str) -> str:
    return f"/{settings.minio_bucket}/{object_name}"
