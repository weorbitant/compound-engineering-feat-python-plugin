---
name: gemini-imagegen
description: This skill should be used when generating and editing images using the Gemini API (Nano Banana Pro). It applies when creating images from text prompts, editing existing images, applying style transfers, generating logos with text, creating stickers, product mockups, or any image generation/manipulation task. Supports text-to-image, image editing, multi-turn refinement, and composition from multiple reference images.
model: sonnet
---

# Gemini Image Generation (Nano Banana Pro)

Generate and edit images via Google's Gemini API. Requires `GEMINI_API_KEY` env var.

## Model

Always use `gemini-3-pro-image-preview` (Pro, 1K-4K). Only switch models if explicitly requested.

## Defaults

- **Resolution:** `1K` — options `1K`, `2K`, `4K`
- **Aspect ratio:** `1:1` — options `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9`

## CRITICAL: File format

The API returns **JPEG by default**. Always save with `.jpg`:

```python
image.save("output.jpg")   # ✅ correct
image.save("output.png")   # ❌ JPEG with PNG extension → media-type errors
```

Convert to PNG only if needed — see [references/examples.md](./references/examples.md).

## Code examples

All patterns (basic generation, custom resolution, editing, multi-turn, Search grounding, multi-reference composition, prompting recipes) in [references/examples.md](./references/examples.md).

Minimal example:

```python
import os
from google import genai
from google.genai import types

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=["Your prompt"],
    config=types.GenerateContentConfig(response_modalities=['TEXT', 'IMAGE']),
)
for part in response.parts:
    if part.inline_data:
        part.as_image().save("output.jpg")
```

## Prompting tips

- **Photorealistic:** include camera details (lens, lighting, angle, mood).
- **Stylized art:** specify style explicitly (kawaii, cel-shading, watercolor).
- **Text in images:** specify font style, placement.
- **Product mockups:** describe lighting setup and surface.
- **Editing:** describe changes conversationally — model handles semantic masking.

## Notes

- All generated images include **SynthID watermarks**.
- Image-only mode (`responseModalities: ["IMAGE"]`) **does not** work with Google Search grounding.
- Default to 1K for speed; bump to 2K/4K when quality is critical.

## Scripts

See `scripts/` for helper CLI utilities. Install with `pip install -r requirements.txt`.
