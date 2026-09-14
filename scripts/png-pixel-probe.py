#!/usr/bin/env python3
"""Probe a screenshot for a specific composited colour, with no imaging library.

Why this exists: the Caret agent-edit mark is painted with theme colours that no
accessibility tree exposes, and a vision model is not always available. macOS
`screencapture` writes 8-bit non-interlaced PNGs, so zlib plus the five PNG
scanline filters is enough to read the pixels and answer "is the mark there?"

usage:
  python3 scripts/png-pixel-probe.py top  IMAGE x0 y0 x1 y1 [limit]
  python3 scripts/png-pixel-probe.py near IMAGE x0 y0 x1 y1 R G B [tolerance]

`top` prints the most common colours in the region; `near` counts pixels within a
tolerance of one colour. Compare the same region between a mark-on and a mark-off
capture: the decoration is present when the theme's composited highlight colour
appears and absent when it does not.

Theme colours this was written for (Caret's own decoration, see
apps/macos/src/extension.ts agentEditDecorationType):
  editor.wordHighlightStrongBackground #27678280 over editor.background #121314
  -> about rgb(29, 61, 75); macOS colour management shifts red by a few units, so
     match green/blue closely and allow red a wider tolerance.
"""
import collections
import struct
import sys
import zlib


def read_png(path):
    with open(path, "rb") as handle:
        data = handle.read()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit(f"{path}: not a PNG")
    width = height = depth = color = interlace = None
    idat = bytearray()
    offset = 8
    while offset < len(data):
        length, kind = struct.unpack(">I4s", data[offset : offset + 8])
        body = data[offset + 8 : offset + 8 + length]
        offset += 12 + length
        if kind == b"IHDR":
            width, height, depth, color, _, _, interlace = struct.unpack(">IIBBBBB", body)
        elif kind == b"IDAT":
            idat += body
        elif kind == b"IEND":
            break
    # color 6 = RGBA, color 2 = RGB. macOS `sips` writes RGB PNGs when it
    # converts the JPEG that Computer Use returns, so RGB is accepted and
    # expanded to RGBA here to keep the sampling code below single-format.
    if depth != 8 or color not in (2, 6) or interlace != 0:
        raise SystemExit(f"{path}: expected 8-bit RGB/RGBA non-interlaced, got depth={depth} color={color} interlace={interlace}")
    raw = zlib.decompress(bytes(idat))
    # Filters predict from the byte `bpp` earlier, so the row stride and the
    # left-neighbour offset both depend on the channel count.
    bpp = 3 if color == 2 else 4
    source_channels = bpp
    stride = width * source_channels
    decoded = bytearray(width * height * source_channels)
    previous = bytearray(stride)
    position = 0
    for row in range(height):
        filter_type = raw[position]
        position += 1
        line = bytearray(raw[position : position + stride])
        position += stride
        if filter_type == 1:
            for i in range(bpp, stride):
                line[i] = (line[i] + line[i - bpp]) & 0xFF
        elif filter_type == 2:
            for i in range(stride):
                line[i] = (line[i] + previous[i]) & 0xFF
        elif filter_type == 3:
            for i in range(stride):
                left = line[i - bpp] if i >= bpp else 0
                line[i] = (line[i] + ((left + previous[i]) >> 1)) & 0xFF
        elif filter_type == 4:
            for i in range(stride):
                left = line[i - bpp] if i >= bpp else 0
                up = previous[i]
                upleft = previous[i - bpp] if i >= bpp else 0
                estimate = left + up - upleft
                pa, pb, pc = abs(estimate - left), abs(estimate - up), abs(estimate - upleft)
                predictor = left if (pa <= pb and pa <= pc) else (up if pb <= pc else upleft)
                line[i] = (line[i] + predictor) & 0xFF
        elif filter_type != 0:
            raise SystemExit(f"{path}: unknown filter {filter_type}")
        start = row * stride
        decoded[start : start + stride] = line
        previous = line
    if source_channels == 4:
        return width, height, decoded
    pixels = bytearray(width * height * 4)
    for index in range(width * height):
        source = index * 3
        target = index * 4
        pixels[target] = decoded[source]
        pixels[target + 1] = decoded[source + 1]
        pixels[target + 2] = decoded[source + 2]
        pixels[target + 3] = 255
    return width, height, pixels


def region_pixels(path, x0, y0, x1, y1):
    width, height, pixels = read_png(path)
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(width - 1, x1), min(height - 1, y1)
    for y in range(y0, y1 + 1):
        base = y * width * 4
        for x in range(x0, x1 + 1):
            i = base + x * 4
            yield pixels[i], pixels[i + 1], pixels[i + 2]


def main():
    if len(sys.argv) < 7:
        raise SystemExit(__doc__)
    mode, path = sys.argv[1], sys.argv[2]
    x0, y0, x1, y1 = (int(value) for value in sys.argv[3:7])
    if mode == "top":
        limit = int(sys.argv[7]) if len(sys.argv) > 7 else 8
        counts = collections.Counter(region_pixels(path, x0, y0, x1, y1))
        print(f"{path} region x {x0}..{x1} y {y0}..{y1}: {sum(counts.values())} px")
        for color, count in counts.most_common(limit):
            print(f"  rgb{color}  {count} px")
    elif mode == "near":
        target = tuple(int(value) for value in sys.argv[7:10])
        tolerance = int(sys.argv[10]) if len(sys.argv) > 10 else 4
        hits = sum(1 for color in region_pixels(path, x0, y0, x1, y1)
                   if all(abs(color[k] - target[k]) <= tolerance for k in range(3)))
        print(f"{path}: {hits} px within +/-{tolerance} of rgb{target}")
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main()
