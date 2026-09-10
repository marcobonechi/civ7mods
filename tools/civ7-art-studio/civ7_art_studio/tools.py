"""
Locate the binary-format tools and expose them as ordinary imports.

The parsers and emitters live in the custom-art mod's tools/ directory, where they
were written and where their tests and donors are. Rather than fork them into this
package -- which would immediately drift -- this module puts that directory on the
path and re-exports what the app needs.

Set CIV7_ART_TOOLS to override the location. Packaging will eventually vendor the
tools into this distribution; until then a checkout is required, so import errors are
reported as a clear message rather than a bare ImportError from three frames down.
"""
import os, sys

# Found by searching upward for the marker file rather than by counting '..' levels:
# this package gets moved around (into the mods tree, onto a host machine, into a
# checkout laid out differently), and a fixed number of parents silently resolves to a
# path that does not exist.
_MARKER = os.path.join('custom-art', 'tools', 'build_blp.py')


def _discover():
    override = os.environ.get('CIV7_ART_TOOLS')
    if override:
        return os.path.abspath(override)

    # An installed wheel carries its own copy and has no checkout to find. A checkout
    # has both, and prefers the vendored one for the same reason -- so what runs in
    # development is what ships, and vendor drift shows up here rather than in a user's
    # install. vendor_tools.py --check catches the drift itself.
    vendored = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'blp')
    if os.path.exists(os.path.join(vendored, 'build_blp.py')):
        return vendored

    here = os.path.dirname(os.path.abspath(__file__))
    while True:
        candidate = os.path.join(here, _MARKER)
        if os.path.exists(candidate):
            return os.path.dirname(candidate)
        parent = os.path.dirname(here)
        if parent == here:
            return os.path.join(here, 'custom-art', 'tools')   # for the error message
        here = parent


TOOLS_DIR = _discover()


def ensure_on_path():
    if not os.path.isdir(TOOLS_DIR):
        raise RuntimeError(
            f'binary-format tools not found at {TOOLS_DIR}.\n'
            f'Set CIV7_ART_TOOLS to the custom-art mod tools/ directory.')
    if TOOLS_DIR not in sys.path:
        sys.path.insert(0, TOOLS_DIR)


def load():
    """Import and return the tool modules, as a simple namespace."""
    ensure_on_path()
    import types as _t
    ns = _t.SimpleNamespace()
    import blp, bins, build_blp, donors, make_texture, make_soundbank
    ns.blp = blp
    ns.bins = bins
    ns.build_blp = build_blp
    ns.donors = donors
    ns.make_texture = make_texture
    ns.make_soundbank = make_soundbank
    return ns
