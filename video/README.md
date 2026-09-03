# CampusPass explainer video

A ~26s flat-design explainer, narrated by [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M)
(via [`kokoro-onnx`](https://github.com/thewh1teagle/kokoro-onnx), CPU, no cloud TTS), with every
visual generated procedurally in Python (PIL, per-frame) rather than pulled from the internet —
no stock footage, no copyright questions. Assembled with moviepy.

## Rebuild it

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install kokoro-onnx soundfile pillow numpy moviepy

mkdir -p models
curl -L -o models/kokoro-v1.0.onnx \
  https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
curl -L -o models/voices-v1.0.bin \
  https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin

python build_video.py   # writes audio/narration.wav and output.mp4
```

Model files are ~350MB combined and gitignored — re-download with the commands above rather than
committing them. If a download looks too small / `kokoro-onnx` throws a protobuf/zip parsing
error, it was truncated — compare `ls -la` against the `content-length` from `curl -sI -L <url>`
and redownload.

## What's in `build_video.py`

- One Kokoro call generates the whole narration as a single WAV (better prosody than stitching
  per-scene clips); scene durations are then computed proportionally from each scene's word count
  so visuals roughly track the voiceover.
- Six scenes, each a `moviepy.VideoClip` driven by a `make_frame(t)` function that redraws the
  scene with PIL every frame (real per-frame animation — easing curves, glow via Gaussian blur,
  particles, staggered reveals — not just a Ken Burns pan on static images).
- Palette and typography (Poppins, OFL-licensed, downloaded from Google's font repo) intentionally
  match the actual CampusPass apps' dark/minimal theme (`apps/*/app/globals.css`).

## Structure

```
build_video.py    the whole pipeline
fonts/            Poppins Bold/Medium/Regular (tracked — small, OFL-licensed)
models/           Kokoro ONNX model + voices (gitignored — re-download, see above)
audio/            generated narration.wav (gitignored — regenerated on each run)
output.mp4        the rendered video (gitignored — regenerate, don't commit binary media)
demo.gif          GIF preview generated from output.mp4, embedded in the top-level README
.venv/            Python environment (gitignored)
```
