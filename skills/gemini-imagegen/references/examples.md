# Gemini Image Generation — Code Examples

## Core generation

```python
import os
from google import genai
from google.genai import types

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

# Basic (1K, 1:1 — defaults)
response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=["Your prompt here"],
    config=types.GenerateContentConfig(response_modalities=['TEXT', 'IMAGE']),
)

for part in response.parts:
    if part.text:
        print(part.text)
    elif part.inline_data:
        image = part.as_image()
        image.save("output.jpg")  # JPEG by default
```

## Custom resolution & aspect ratio

```python
response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=[prompt],
    config=types.GenerateContentConfig(
        response_modalities=['TEXT', 'IMAGE'],
        image_config=types.ImageConfig(
            aspect_ratio="16:9",
            image_size="2K"
        ),
    )
)
```

Aspect: `1:1` (default), `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9`.
Resolution: `1K` (default), `2K`, `4K`.

## Editing an image

```python
from PIL import Image

img = Image.open("input.png")
response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=["Add a sunset to this scene", img],
    config=types.GenerateContentConfig(response_modalities=['TEXT', 'IMAGE']),
)
```

## Multi-turn refinement

```python
chat = client.chats.create(
    model="gemini-3-pro-image-preview",
    config=types.GenerateContentConfig(response_modalities=['TEXT', 'IMAGE'])
)
chat.send_message("Create a logo for 'Acme Corp'")
chat.send_message("Make the text bolder and add a blue gradient")
```

## Google Search grounding

```python
response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=["Visualize today's weather in Tokyo as an infographic"],
    config=types.GenerateContentConfig(
        response_modalities=['TEXT', 'IMAGE'],
        tools=[{"google_search": {}}]
    )
)
```

Note: Image-only mode (`responseModalities: ["IMAGE"]`) is incompatible with Google Search grounding.

## Multiple reference images (up to 14)

```python
response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=[
        "Create a group photo of these people in an office",
        Image.open("person1.png"),
        Image.open("person2.png"),
        Image.open("person3.png"),
    ],
    config=types.GenerateContentConfig(response_modalities=['TEXT', 'IMAGE']),
)
```

## Prompting recipes

| Purpose | Template |
|---------|----------|
| Photorealistic | "A photorealistic close-up portrait, 85mm lens, soft golden hour light, shallow DOF" |
| Stylized art | "A kawaii-style sticker of a happy red panda, bold outlines, cel-shading, white background" |
| Text in images | "Create a logo with text 'Daily Grind' in clean sans-serif, black and white, coffee bean motif" |
| Product mockup | "Studio-lit product photo on polished concrete, three-point softbox setup, 45-degree angle" |

## Converting JPEG → PNG if required

`part.as_image().save()` writes the raw (JPEG) bytes regardless of extension. Re-encode
through PIL to get a real PNG:

```python
import io
from PIL import Image

for part in response.parts:
    if part.inline_data:
        Image.open(io.BytesIO(part.inline_data.data)).save("output.png")
```

Verify with `file image.png` — if it reports "JPEG image data", rename to `.jpg`.
