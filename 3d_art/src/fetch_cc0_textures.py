"""Download 2K CC0 PBR texture sets from ambientCG for Hagia Sophia materials."""

import os
import urllib.request
import json
import ssl

ssl._create_default_https_context = ssl._create_unverified_context

OUT_DIR = os.path.abspath("3d_art/textures/cc0")
os.makedirs(OUT_DIR, exist_ok=True)

ASSETS = {
    "brick": "Bricks051",
    "lead": "Metal032",
    "marble": "Marble012",
}


def download_maps(category, asset_id):
    cat_dir = os.path.join(OUT_DIR, category)
    os.makedirs(cat_dir, exist_ok=True)

    base_url = f"https://f003.backblazeb2.com/file/ambientCG-Web/media/surface-preview/{asset_id}/{asset_id}_SQ_"
    maps = {
        "color": f"{base_url}Color.jpg",
        "normal": f"{base_url}NormalDX.jpg",
        "roughness": f"{base_url}Roughness.jpg",
    }
    if category == "lead":
        maps["metalness"] = f"{base_url}Metalness.jpg"

    for map_name, url in maps.items():
        dst = os.path.join(cat_dir, f"{map_name}.jpg")
        if os.path.exists(dst) and os.path.getsize(dst) > 10000:
            print(f"  {category}/{map_name}.jpg already exists ({os.path.getsize(dst)} bytes)")
            continue
        print(f"Downloading {category} {map_name} from {url}...")
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        try:
            with urllib.request.urlopen(req) as resp, open(dst, "wb") as f:
                f.write(resp.read())
            print(f"  Saved {dst} ({os.path.getsize(dst)} bytes)")
        except Exception as e:
            print(f"  Error downloading {url}: {e}")


def main():
    print("Fetching CC0 PBR texture sets...")
    for cat, asset_id in ASSETS.items():
        download_maps(cat, asset_id)
    print("All downloads complete!")


if __name__ == "__main__":
    main()
