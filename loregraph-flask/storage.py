"""Загрузка картинок: валидация, ресайз и сохранение в static/uploads/."""
import secrets
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError
from werkzeug.datastructures import FileStorage

ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_BYTES = 5 * 1024 * 1024  # 5 МБ
MAX_PIXELS = 25_000_000
_RESAMPLE = getattr(getattr(Image, "Resampling", Image), "LANCZOS")


def _uploads_root(base_dir) -> Path:
    return (Path(base_dir) / "static" / "uploads").resolve()


def _safe_upload_path(url: str | None, base_dir) -> Path | None:
    if not url or not url.startswith("/static/uploads/"):
        return None
    path = (Path(base_dir) / url.lstrip("/")).resolve()
    root = _uploads_root(base_dir)
    try:
        path.relative_to(root)
    except ValueError:
        return None
    return path


class UploadError(ValueError):
    pass


def save_image(
    file: FileStorage,
    subdir: str,
    base_dir,
    *,
    max_size: tuple[int, int] | None = None,
) -> str:
    """Сохраняет картинку в base_dir/static/uploads/<subdir>/, при необходимости
    ресайзит до max_size (W, H). Возвращает URL.
    """
    base_dir = Path(base_dir)
    if not file or not file.filename:
        raise UploadError("Файл пустой.")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXT:
        raise UploadError("Поддерживаются: " + ", ".join(sorted(ALLOWED_EXT)))

    # Размер по байтам — отсекаем явно большие файлы до декодирования
    file.stream.seek(0, 2)
    size = file.stream.tell()
    file.stream.seek(0)
    if size > MAX_BYTES:
        raise UploadError(f"Слишком большой файл (макс. {MAX_BYTES // 1024 // 1024} МБ).")
    if size == 0:
        raise UploadError("Файл пустой.")

    try:
        img = Image.open(file.stream)
        img.load()  # фактически декодируем — Pillow упадёт, если внутри не картинка
        img = ImageOps.exif_transpose(img)
    except (UnidentifiedImageError, OSError, ValueError) as e:
        raise UploadError("Файл не похож на картинку.") from e

    if img.width * img.height > MAX_PIXELS:
        raise UploadError("Слишком большое изображение.")

    if max_size:
        img.thumbnail(max_size, _RESAMPLE)

    if ext in (".jpg", ".jpeg"):
        if img.mode in ("RGBA", "LA", "P"):
            rgba = img.convert("RGBA")
            background = Image.new("RGBA", rgba.size, (11, 15, 26, 255))
            img = Image.alpha_composite(background, rgba).convert("RGB")
        elif img.mode != "RGB":
            img = img.convert("RGB")

    target_dir = (_uploads_root(base_dir) / subdir).resolve()
    root = _uploads_root(base_dir)
    try:
        target_dir.relative_to(root)
    except ValueError as e:
        raise UploadError("Некорректный путь для загрузки.") from e
    target_dir.mkdir(parents=True, exist_ok=True)
    name = f"{secrets.token_hex(8)}{ext}"
    save_kwargs = {"optimize": True}
    if ext in (".jpg", ".jpeg"):
        save_kwargs.update({"quality": 88, "progressive": True})
    elif ext == ".webp":
        save_kwargs.update({"quality": 88, "method": 6})
    img.save(target_dir / name, **save_kwargs)

    return f"/static/uploads/{subdir}/{name}"


def delete_image(url: str | None, base_dir) -> None:
    """Удаляет файл по url. Безопасно: только в static/uploads/."""
    path = _safe_upload_path(url, base_dir)
    if path is None:
        return
    try:
        if path.exists() and path.is_file():
            path.unlink()
    except OSError:
        pass
