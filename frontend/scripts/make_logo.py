from PIL import Image, ImageDraw, ImageFont

BRAND = (226, 104, 60, 255)   # #E2683C
WHITE = (255, 255, 255, 255)
DARK = (36, 31, 26, 255)      # #241F1A

ION = "node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf"
PAW = chr(0xF499)
COMFORTAA = "assets/fonts/Comfortaa.ttf"
OUT = "assets/images"


def squircle_icon(size=1024, pad_ratio=0.0, radius_ratio=0.225, bg=BRAND, fg=WHITE):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = int(size * pad_ratio)
    r = int(size * radius_ratio)
    d.rounded_rectangle([pad, pad, size - pad, size - pad], radius=r, fill=bg)
    f = ImageFont.truetype(ION, int(size * 0.56))
    d.text((size / 2, size / 2 + size * 0.01), PAW, font=f, fill=fg, anchor="mm")
    return img


def circle_logo(size=512, bg=BRAND, fg=WHITE):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([0, 0, size, size], fill=bg)
    f = ImageFont.truetype(ION, int(size * 0.54))
    d.text((size / 2, size / 2 + size * 0.01), PAW, font=f, fill=fg, anchor="mm")
    return img


def wordmark(text_color=DARK, bg=None):
    # paw badge + "GR-oom It" wordmark on transparent (or given) background
    W, H = 1600, 520
    img = Image.new("RGBA", (W, H), bg if bg else (0, 0, 0, 0))
    badge = circle_logo(360)
    img.alpha_composite(badge, (40, (H - 360) // 2))
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(COMFORTAA, 200)
    d.text((440, H / 2), "GR-oom It", font=f, fill=text_color, anchor="lm")
    return img


if __name__ == "__main__":
    # Main app/store icon (full-bleed squircle, no padding -> stores round it)
    squircle_icon(1024).save(f"{OUT}/groomit-logo.png")
    # Adaptive icon foreground needs safe padding (paw smaller, transparent bg)
    af = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    fnt = ImageFont.truetype(ION, int(1024 * 0.40))
    ad = ImageDraw.Draw(af)
    ad.ellipse([262, 262, 762, 762], fill=BRAND)
    ad.text((512, 512 + 10), PAW, font=fnt, fill=WHITE, anchor="mm")
    af.save(f"{OUT}/groomit-adaptive.png")
    # Circle logomark
    circle_logo(512).save(f"{OUT}/groomit-logo-circle.png")
    # Wordmark (transparent) + light-bg version
    wordmark().save(f"{OUT}/groomit-wordmark.png")
    wordmark(text_color=WHITE).save(f"{OUT}/groomit-wordmark-dark.png")
    print("done")
