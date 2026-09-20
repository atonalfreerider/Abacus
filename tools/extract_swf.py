"""Extract the original embedded textures. Usage: python tools/extract_swf.py path/to/ABACUS.swf.

The SWF is treated only as binary artwork; no embedded code is executed.
Requires Pillow. The browser app has no dependency on Python or Flash.
"""
from pathlib import Path
from io import BytesIO
import json
import struct
import sys
import zlib
from PIL import Image, ImageDraw

source = Path(sys.argv[1])
output = Path(__file__).resolve().parents[1] / 'public' / 'textures'
output.mkdir(parents=True, exist_ok=True)
raw = source.read_bytes()
data = raw[:8] + zlib.decompress(raw[8:]) if raw[:3] == b'CWS' else raw
position = 8 + (5 + 4 * (data[8] >> 3) + 7) // 8 + 4
assets = []
symbols = {}
jpeg_tables = b''

def clean_jpeg(value):
    return value.replace(b'\xff\xd9\xff\xd8', b'')

while position < len(data):
    header, = struct.unpack_from('<H', data, position)
    position += 2
    tag, size = header >> 6, header & 63
    if size == 63:
        size, = struct.unpack_from('<I', data, position)
        position += 4
    body = data[position:position + size]
    position += size
    if tag == 8:
        jpeg_tables = body
    if tag == 76:
        count, = struct.unpack_from('<H', body)
        offset = 2
        for _ in range(count):
            symbol_id, = struct.unpack_from('<H', body, offset)
            end = body.index(b'\0', offset + 2)
            symbols[symbol_id] = body[offset + 2:end].decode('utf-8')
            offset = end + 1
    if tag not in (6, 20, 21, 35, 36, 90):
        continue
    asset_id, = struct.unpack_from('<H', body)
    web_file = None
    if tag in (6, 21, 35, 90):
        if tag in (35, 90):
            image_size, = struct.unpack_from('<I', body, 2)
            start = 8 if tag == 90 else 6
            image = Image.open(BytesIO(clean_jpeg(body[start:start + image_size]))).convert('RGBA')
            alpha = zlib.decompress(body[start + image_size:])
            image.putalpha(Image.frombytes('L', image.size, alpha))
        else:
            encoded = clean_jpeg(body[2:])
            try:
                image = Image.open(BytesIO(encoded)).convert('RGBA')
                image.load()
                web_file = f'swf-{asset_id}.jpg'
                (output / web_file).write_bytes(encoded)
            except OSError:
                image = Image.open(BytesIO(clean_jpeg(jpeg_tables + body[2:]))).convert('RGBA')
    else:
        fmt, width, height = struct.unpack_from('<BHH', body, 2)
        if fmt != 5:
            raise ValueError(f'Unsupported lossless format {fmt}')
        pixels = zlib.decompress(body[7:])
        rgba = bytearray(width * height * 4)
        for i in range(width * height):
            a, r, g, b = pixels[i * 4:i * 4 + 4]
            if tag == 20:
                a = 255
            elif a:
                r, g, b = [min(255, round(c * 255 / a)) for c in (r, g, b)]
            rgba[i * 4:i * 4 + 4] = bytes((r, g, b, a))
        image = Image.frombytes('RGBA', (width, height), bytes(rgba))
    filename = f'swf-{asset_id}.png'
    image.save(output / filename, optimize=True)
    assets.append({'id': asset_id, 'file': filename, 'originalJpeg': web_file, 'width': image.width, 'height': image.height, 'tag': tag})

for asset in assets:
    asset['symbol'] = symbols.get(asset['id'])
(output / 'manifest.json').write_text(json.dumps({'source': source.name, 'assets': assets, 'symbols': symbols}, indent=2))
sheet = Image.new('RGB', (1000, ((len(assets) + 3) // 4) * 220), '#eae8e3')
draw = ImageDraw.Draw(sheet)
for i, asset in enumerate(assets):
    x, y = (i % 4) * 250, (i // 4) * 220
    image = Image.open(output / asset['file'])
    image.thumbnail((230, 178))
    sheet.paste(image, (x + (250 - image.width) // 2, y + 12), image)
    draw.text((x + 10, y + 192), f"{asset['id']} | {asset['width']} x {asset['height']} | {asset['symbol'] or ''}", fill='#222222')
sheet.save(output / 'contact-sheet.jpg')
print(json.dumps({'assets': assets, 'symbols': symbols}, indent=2))
