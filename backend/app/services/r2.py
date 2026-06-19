"""Cloudflare R2 storage (S3-compatible via boto3)."""

from urllib.parse import urlparse

import boto3

from app.core.config import settings


def _client():
    return boto3.client(
        "s3",
        endpoint_url=settings.r2_endpoint_url,
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        region_name="auto",
    )


def upload_audio(file_bytes: bytes, filename: str) -> str:
    _client().put_object(
        Bucket=settings.r2_bucket_name,
        Key=filename,
        Body=file_bytes,
        ContentType="audio/mpeg",
    )
    return f"{settings.r2_endpoint_url}/{settings.r2_bucket_name}/{filename}"


def download_audio(url: str) -> bytes:
    parsed = urlparse(url)
    # path is /<bucket>/<key>
    key = parsed.path.lstrip("/").split("/", 1)[1]
    response = _client().get_object(Bucket=settings.r2_bucket_name, Key=key)
    return response["Body"].read()
