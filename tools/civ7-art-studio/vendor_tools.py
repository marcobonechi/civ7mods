"""
Copy the binary-format tools into the package, so a wheel is self-contained.

The parsers and emitters live in the custom-art mod's tools/ directory, where they were
written and where their own tests and donor fixtures are. That is the right home for
development, and the wrong one for distribution: a pip install has no checkout to point
at, and the app is unusable without them.

So the checkout stays the single source of truth and this copies it in before a build.
Run it before `python -m build`; it is also safe to run any time, and reports when the
vendored copy has drifted.

    python3 vendor_tools.py [--check]
"""
import os, sys, shutil, filecmp, argparse

HERE = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.join(HERE, 'civ7_art_studio', 'blp')

# Everything except:
#   skins.py      generated from whichever game is installed, so regenerated per
#                 machine rather than shipped from ours
#   test_build.py a test, not a tool -- it pulls pytest in as a dependency of the
#                 shipped package for no benefit
SKIP = {'skins.py', 'test_build.py'}

HEADER = '''"""
Vendored copy of the Civ VII binary-format tools -- do not edit here.

The source of truth is the custom-art mod's tools/ directory; this copy exists so an
installed wheel has no checkout dependency. Regenerate with vendor_tools.py.
"""
'''


def source_dir():
    override = os.environ.get('CIV7_ART_TOOLS')
    if override:
        return os.path.abspath(override)
    here = HERE
    marker = os.path.join('custom-art', 'tools', 'build_blp.py')
    while True:
        candidate = os.path.join(here, marker)
        if os.path.exists(candidate):
            return os.path.dirname(candidate)
        parent = os.path.dirname(here)
        if parent == here:
            raise SystemExit('cannot find custom-art/tools; set CIV7_ART_TOOLS')
        here = parent


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true',
                    help='report drift instead of copying (exit 1 if stale)')
    args = ap.parse_args()

    src = source_dir()
    names = sorted(f for f in os.listdir(src)
                   if f.endswith('.py') and f not in SKIP)

    if args.check:
        stale = [n for n in names
                 if not os.path.exists(os.path.join(DEST, n))
                 or not filecmp.cmp(os.path.join(src, n), os.path.join(DEST, n),
                                    shallow=False)]
        extra = [f for f in (os.listdir(DEST) if os.path.isdir(DEST) else [])
                 if f.endswith('.py') and f != '__init__.py' and f not in names]
        if stale or extra:
            print(f'vendored copy is stale: {len(stale)} changed, {len(extra)} removed')
            for n in stale + extra:
                print('   ', n)
            return 1
        print(f'vendored copy is current ({len(names)} modules)')
        return 0

    os.makedirs(DEST, exist_ok=True)
    for f in os.listdir(DEST):
        if f.endswith('.py'):
            os.remove(os.path.join(DEST, f))
    for n in names:
        shutil.copy2(os.path.join(src, n), os.path.join(DEST, n))
    with open(os.path.join(DEST, '__init__.py'), 'w') as f:
        f.write(HEADER)

    print(f'vendored {len(names)} modules from {src}')
    print(f'  -> {DEST}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
