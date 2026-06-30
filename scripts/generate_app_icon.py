from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src-tauri" / "icons" / "icon-source.png"
SIZE = 1024
SCALE = 4
CANVAS = SIZE * SCALE


def s(value: int) -> int:
    return value * SCALE


def rounded(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], radius: int, fill: tuple[int, int, int, int]) -> None:
    draw.rounded_rectangle(tuple(s(value) for value in box), radius=s(radius), fill=fill)


def make_gradient() -> Image.Image:
    image = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    pixels = image.load()
    top = (13, 24, 45)
    bottom = (15, 118, 110)
    for y in range(CANVAS):
        t = y / (CANVAS - 1)
        r = round(top[0] * (1 - t) + bottom[0] * t)
        g = round(top[1] * (1 - t) + bottom[1] * t)
        b = round(top[2] * (1 - t) + bottom[2] * t)
        for x in range(CANVAS):
            pixels[x, y] = (r, g, b, 255)
    return image


def build_icon() -> Image.Image:
    image = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))

    shadow = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    rounded(shadow_draw, (104, 104, 920, 920), 184, (0, 0, 0, 170))
    shadow = shadow.filter(ImageFilter.GaussianBlur(s(24)))
    image.alpha_composite(shadow)

    mask = Image.new("L", (CANVAS, CANVAS), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle((s(92), s(84), s(932), s(924)), radius=s(188), fill=255)

    body = make_gradient()
    body.putalpha(mask)
    image.alpha_composite(body)

    draw = ImageDraw.Draw(image)
    rounded(draw, (120, 112, 904, 896), 164, (255, 255, 255, 22))
    rounded(draw, (144, 136, 880, 872), 142, (2, 6, 23, 28))

    # T-shaped tunnel mark. Large simple geometry stays legible in the tray.
    rounded(draw, (238, 242, 786, 370), 40, (241, 249, 255, 255))
    rounded(draw, (446, 334, 578, 690), 38, (241, 249, 255, 255))
    rounded(draw, (310, 638, 714, 770), 38, (94, 234, 212, 255))

    # Subtle inner cuts make the bottom read as a tunnel entrance, not a plain bar.
    rounded(draw, (350, 666, 674, 742), 24, (188, 255, 245, 180))
    rounded(draw, (486, 370, 538, 638), 20, (220, 252, 249, 110))

    # Small endpoint dots suggest routed services without adding text.
    rounded(draw, (206, 472, 286, 552), 40, (96, 165, 250, 255))
    rounded(draw, (738, 472, 818, 552), 40, (96, 165, 250, 255))
    rounded(draw, (238, 502, 446, 522), 10, (96, 165, 250, 230))
    rounded(draw, (578, 502, 786, 522), 10, (96, 165, 250, 230))

    return image.resize((SIZE, SIZE), Image.Resampling.LANCZOS)


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    build_icon().save(OUT)
    print(OUT)


if __name__ == "__main__":
    main()
