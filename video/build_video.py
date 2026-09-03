#!/usr/bin/env python3
"""
Builds a ~30s explainer video selling CampusPass: Kokoro-82M narration +
procedurally-animated flat-design scenes (PIL, per-frame), assembled with
moviepy. Run from this directory with the venv activated:

    source .venv/bin/activate
    python build_video.py

Outputs: audio/narration.wav, frames are generated on the fly (not saved),
output.mp4 in this directory.
"""

import math
import os

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro
from moviepy import AudioFileClip, VideoClip, concatenate_videoclips
from moviepy.video.fx import CrossFadeIn, CrossFadeOut, FadeOut
from PIL import Image, ImageDraw, ImageFilter, ImageFont

BASE = os.path.dirname(os.path.abspath(__file__))
W, H = 1280, 720
FPS = 30

# --- Palette (matches the actual CampusPass app's dark/minimal theme) ---
BG = (10, 10, 10)
ACCENT = (52, 211, 153)
ACCENT_DIM = (28, 122, 86)
BLUE = (96, 165, 250)
YELLOW = (251, 191, 36)
GRAY = (110, 110, 110)
DIM = (138, 138, 138)
TEXT = (237, 237, 237)


from functools import lru_cache


@lru_cache(maxsize=None)
def font(name, size):
    return ImageFont.truetype(os.path.join(BASE, "fonts", name), size)


F_XL = font("Poppins-Bold.ttf", 72)
F_LG = font("Poppins-Bold.ttf", 46)
F_MED = font("Poppins-Medium.ttf", 27)
F_SM = font("Poppins-Medium.ttf", 20)


def ease_out_cubic(t):
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


def ease_in_cubic(t):
    t = max(0.0, min(1.0, t))
    return t**3


def ease_in_out(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def new_canvas():
    img = Image.new("RGBA", (W, H), BG + (255,))
    return img, ImageDraw.Draw(img)


def bg_wash(img):
    """A very soft, low-opacity blurred color wash for depth, like the subtle
    background gradients Kurzgesagt-style explainers use behind flat scenes."""
    wash = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    wd = ImageDraw.Draw(wash)
    wd.ellipse([-200, -250, 650, 400], fill=ACCENT_DIM + (36,))
    wd.ellipse([W - 500, H - 450, W + 250, H + 150], fill=(30, 58, 95, 30))
    wash = wash.filter(ImageFilter.GaussianBlur(120))
    img.alpha_composite(wash)


def glow(img, cx, cy, radius, color, blur=24, alpha=130):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=color + (alpha,))
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    img.alpha_composite(layer)


def center_text(d, cx, y, text, fnt, fill):
    bbox = d.textbbox((0, 0), text, font=fnt)
    w = bbox[2] - bbox[0]
    d.text((cx - w / 2, y), text, font=fnt, fill=fill)


def text_width(d, text, fnt):
    bbox = d.textbbox((0, 0), text, font=fnt)
    return bbox[2] - bbox[0]


# --- Simple flat icon primitives -------------------------------------------------


def draw_key(d, cx, cy, scale, color, alpha=255):
    r = 22 * scale
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=color + (alpha,), width=int(6 * scale))
    d.line([cx + r * 0.7, cy + r * 0.7, cx + r * 0.7 + 40 * scale, cy + r * 0.7 + 40 * scale], fill=color + (alpha,), width=int(7 * scale))
    tx, ty = cx + r * 0.7 + 40 * scale, cy + r * 0.7 + 40 * scale
    d.line([tx, ty, tx + 12 * scale, ty - 12 * scale], fill=color + (alpha,), width=int(7 * scale))


def draw_id_card(d, cx, cy, scale, color, alpha=255):
    w, h = 70 * scale, 46 * scale
    box = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2]
    d.rounded_rectangle(box, radius=8 * scale, outline=color + (alpha,), width=int(5 * scale))
    pr = 9 * scale
    d.ellipse([cx - w / 2 + 12 * scale, cy - pr, cx - w / 2 + 12 * scale + 2 * pr, cy + pr], fill=color + (alpha,))
    for i, lw in enumerate([26, 18]):
        ly = cy - 8 * scale + i * 14 * scale
        d.line([cx - w / 2 + 34 * scale, ly, cx - w / 2 + 34 * scale + lw * scale, ly], fill=color + (alpha,), width=int(4 * scale))


def draw_lock(d, cx, cy, scale, color, alpha=255):
    w, h = 46 * scale, 34 * scale
    body = [cx - w / 2, cy - h / 2 + 10 * scale, cx + w / 2, cy + h / 2 + 10 * scale]
    d.rounded_rectangle(body, radius=6 * scale, outline=color + (alpha,), width=int(5 * scale))
    shackle_box = [cx - w / 3, cy - h / 2 - 16 * scale, cx + w / 3, cy - h / 2 + 14 * scale]
    d.arc(shackle_box, 180, 360, fill=color + (alpha,), width=int(5 * scale))


def draw_scroll(d, cx, cy, scale, color, alpha=255):
    w, h = 50 * scale, 62 * scale
    box = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2]
    d.rounded_rectangle(box, radius=6 * scale, outline=color + (alpha,), width=int(4 * scale))
    for i in range(3):
        ly = cy - h / 2 + 16 * scale + i * 12 * scale
        d.line([cx - w / 2 + 8 * scale, ly, cx + w / 2 - 8 * scale, ly], fill=color + (alpha,), width=int(3 * scale))
    sr = 9 * scale
    d.ellipse([cx - sr, cy + h / 2 - sr * 0.6, cx + sr, cy + h / 2 - sr * 0.6 + 2 * sr], fill=color + (alpha,))


def draw_credential_card(d, cx, cy, scale, alpha=255, label=True):
    w, h = 220 * scale, 140 * scale
    box = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2]
    d.rounded_rectangle(box, radius=18 * scale, fill=(19, 19, 19, alpha), outline=ACCENT + (alpha,), width=max(1, int(4 * scale)))
    pr = 22 * scale
    pcx, pcy = cx - w / 2 + 46 * scale, cy - h / 2 + 46 * scale
    d.ellipse([pcx - pr, pcy - pr, pcx + pr, pcy + pr], outline=ACCENT + (alpha,), width=max(1, int(4 * scale)))
    d.line([pcx - pr * 0.4, pcy, pcx + pr * 0.3, pcy - pr * 0.5], fill=ACCENT + (alpha,), width=max(1, int(4 * scale)))
    d.line([pcx - pr * 0.4, pcy, pcx + pr * 0.6, pcy + pr * 0.5], fill=ACCENT + (alpha,), width=max(1, int(4 * scale)))
    if label and scale > 0.5:
        try:
            f = font("Poppins-Bold.ttf", int(22 * scale))
        except Exception:
            f = F_SM
        d.text((cx - w / 2 + 20 * scale, cy + h / 2 - 46 * scale), "CampusPass", font=f, fill=TEXT + (alpha,))


def draw_check_badge(d, cx, cy, scale, alpha=255):
    r = 30 * scale
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=ACCENT + (alpha,))
    d.line([cx - r * 0.45, cy, cx - r * 0.1, cy + r * 0.4], fill=BG + (alpha,), width=max(2, int(6 * scale)))
    d.line([cx - r * 0.1, cy + r * 0.4, cx + r * 0.5, cy - r * 0.35], fill=BG + (alpha,), width=max(2, int(6 * scale)))


def draw_chain_link(d, cx, cy, scale, color, alpha=255):
    r = 14 * scale
    d.ellipse([cx - r * 2 - r, cy - r, cx - r * 2 + r, cy + r], outline=color + (alpha,), width=max(1, int(4 * scale)))
    d.ellipse([cx + r * 2 - r, cy - r, cx + r * 2 + r, cy + r], outline=color + (alpha,), width=max(1, int(4 * scale)))
    d.line([cx - r * 1.2, cy, cx + r * 1.2, cy], fill=color + (alpha,), width=max(1, int(4 * scale)))


def draw_db_cylinder(d, cx, cy, scale, color, alpha=255):
    w, h = 56 * scale, 60 * scale
    ellh = 16 * scale
    top = cy - h / 2
    bot = cy + h / 2
    d.ellipse([cx - w / 2, top - ellh / 2, cx + w / 2, top + ellh / 2], outline=color + (alpha,), width=max(1, int(4 * scale)))
    d.line([cx - w / 2, top, cx - w / 2, bot], fill=color + (alpha,), width=max(1, int(4 * scale)))
    d.line([cx + w / 2, top, cx + w / 2, bot], fill=color + (alpha,), width=max(1, int(4 * scale)))
    d.arc([cx - w / 2, bot - ellh / 2, cx + w / 2, bot + ellh / 2], 0, 180, fill=color + (alpha,), width=max(1, int(4 * scale)))


def draw_globe(d, cx, cy, scale, color, alpha=255):
    r = 30 * scale
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=color + (alpha,), width=max(1, int(4 * scale)))
    d.ellipse([cx - r * 0.45, cy - r, cx + r * 0.45, cy + r], outline=color + (alpha,), width=max(1, int(3 * scale)))
    d.line([cx - r, cy, cx + r, cy], fill=color + (alpha,), width=max(1, int(3 * scale)))
    d.line([cx - r * 0.9, cy - r * 0.5, cx + r * 0.9, cy - r * 0.5], fill=color + (alpha,), width=max(1, int(2 * scale)))
    d.line([cx - r * 0.9, cy + r * 0.5, cx + r * 0.9, cy + r * 0.5], fill=color + (alpha,), width=max(1, int(2 * scale)))


# --- Scenes ----------------------------------------------------------------------

CLUTTER_ICONS = [
    (draw_key, -260, -140, 0.0),
    (draw_id_card, 240, -120, 0.6),
    (draw_lock, -220, 130, 1.2),
    (draw_scroll, 260, 150, 1.8),
]


def scene1(t, dur):
    img, d = new_canvas()
    bg_wash(img)
    cx, cy = W // 2, H // 2 - 20
    for draw_fn, ox, oy, phase in CLUTTER_ICONS:
        bob = math.sin(t * 1.6 + phase) * 8
        fade_in = ease_out_cubic(min(1.0, (t - phase * 0.1) / 0.4))
        draw_fn(d, cx + ox, cy + oy + bob, 1.3, GRAY, alpha=int(210 * fade_in))
    center_text(d, cx, H - 150, "passwords · ID cards · paper certificates", F_SM, DIM)
    return np.array(img.convert("RGB"))


def scene2(t, dur):
    img, d = new_canvas()
    bg_wash(img)
    cx, cy = W // 2, H // 2 - 10
    conv_t = ease_in_cubic(min(1.0, t / (dur * 0.45)))
    for draw_fn, ox, oy, phase in CLUTTER_ICONS:
        sx = lerp(cx + ox, cx, conv_t)
        sy = lerp(cy + oy, cy, conv_t)
        scale = lerp(1.1, 0.15, conv_t)
        alpha = int(220 * (1 - conv_t))
        if alpha > 4:
            draw_fn(d, sx, sy, scale, GRAY, alpha=alpha)
    card_t = ease_out_cubic(min(1.0, max(0.0, (t - dur * 0.35) / (dur * 0.35))))
    if card_t > 0:
        glow(img, cx, cy, 130 * card_t, ACCENT, blur=30, alpha=int(110 * card_t))
        draw_credential_card(d, cx, cy, 0.15 + 0.95 * card_t, alpha=int(255 * card_t))
    if card_t > 0.85:
        center_text(d, cx, cy + 130, "One credential.", F_MED, TEXT)
    return np.array(img.convert("RGB"))


def scene3(t, dur):
    img, d = new_canvas()
    bg_wash(img)
    cx, cy = W // 2, H // 2 + 20
    gate_w, gate_h = 260, 340
    top = cy - gate_h / 2
    d.line([cx - gate_w / 2, top, cx - gate_w / 2, cy + gate_h / 2], fill=DIM + (255,), width=8)
    d.line([cx + gate_w / 2, top, cx + gate_w / 2, cy + gate_h / 2], fill=DIM + (255,), width=8)
    d.arc([cx - gate_w / 2, top - gate_w / 2, cx + gate_w / 2, top + gate_w / 2], 180, 360, fill=DIM + (255,), width=8)

    reader_cx, reader_cy = cx + gate_w / 2 + 60, cy - 40
    d.rounded_rectangle([reader_cx - 26, reader_cy - 34, reader_cx + 26, reader_cy + 34], radius=8, fill=(24, 24, 24, 255), outline=ACCENT + (255,), width=3)

    for i in range(3):
        phase = (t * 0.9 + i / 3) % 1.0
        r = 20 + phase * 70
        a = int(180 * (1 - phase))
        if a > 2:
            d.ellipse([reader_cx - r, reader_cy - r, reader_cx + r, reader_cy + r], outline=ACCENT + (a,), width=3)

    card_bob = math.sin(t * 3) * 4
    draw_credential_card(d, reader_cx - 90 + card_bob, reader_cy, 0.42, alpha=255, label=False)
    center_text(d, cx, H - 110, "Tap to enter.", F_MED, TEXT)
    return np.array(img.convert("RGB"))


def scene4(t, dur):
    img, d = new_canvas()
    bg_wash(img)
    cx, cy = W // 2, H // 2 - 60
    draw_credential_card(d, cx, cy, 1.0, alpha=255)

    badge_t = ease_out_cubic(min(1.0, t / 0.35))
    bounce = 1 + 0.15 * math.sin(badge_t * math.pi) * (1 - badge_t)
    if badge_t > 0:
        draw_check_badge(d, cx + 95, cy - 55, badge_t * bounce, alpha=int(255 * badge_t))

    n_links = 5
    total_w = 340
    start_x = cx - total_w / 2
    for i in range(n_links):
        appear = ease_out_cubic(min(1.0, max(0.0, (t - 0.25 - i * 0.1) / 0.25)))
        if appear <= 0:
            continue
        lx = start_x + i * (total_w / (n_links - 1))
        ly = cy + 150
        draw_chain_link(d, lx, ly, 1.0 * appear, ACCENT, alpha=int(255 * appear))
    center_text(d, cx, H - 90, "Scanned. Verified. Permanently recorded.", F_SM, DIM)
    return np.array(img.convert("RGB"))


NETWORK_NODES = [
    (draw_chain_link, -260, -60, "Blockchain"),
    (draw_db_cylinder, 0, 110, "GS1 Registry"),
    (draw_globe, 260, -60, "Resolver"),
]


def scene5(t, dur):
    img, d = new_canvas()
    bg_wash(img)
    cx, cy = W // 2, H // 2 - 20

    pts = [(cx + ox, cy + oy) for _, ox, oy, _ in NETWORK_NODES]
    for i in range(len(pts)):
        for j in range(i + 1, len(pts)):
            x1, y1 = pts[i]
            x2, y2 = pts[j]
            d.line([x1, y1, x2, y2], fill=(60, 60, 60, 255), width=2)
            flow_t = (t * 0.4 + (i + j) * 0.2) % 1.0
            fx, fy = lerp(x1, x2, flow_t), lerp(y1, y2, flow_t)
            d.ellipse([fx - 4, fy - 4, fx + 4, fy + 4], fill=ACCENT + (255,))

    for idx, (draw_fn, ox, oy, label) in enumerate(NETWORK_NODES):
        appear = ease_out_cubic(min(1.0, max(0.0, (t - idx * 0.18) / 0.35)))
        if appear <= 0:
            continue
        nx, ny = cx + ox, cy + oy
        glow(img, nx, ny, 46 * appear, ACCENT_DIM, blur=18, alpha=int(90 * appear))
        draw_fn(d, nx, ny, appear, ACCENT if idx != 1 else BLUE, alpha=int(255 * appear))
        center_text(d, nx, ny + 46, label, F_SM, DIM if appear < 1 else TEXT)

    center_text(d, cx, H - 90, "Real infrastructure. Not a mockup.", F_SM, DIM)
    return np.array(img.convert("RGB"))


def scene6(t, dur):
    img, d = new_canvas()
    bg_wash(img)
    cx, cy = W // 2, H // 2 - 30

    appear = ease_out_cubic(min(1.0, t / 0.4))
    glow(img, cx, cy, 220 * appear, ACCENT_DIM, blur=70, alpha=int(70 * appear))

    word1, word2 = "Campus", "Pass"
    w1 = text_width(d, word1, F_XL)
    w2 = text_width(d, word2, F_XL)
    total = w1 + w2
    start_x = cx - total / 2
    a1 = int(255 * appear)
    d.text((start_x, cy - 60), word1, font=F_XL, fill=TEXT + (a1,))
    d.text((start_x + w1, cy - 60), word2, font=F_XL, fill=ACCENT + (a1,))

    line_t = ease_out_cubic(min(1.0, max(0.0, (t - 0.35) / 0.35)))
    if line_t > 0:
        lw = total * line_t
        ly = cy + 32
        d.line([cx - lw / 2, ly, cx + lw / 2, ly], fill=ACCENT + (255,), width=4)

    tag_a = int(255 * ease_out_cubic(min(1.0, max(0.0, (t - 0.6) / 0.35))))
    if tag_a > 0:
        center_text(d, cx, cy + 60, "One credential. Every door.", F_MED, DIM if tag_a < 255 else DIM)
    return np.array(img.convert("RGB"))


SCENES = [
    (scene1, "Every student juggles a stack of passwords, ID cards, and paper certificates."),
    (scene2, "CampusPass replaces all of it with one thing: a single, unforgeable digital credential."),
    (scene3, "Tap it to walk into class."),
    (scene4, "Scan it to prove any certificate, instantly, permanently recorded."),
    (scene5, "Built on real blockchain infrastructure and open GS1 standards, not a mockup."),
    (scene6, "One credential. Every door. CampusPass."),
]

NARRATION = " ".join(text for _, text in SCENES)


def main():
    os.makedirs(os.path.join(BASE, "audio"), exist_ok=True)

    print("Generating narration with Kokoro-82M...")
    kokoro = Kokoro(os.path.join(BASE, "models/kokoro-v1.0.onnx"), os.path.join(BASE, "models/voices-v1.0.bin"))
    samples, sr = kokoro.create(NARRATION, voice="am_michael", speed=0.98, lang="en-us")
    audio_path = os.path.join(BASE, "audio/narration.wav")
    sf.write(audio_path, samples, sr)
    audio_duration = len(samples) / sr
    print(f"Narration duration: {audio_duration:.2f}s")

    word_counts = [len(text.split()) for _, text in SCENES]
    total_words = sum(word_counts)
    tail = 1.1  # let the logo linger after narration ends
    usable = audio_duration
    durations = [max(1.3, usable * (wc / total_words)) for wc in word_counts]
    # normalize so scenes sum exactly to audio_duration, then add the tail to the last scene
    scale = usable / sum(durations)
    durations = [d * scale for d in durations]
    durations[-1] += tail

    print("Scene durations:", [round(d, 2) for d in durations])

    clips = []
    for (scene_fn, _), dur in zip(SCENES, durations):
        clip = VideoClip(lambda t, fn=scene_fn, d=dur: fn(t, d), duration=dur)
        clip = clip.with_effects([CrossFadeIn(0.35), CrossFadeOut(0.35)])
        clips.append(clip)

    video = concatenate_videoclips(clips, method="compose", padding=-0.35)
    video = video.with_effects([FadeOut(0.6)])

    audio = AudioFileClip(audio_path)
    video = video.with_audio(audio).with_duration(video.duration)

    out_path = os.path.join(BASE, "output.mp4")
    video.write_videofile(
        out_path,
        fps=FPS,
        codec="libx264",
        audio_codec="aac",
        preset="medium",
        bitrate="4000k",
        threads=4,
        # +faststart moves the moov atom to the front of the file — without it,
        # players that can't seek the whole file up front (browsers, previews,
        # anything reading progressively) may stall or stop before the real end,
        # since they can't find duration/seek metadata until the full file loads.
        # -bf 0 disables B-frames for maximum compatibility with lightweight decoders.
        ffmpeg_params=["-movflags", "+faststart", "-bf", "0", "-pix_fmt", "yuv420p"],
    )
    print(f"\nDone: {out_path}")


if __name__ == "__main__":
    main()
