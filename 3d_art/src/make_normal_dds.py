"""Encode normal map PNG into BC5 / ATI2 DDS format for Civ 7."""

import os
import struct
import numpy as np
from PIL import Image

def encode_bc4_channel(channel_blocks):
    """
    channel_blocks: (N, 16) uint8 array of 4x4 blocks.
    Returns: (N, 8) uint8 array of BC4 packed blocks.
    """
    N = channel_blocks.shape[0]
    out = np.zeros((N, 8), dtype=np.uint8)

    c_max = channel_blocks.max(axis=1)
    c_min = channel_blocks.min(axis=1)

    out[:, 0] = c_max
    out[:, 1] = c_min

    # For blocks where max == min, indices remain 0
    diff_mask = c_max > c_min
    if not np.any(diff_mask):
        return out

    # For diff blocks
    diff_blocks = channel_blocks[diff_mask]  # (M, 16)
    m_max = c_max[diff_mask].astype(np.float32)[:, None]
    m_min = c_min[diff_mask].astype(np.float32)[:, None]

    # 8 palette values: (M, 8)
    # v0 = max, v1 = min, v2..v7 interpolated
    weights = np.array([
        [7, 0], [0, 7], [6, 1], [5, 2], [4, 3], [3, 4], [2, 5], [1, 6]
    ], dtype=np.float32) / 7.0  # (8, 2)

    # palette: (M, 8)
    pal = m_max * weights[:, 0] + m_min * weights[:, 1]

    # Find closest index for each pixel: diff_blocks is (M, 16, 1), pal is (M, 1, 8)
    dist = np.abs(diff_blocks[:, :, None].astype(np.float32) - pal[:, None, :])
    best_idx = np.argmin(dist, axis=2).astype(np.uint64)  # (M, 16) with values 0..7

    # Pack 16 3-bit values into 48-bit integer
    # pixel 0 is bits 0..2, pixel 1 is bits 3..5, etc.
    packed = np.zeros(diff_blocks.shape[0], dtype=np.uint64)
    for p in range(16):
        packed |= (best_idx[:, p] << (p * 3))

    # Convert 48-bit packed to 6 bytes
    b_bytes = np.zeros((diff_blocks.shape[0], 6), dtype=np.uint8)
    for b in range(6):
        b_bytes[:, b] = (packed >> (b * 8)) & 0xFF

    out[diff_mask, 2:] = b_bytes
    return out


def convert_normal_png_to_bc5_dds(png_path, dds_path):
    img = Image.open(png_path).convert("RGB")
    w, h = img.size
    assert w % 4 == 0 and h % 4 == 0

    arr = np.array(img)
    # Split into 4x4 blocks
    # arr is (H, W, 3)
    bw, bh = w // 4, h // 4
    # Reshape into (bh, 4, bw, 4, 3) -> swap axes -> (bh, bw, 4, 4, 3) -> (bh*bw, 16, 3)
    blocks = arr.reshape(bh, 4, bw, 4, 3).swapaxes(1, 2).reshape(-1, 16, 3)

    red_bc4 = encode_bc4_channel(blocks[:, :, 0])    # (N, 8)
    green_bc4 = encode_bc4_channel(blocks[:, :, 1])  # (N, 8)

    # Interleave: 8 bytes R, 8 bytes G
    bc5_payload = np.concatenate([red_bc4, green_bc4], axis=1).tobytes()

    # Create 128-byte DDS header with FourCC b'ATI2'
    dwFlags = 0x00081007  # DDSD_CAPS | DDSD_HEIGHT | DDSD_WIDTH | DDSD_PIXELFORMAT | DDSD_MIPMAPCOUNT
    header = struct.pack(
        '<4s7I44s2I4s5I5I',
        b'DDS ',          # Magic
        124,              # Header size
        dwFlags,          # Flags
        h,                # Height
        w,                # Width
        len(bc5_payload), # Pitch / linear size
        0,                # Depth
        1,                # MipMapCount
        b'\0' * 44,       # Reserved1 (11 uint32s)
        32,               # PixelFormat dwSize
        0x4,              # PixelFormat dwFlags (DDPF_FOURCC)
        b'ATI2',          # FourCC (BC5_UNORM)
        0, 0, 0, 0, 0,    # RGBBitCount, Bitmasks
        0x1000,           # Caps (DDSCAPS_TEXTURE)
        0, 0, 0, 0        # Caps2-4, Reserved2
    )
    assert len(header) == 128

    with open(dds_path, "wb") as f:
        f.write(header)
        f.write(bc5_payload)

    print(f"Wrote BC5 DDS {dds_path}: {w}x{h} ({len(bc5_payload) + 128} bytes)")


if __name__ == "__main__":
    convert_normal_png_to_bc5_dds("3d_art/textures/hagia_sophia_N.png", "3d_art/dds/hagia_sophia_N.dds")
