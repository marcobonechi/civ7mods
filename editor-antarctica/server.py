#!/usr/bin/env python3
"""
Local server for the Antarctica map editor.

  ./run-editor.sh antarctica [--port 8095] [--no-open]
  python3 editor-antarctica/server.py [--port 8095] [--no-open]

Serves the editor page, the mod's map modules read-only (so the page draws with the real
rasterizer, Antarctica/maps/antarctica-raster.js), and three actions:
  POST /api/save     write Antarctica/maps/antarctica-geo.js (previous file kept as .bak), then
                     run tools/antarctica-check.mjs and report
  POST /api/check    run tools/antarctica-check.mjs
  POST /api/install  run ./install.sh Antarctica
Python 3 standard library only. Listens on 127.0.0.1 and refuses cross-origin API calls,
because it writes files and runs scripts.
"""

import argparse
import http.server
import json
import os
import posixpath
import subprocess
import tempfile
import sys
import threading
import urllib.parse
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))           # .../editor-antarctica
REPO = os.path.dirname(ROOT)                                # .../civ7mods
MAPS = os.path.join(REPO, "Antarctica", "maps")
GEO_FILE = os.path.join(MAPS, "antarctica-geo.js")
CHECK = os.path.join(REPO, "tools", "antarctica-check.mjs")
INSTALL = os.path.join(REPO, "install.sh")

MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
}

GREEN, YELLOW, RED, CYAN, GRAY, RESET = (
    ("\033[32m", "\033[33m", "\033[31m", "\033[36m", "\033[90m", "\033[0m")
    if sys.stdout.isatty() else ("", "", "", "", "", "")
)


def log(color, tag, msg):
    sys.stdout.write("%s[%s]%s %s\n" % (color, tag, RESET, msg))
    sys.stdout.flush()


def run(cmd, timeout=180):
    proc = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True, timeout=timeout)
    return proc.returncode == 0, (proc.stdout or "") + (proc.stderr or "")


def check(seeds="3"):
    return run(["node", CHECK, seeds])


class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "Civ7AntarcticaEditor/1.0"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        pass

    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _json(self, code, obj):
        self._send(code, json.dumps(obj))

    def _origin_ok(self):
        origin = self.headers.get("Origin")
        if not origin:
            return True
        port = self.server.server_address[1]
        return origin in ("http://localhost:%d" % port, "http://127.0.0.1:%d" % port)

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path.startswith("/maps/"):
            self._file(MAPS, path[len("/maps/"):], only_js=True)
        else:
            self._file(ROOT, "index.html" if path in ("/", "") else path.lstrip("/"))

    def do_POST(self):
        if not self._origin_ok():
            log(RED, "BLOCKED", "cross-origin call from %s" % self.headers.get("Origin"))
            self._json(403, {"success": False, "error": "cross-origin request refused"})
            return
        path = urllib.parse.urlparse(self.path).path
        try:
            if path == "/api/save":
                self.api_save()
            elif path == "/api/check":
                ok, out = check()
                log(GREEN if ok else RED, "CHECK", out.strip().splitlines()[-1] if out.strip() else "")
                self._json(200, {"success": ok, "output": out})
            elif path == "/api/install":
                ok, out = run(["/bin/bash", INSTALL, "Antarctica"])
                log(GREEN if ok else RED, "INSTALL", out.strip().splitlines()[-1] if out.strip() else "")
                self._json(200 if ok else 500, {"success": ok, "output": out})
            else:
                self._json(404, {"success": False, "error": "no such endpoint"})
        except Exception as exc:
            log(RED, "ERROR", str(exc))
            self._json(500, {"success": False, "error": str(exc)})

    def api_save(self):
        """The page sends the GEO text (`export const GEO = ...`); the file's header comment is kept."""
        length = int(self.headers.get("Content-Length") or 0)
        data = json.loads(self.rfile.read(length).decode("utf-8"))
        body = data.get("geoText") or ""
        if not body.startswith("export const GEO = {") or not body.rstrip().endswith("};"):
            self._json(400, {"success": False, "error": "not a GEO object"})
            return
        with open(GEO_FILE, "r", encoding="utf-8") as fh:
            before = fh.read()
        # the declaration at the start of a line: the header comment itself mentions `export const GEO`
        at = before.find("\nexport const GEO = {")
        header = before[:at + 1] if at >= 0 else ""
        after = header + body
        if after == before:
            self._json(200, {"success": True, "message": "No changes to save.", "output": ""})
            return
        # try the new file as a module before it replaces the old one
        fd, tmp = tempfile.mkstemp(suffix=".mjs")
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(after)
        try:
            ok, out = run(["node", "-e", "import(process.argv[1]).then(m => { if (!m.GEO || !m.GEO.lands) throw new Error('no GEO.lands'); })", tmp], timeout=30)
        finally:
            os.remove(tmp)
        if not ok:
            log(RED, "REFUSED", "the new geography does not load: %s" % out.strip()[-300:])
            self._json(400, {"success": False, "error": "the new geography does not load: " + out.strip()[-300:]})
            return
        with open(GEO_FILE + ".bak", "w", encoding="utf-8", newline="\n") as fh:
            fh.write(before)
        with open(GEO_FILE, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(after)
        log(GREEN, "SAVE", "%s (previous kept as antarctica-geo.js.bak)" % os.path.relpath(GEO_FILE, REPO))
        ok, out = check()
        last = out.strip().splitlines()[-1] if out.strip() else ""
        log(GREEN if ok else YELLOW, "CHECK", last)
        self._json(200, {"success": True, "checkOk": ok, "output": out,
                         "message": "Saved antarctica-geo.js. Check: " + last})

    def _file(self, base, rel, only_js=False):
        rel = posixpath.normpath(urllib.parse.unquote(rel)).lstrip("/")
        full = os.path.abspath(os.path.join(base, *rel.split("/")))
        if not full.startswith(base + os.sep) or (only_js and not full.endswith(".js")):
            self._send(403, "Forbidden", "text/plain; charset=utf-8")
            return
        if not os.path.isfile(full):
            self._send(404, "Not found", "text/plain; charset=utf-8")
            return
        with open(full, "rb") as fh:
            self._send(200, fh.read(), MIME.get(os.path.splitext(full)[1].lower(), "application/octet-stream"))


class Server(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    ap = argparse.ArgumentParser(description="Antarctica map editor server")
    ap.add_argument("--port", type=int, default=8095)
    ap.add_argument("--no-open", action="store_true", help="do not open a browser")
    args = ap.parse_args()
    try:
        httpd = Server(("127.0.0.1", args.port), Handler)
    except OSError:
        raise SystemExit("port %d is already in use; stop that server or pass --port <n>" % args.port)
    url = "http://localhost:%d/" % args.port
    line = "=" * 58
    print("%s%s%s" % (CYAN, line, RESET))
    print("%s  Antarctica Map Editor%s" % (YELLOW, RESET))
    print("%s  URL:     %s%s" % (GREEN, url, RESET))
    print("%s  editing: %s%s" % (GRAY, os.path.relpath(GEO_FILE, REPO), RESET))
    print("%s  Ctrl+C to stop%s" % (GRAY, RESET))
    print("%s%s%s" % (CYAN, line, RESET))
    if not args.no_open:
        threading.Timer(0.4, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
