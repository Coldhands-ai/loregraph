"""Загрузка картинок: валидация, сохранение в static/uploads/."""
import secrets
from pathlib import Path

from PIL import Image, UnidentifiedImageError
from werkzeug.datastructures import FileStorage

ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_BYTES = 5 * 1024 * 1024  # 5 МБ


class UploadError(ValueError):
    pass


def save_image(file: FileStorage, subdir: str, base_dir: Path) -> str:
    """Сохраняет файл в base_dir/static/uploads/<subdir>/. Возвращает URL."""
    if not file or not file.filename:
        raise UploadError("Файл пустой.")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXT:
        raise UploadError("Поддерживаются: " + ", ".join(sorted(ALLOWED_EXT)))

    # Размер: читаем в память, чтобы и валидировать, и проверить что это правда картинка
    file.stream.seek(0, 2)
    size = file.stream.tell()
    file.stream.seek(0)
    if size > MAX_BYTES:
        raise UploadError(f"Слишком большой файл (макс. {MAX_BYTES // 1024 // 1024} МБ).")
    if size == 0:
        raise UploadError("Файл пустой.")

    # Pillow проверит, что внутри действительно картинка
    try:
        img = Image.open(file.stream)
        img.verify()
    except (UnidentifiedImageError, Exception) as e:
        raise UploadError("Файл не похож на картинку.") from e
    file.stream.seek(0)

    target_dir = base_dir / "static" / "uploads" / subdir
    target_dir.mkdir(parents=True, exist_ok=True)
    name = f"{secrets.token_hex(8)}{ext}"
    file.save(target_dir / name)

    return f"/static/uploads/{subdir}/{name}"


def delete_image(url: str | None, base_dir: Path) -> None:
    """Удаляет файл по url. Безопасно: только в static/uploads/."""
    if not url or not url.startswith("/static/uploads/"):
        return
    rel = url.removeprefix("/")
    path = base_dir / rel
    try:
        if path.exists() and path.is_file():
            path.unlink()
    except OSError:
        pass
