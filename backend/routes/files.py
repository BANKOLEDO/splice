import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, UploadFile, Form, Query
from fastapi.responses import JSONResponse

from database import get_db
from auth import get_current_user
from config import settings
from helpers import row_to_dict
from exceptions import AppException

router = APIRouter(tags=["Files"])

UPLOAD_DIR = Path(settings.upload_dir)
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_CONTENT_TYPES = {
    "image/png", "image/jpeg", "image/gif", "image/webp",
    "application/pdf", "text/plain", "text/markdown",
}

MAGIC_BYTES = {
    (b'\x89PNG\r\n\x1a\n',): "image/png",
    (b'\xff\xd8\xff', b'\xff\xd8\xff\xe0', b'\xff\xd8\xff\xe1', b'\xff\xd8\xff\xe2'): "image/jpeg",
    (b'GIF87a', b'GIF89a'): "image/gif",
    (b'RIFF',): "image/webp",
    (b'%PDF',): "application/pdf",
}


@router.post("/api/upload")
async def upload_file(artifact_id: str = Form(...), file: UploadFile = Form(...), current_user: dict = Depends(get_current_user)):
    content = await file.read()
    if len(content) > settings.max_upload_size_mb * 1024 * 1024:
        raise AppException(413, f"File too large. Max: {settings.max_upload_size_mb}MB")

    detected_type = None
    for signatures, mime in MAGIC_BYTES.items():
        for sig in signatures:
            if content.startswith(sig):
                detected_type = mime
                break
        if detected_type:
            break

    if detected_type is None:
        if file.content_type in ("text/plain", "text/markdown"):
            try:
                content.decode('utf-8')
            except UnicodeDecodeError:
                raise AppException(400, "Text file must be valid UTF-8")
            if b'\x00' in content:
                raise AppException(400, "Binary content detected in text file")
            detected_type = file.content_type
        else:
            raise AppException(400, "File type not recognized. Allowed: PNG, JPEG, GIF, WebP, PDF, TXT, MD")

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise AppException(400, f"File type '{file.content_type}' not allowed. Allowed: {', '.join(ALLOWED_CONTENT_TYPES)}")

    if detected_type == "image/webp" and content[8:12] not in (b'WEBP',):
        raise AppException(400, "Invalid WebP file")

    file_id = str(uuid.uuid4())
    ext = Path(file.filename).suffix if file.filename else ".bin"
    file_path = f"{file_id}{ext}"
    full_path = UPLOAD_DIR / file_path

    full_path.write_bytes(content)

    conn = get_db()
    conn.execute(
        "INSERT INTO files (id, filename, path, uploaded_by, artifact_id, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (file_id, file.filename, file_path, current_user["user_id"], artifact_id, len(content), int(datetime.now().timestamp())),
    )
    conn.commit()

    return JSONResponse(status_code=201, content={"success": True, "file_id": file_id, "filename": file.filename, "url": f"/files/{file_path}"})


@router.get("/api/files")
async def list_files(artifact_id: Optional[str] = Query(None), _=Depends(get_current_user)):
    conn = get_db()
    if artifact_id:
        rows = conn.execute("SELECT * FROM files WHERE artifact_id = ? ORDER BY created_at DESC", (artifact_id,))
    else:
        rows = conn.execute("SELECT * FROM files ORDER BY created_at DESC")
    return [row_to_dict(r) for r in rows.fetchall()]
