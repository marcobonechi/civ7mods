#!/usr/bin/env python3
"""Check an exported .glb against Civ 7's geometry contract, before any of it is baked
into a package.

This is the only stage that can be tested without building a .blp, so it is worth doing
properly. It applies the same transform import_gltf.py will apply -- (x, y, z) -> (x, -z, y)
with --scale 10 -- and reports the result in game units, so what you see here is what the
engine will see.

    3d_art/.venv/bin/python 3d_art/src/check_glb.py 3d_art/export/hagia_sophia.glb

Exit status is 1 if any hard requirement fails, so it can gate a build script.
"""
import argparse
import sys

from pygltflib import GLTF2

HEX_RADIUS = 14.0   # outer radius of a hex, in game units
UNIT_TALL = 18.0    # a human unit, for the "reads as monumental" note


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("glb")
    ap.add_argument("--scale", type=float, default=10.0)
    a = ap.parse_args()

    g = GLTF2().load(a.glb)
    lo, hi = [1e9] * 3, [-1e9] * 3
    verts = tris = prims = 0
    for m in g.meshes:
        for p in m.primitives:
            prims += 1
            acc = g.accessors[p.attributes.POSITION]
            verts += acc.count
            tris += g.accessors[p.indices].count // 3
            for k in range(3):
                lo[k] = min(lo[k], acc.min[k])
                hi[k] = max(hi[k], acc.max[k])
            attrs = {k for k, v in p.attributes.__dict__.items() if v is not None}

    s = a.scale
    gx = sorted([lo[0] * s, hi[0] * s])
    gy = sorted([-lo[2] * s, -hi[2] * s])
    gz = sorted([lo[1] * s, hi[1] * s])

    print("%s" % a.glb)
    print("  meshes %d  primitives %d  materials %s"
          % (len(g.meshes), prims, [m.name for m in g.materials] or "none"))
    print("  verts %d  tris %d" % (verts, tris))
    print("  game units  x %.2f..%.2f  y %.2f..%.2f  z %.2f..%.2f"
          % (gx[0], gx[1], gy[0], gy[1], gz[0], gz[1]))
    print("  footprint %.1f x %.1f, height %.1f" % (gx[1] - gx[0], gy[1] - gy[0], gz[1] - gz[0]))

    checks = [
        ("grounded: lowest vertex at Z = 0", abs(gz[0]) < 1e-3, True),
        ("centred on the origin in XY",
         abs(gx[0] + gx[1]) < 1e-2 and abs(gy[0] + gy[1]) < 1e-2, True),
        ("footprint inside a %.0f-unit hex radius" % HEX_RADIUS,
         max(abs(gx[0]), gx[1], abs(gy[0]), gy[1]) <= HEX_RADIUS, True),
        ("normals present", "NORMAL" in attrs, True),
        ("UVs present (stride-20 layout needs them)", "TEXCOORD_0" in attrs, True),
        ("single primitive (a manifest mesh takes one material)", prims == 1, True),
        ("taller than a unit, so it reads as monumental", gz[1] > UNIT_TALL, False),
    ]
    print()
    bad = 0
    for label, passed, hard in checks:
        if passed:
            print("  ok   %s" % label)
        elif hard:
            print("  FAIL %s" % label)
            bad += 1
        else:
            print("  note %s -- not met" % label)

    print()
    print("  manifest bounds: [%.2f, %.2f, %.2f, %.2f, %.2f, %.2f]"
          % (gx[0], gy[0], gz[0], gx[1], gy[1], gz[1]))
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
