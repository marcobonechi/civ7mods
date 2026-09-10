"""
Shared locations for the tests.

The custom-art mod is the fixture these tests measure against: its raw sources, its
manifest, and the package it shipped that is known to work in-game. That is a
*development* dependency, quite separate from the binary-format tools, which are
vendored into the package so an installed wheel needs no checkout.

Deriving one from the other stopped working the moment the tools were vendored, so the
fixture is found on its own terms -- by searching upward for the mod -- and tests that
need it skip cleanly when it is absent.
"""
import os
import pytest

GAME = os.environ.get('CIV7_GAME_ROOT', '/workspace/reference/full_game')


def _find_custom_art():
    here = os.path.dirname(os.path.abspath(__file__))
    marker = os.path.join('custom-art', 'civart.json')
    while True:
        candidate = os.path.join(here, marker)
        if os.path.exists(candidate):
            return os.path.dirname(candidate)
        parent = os.path.dirname(here)
        if parent == here:
            return None
        here = parent


CUSTOM_ART = _find_custom_art()
RAW = os.path.join(CUSTOM_ART, 'raw_art') if CUSTOM_ART else ''
MANIFEST = os.path.join(CUSTOM_ART, 'civart.json') if CUSTOM_ART else ''
INSTALLED = (os.path.join(CUSTOM_ART, 'Platforms', 'Windows', 'BLPs')
             if CUSTOM_ART else '')

needs_game = pytest.mark.skipif(not os.path.isdir(os.path.join(GAME, 'DLC')),
                                reason='game install not available')
needs_fixture = pytest.mark.skipif(not CUSTOM_ART,
                                   reason='custom-art mod not present')
