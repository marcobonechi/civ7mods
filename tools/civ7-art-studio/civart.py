"""
Entry script for freezing with PyInstaller.

PyInstaller runs its entry script as __main__, with no package context, so pointing it
at civ7_art_studio/__main__.py fails immediately on the first relative import:

    from .server import serve
    ImportError: attempted relative import with no known parent package

Importing the package by name instead gives the module a parent, so the relative
imports inside it resolve normally. `pip install` does not need this -- the console
script entry point imports the module properly -- but a frozen build does.

    pyinstaller --onefile --name civart ... civart.py
"""
from civ7_art_studio.__main__ import main

if __name__ == '__main__':
    main()
