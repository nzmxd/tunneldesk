from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src-tauri" / "icons"

NAVY = (23, 32, 51, 255)
NAVY_DEEP = (17, 24, 39, 255)
WHITE = (248, 250, 252, 255)
BLUE = (37, 99, 235, 255)
SKY = (56, 189, 248, 255)

APP_SIZE = 1024
TRAY_SIZE = 256
SCALE = 4


def box(values: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    return tuple(value * SCALE for value in values)


def rounded(
    draw: ImageDraw.ImageDraw,
    values: tuple[int, int, int, int],
    radius: int,
    fill: tuple[int, int, int, int],
) -> None:
    draw.rounded_rectangle(box(values), radius=radius * SCALE, fill=fill)


def circle(
    draw: ImageDraw.ImageDraw,
    center: tuple[int, int],
    radius: int,
    fill: tuple[int, int, int, int],
) -> None:
    x, y = center
    draw.ellipse(box((x - radius, y - radius, x + radius, y + radius)), fill=fill)


def overlay_rounds(
    image: Image.Image,
    rounds: list[tuple[tuple[int, int, int, int], int, tuple[int, int, int, int]]],
) -> None:
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    for values, radius, fill in rounds:
        rounded(overlay_draw, values, radius, fill)
    image.alpha_composite(overlay)


def vertical_gradient(size: int, top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pixels = image.load()
    for y in range(size):
        t = y / max(size - 1, 1)
        color = tuple(round(top[index] * (1 - t) + bottom[index] * t) for index in range(3))
        for x in range(size):
            pixels[x, y] = (*color, 255)
    return image


def draw_app_mark(draw: ImageDraw.ImageDraw) -> None:
    rounded(draw, (236, 572, 788, 648), 32, BLUE)
    circle(draw, (236, 610), 52, SKY)
    circle(draw, (788, 610), 52, SKY)

    rounded(draw, (254, 242, 770, 366), 42, WHITE)
    rounded(draw, (448, 336, 576, 714), 40, WHITE)
    rounded(draw, (490, 382, 534, 674), 18, (218, 239, 255, 135))


def draw_tray_mark(draw: ImageDraw.ImageDraw) -> None:
    rounded(draw, (78, 92, 178, 116), 8, WHITE)
    rounded(draw, (116, 112, 140, 190), 8, WHITE)
    rounded(draw, (82, 168, 174, 188), 8, BLUE)
    circle(draw, (78, 178), 12, SKY)
    circle(draw, (178, 178), 12, SKY)


def build_app_icon(size: int = APP_SIZE) -> Image.Image:
    canvas = APP_SIZE * SCALE
    image = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))

    shadow = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle(box((108, 120, 916, 928)), radius=188 * SCALE, fill=(0, 0, 0, 100))
    image.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(26 * SCALE)))

    mask = Image.new("L", (canvas, canvas), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle(box((92, 84, 932, 924)), radius=194 * SCALE, fill=255)

    body = vertical_gradient(canvas, NAVY[:3], NAVY_DEEP[:3])
    body.putalpha(mask)
    image.alpha_composite(body)

    overlay_rounds(
        image,
        [
            ((124, 112, 900, 884), 166, (255, 255, 255, 20)),
            ((148, 142, 876, 866), 144, (0, 0, 0, 24)),
        ],
    )

    draw_app_mark(ImageDraw.Draw(image))
    return image.resize((size, size), Image.Resampling.LANCZOS)


def build_tray_icon(size: int = TRAY_SIZE) -> Image.Image:
    canvas = TRAY_SIZE * SCALE
    image = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    rounded(draw, (34, 30, 222, 218), 46, NAVY)
    overlay_rounds(image, [((48, 44, 208, 204), 38, (255, 255, 255, 18))])
    draw_tray_mark(ImageDraw.Draw(image))
    return image.resize((size, size), Image.Resampling.LANCZOS)


def save_windows_store_logos(app: Image.Image) -> None:
    mapping = {
        "Square30x30Logo.png": 30,
        "Square44x44Logo.png": 44,
        "Square71x71Logo.png": 71,
        "Square89x89Logo.png": 89,
        "Square107x107Logo.png": 107,
        "Square142x142Logo.png": 142,
        "Square150x150Logo.png": 150,
        "Square284x284Logo.png": 284,
        "Square310x310Logo.png": 310,
        "StoreLogo.png": 50,
    }
    for name, size in mapping.items():
        app.resize((size, size), Image.Resampling.LANCZOS).save(OUT / name)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    app = build_app_icon()
    tray = build_tray_icon()

    app.save(OUT / "icon-source.png")
    app.save(OUT / "icon.png")
    app.resize((32, 32), Image.Resampling.LANCZOS).save(OUT / "32x32.png")
    app.resize((64, 64), Image.Resampling.LANCZOS).save(OUT / "64x64.png")
    app.resize((128, 128), Image.Resampling.LANCZOS).save(OUT / "128x128.png")
    app.resize((256, 256), Image.Resampling.LANCZOS).save(OUT / "128x128@2x.png")
    app.save(
        OUT / "icon.ico",
        sizes=[(16, 16), (20, 20), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    app.save(OUT / "icon.icns")
    save_windows_store_logos(app)

    tray.save(OUT / "tray-icon.png")
    tray.save(
        OUT / "tray-icon.ico",
        sizes=[(16, 16), (20, 20), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    print(OUT)


if __name__ == "__main__":
    main()
