"""Entry point: `civart` starts the local server and opens a browser."""
import argparse

from .server import serve


def main():
    ap = argparse.ArgumentParser(prog='civart',
                                 description='Civ7 Art Studio')
    ap.add_argument('--host', default='127.0.0.1')
    ap.add_argument('--port', type=int, default=8765)
    ap.add_argument('--no-browser', action='store_true')
    args = ap.parse_args()
    serve(args.host, args.port, open_browser=not args.no_browser)


if __name__ == '__main__':
    main()
