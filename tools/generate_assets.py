"""Generate the app icons and the development placeholder photos.

Development helper only; the game itself has no dependencies.
Requires Pillow:  python3 -m pip install Pillow
Run from the repo root:  python3 tools/generate_assets.py
"""
import math
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAVY = (47, 62, 92)
CREAM = (255, 244, 225)
HATCH = (88, 101, 128)


def font(size):
    for path in (
        "/System/Library/Fonts/Supplemental/Georgia Bold Italic.ttf",
        "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
        "/Library/Fonts/Georgia Bold.ttf",
        "DejaVuSerif-Bold.ttf",
    ):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default(size=size)


def hatch(draw, w, h, step, width):
    for x in range(-h, w + h, step):
        draw.line([(x, 0), (x + h, h)], fill=HATCH, width=width)
        draw.line([(x + h, 0), (x, h)], fill=HATCH, width=width)


def card(size, label_font):
    """One tile back: hatch, inner frame, 'Two of You' plaque."""
    s = size
    img = Image.new("RGB", (s, s), NAVY)
    d = ImageDraw.Draw(img)
    hatch(d, s, s, max(6, s // 14), max(1, s // 90))
    inset = int(s * 0.07)
    d.rounded_rectangle([inset, inset, s - inset, s - inset], radius=int(s * 0.06),
                        outline=HATCH, width=max(2, s // 60))
    text = "Two\nof You"
    box = d.multiline_textbbox((0, 0), text, font=label_font, align="center", spacing=2)
    tw, th = box[2] - box[0], box[3] - box[1]
    pad_x, pad_y = int(s * 0.07), int(s * 0.05)
    x0, y0 = (s - tw) // 2 - pad_x, (s - th) // 2 - pad_y
    d.rounded_rectangle([x0, y0, x0 + tw + 2 * pad_x, y0 + th + 2 * pad_y],
                        radius=int(s * 0.05), fill=NAVY, outline=HATCH, width=max(2, s // 80))
    d.multiline_text(((s - tw) // 2 - box[0], (s - th) // 2 - box[1]), text,
                     font=label_font, fill=CREAM, align="center", spacing=2)
    return img


def icon(size, maskable=False):
    """App icon: two overlapping tile backs on cream."""
    scale = 4
    S = size * scale
    bg = Image.new("RGBA", (S, S), (246, 239, 228, 255))
    tile = int(S * (0.50 if maskable else 0.58))
    radius = int(tile * 0.12)
    face = card(tile, font(int(tile * 0.15))).convert("RGBA")
    mask = Image.new("L", (tile, tile), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, tile - 1, tile - 1], radius=radius, fill=255)
    face.putalpha(mask)
    for angle, dx, dy in ((-9, -0.11, -0.03), (7, 0.11, 0.05)):
        rotated = face.rotate(angle, resample=Image.BICUBIC, expand=True)
        shadow = Image.new("RGBA", rotated.size, (0, 0, 0, 0))
        shadow.putalpha(rotated.getchannel("A").point(lambda a: a * 0.25))
        cx, cy = S // 2 + int(S * dx), S // 2 + int(S * dy)
        pos = (cx - rotated.width // 2, cy - rotated.height // 2)
        bg.alpha_composite(shadow, (pos[0], pos[1] + S // 60))
        bg.alpha_composite(rotated, pos)
    return bg.resize((size, size), Image.LANCZOS).convert("RGB")


def placeholders(count=12):
    out = os.path.join(ROOT, "dev", "placeholder-photos")
    os.makedirs(out, exist_ok=True)
    palette = [(214, 106, 63), (242, 177, 52), (47, 138, 92), (79, 124, 194), (192, 90, 160),
               (60, 160, 170), (150, 110, 70), (120, 90, 190), (200, 70, 80), (90, 150, 60),
               (230, 140, 120), (70, 80, 110)]
    shapes = ["circle", "square", "triangle", "star", "ring", "diamond"]
    sizes = [(1200, 800), (800, 1200), (1000, 1000)]
    big, small = font(220), font(48)
    for i in range(count):
        w, h = sizes[i % 3]
        color = palette[i % len(palette)]
        img = Image.new("RGB", (w, h), color)
        d = ImageDraw.Draw(img)
        # soft stripes so cropping is visible
        for y in range(0, h, 60):
            shade = tuple(min(255, c + 18) for c in color)
            d.rectangle([0, y, w, y + 28], fill=shade)
        cx, cy, r = w // 2, h // 2, min(w, h) // 4
        shape = shapes[i % len(shapes)]
        fg = (255, 250, 240)
        if shape == "circle":
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fg)
        elif shape == "square":
            d.rectangle([cx - r, cy - r, cx + r, cy + r], fill=fg)
        elif shape == "triangle":
            d.polygon([(cx, cy - r), (cx + r, cy + r), (cx - r, cy + r)], fill=fg)
        elif shape == "diamond":
            d.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], fill=fg)
        elif shape == "ring":
            d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=fg, width=r // 3)
        else:
            pts = []
            for k in range(10):
                rad = r if k % 2 == 0 else r * 0.45
                a = -math.pi / 2 + k * math.pi / 5
                pts.append((cx + rad * math.cos(a), cy + rad * math.sin(a)))
            d.polygon(pts, fill=fg)
        num = str(i + 1)
        b = d.textbbox((0, 0), num, font=big)
        d.text((cx - (b[2] - b[0]) // 2 - b[0], cy - (b[3] - b[1]) // 2 - b[1]), num, font=big, fill=color)
        label = "PLACEHOLDER - DEV ONLY"
        b = d.textbbox((0, 0), label, font=small)
        d.rectangle([0, h - 90, w, h], fill=(0, 0, 0))
        d.text(((w - (b[2] - b[0])) // 2, h - 70), label, font=small, fill=(255, 255, 255))
        # corner markers show which way is up after cropping
        d.text((24, 16), "TOP", font=small, fill=(255, 255, 255))
        img.save(os.path.join(out, f"placeholder-{i + 1:02d}.jpg"), quality=85)


def main():
    icons = os.path.join(ROOT, "icons")
    os.makedirs(icons, exist_ok=True)
    icon(192).save(os.path.join(icons, "icon-192.png"))
    icon(512).save(os.path.join(icons, "icon-512.png"))
    icon(512, maskable=True).save(os.path.join(icons, "icon-maskable-512.png"))
    icon(180).save(os.path.join(icons, "apple-touch-icon.png"))
    placeholders()
    print("Icons written to icons/, placeholders to dev/placeholder-photos/")


if __name__ == "__main__":
    main()
