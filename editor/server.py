#!/usr/bin/env python3
"""
Local companion server for the Civilization VII Map Editor (macOS/Linux port).

Port of editor/server.ps1, which used .NET HttpListener on Windows PowerShell.
Zero dependencies: Python 3 standard library only.

  python3 editor/server.py [--port 8080] [--no-open] [--no-mirror]
"""

import argparse
import http.server
import json
import os
import posixpath
import socket
import subprocess
import sys
import threading
import urllib.parse
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))          # .../editor
CIV7_ROOT = os.path.dirname(ROOT)                          # .../civ7mods
# The Windows script walked up an extra level when the editor lived inside the
# mod folder (EuropeMediterranean/editor). Keep that so either layout works.
if os.path.basename(CIV7_ROOT).startswith("EuropeMediterranean"):
    CIV7_ROOT = os.path.dirname(CIV7_ROOT)

MAPS_PRIMARY = os.path.join(CIV7_ROOT, "EuropeMediterranean", "maps")
MAPS_MIRROR = os.path.join(CIV7_ROOT, "EuropeMediterranean - Copy", "maps")
PREVIEW_SCRIPT = os.path.join(CIV7_ROOT, "preview", "build-preview.sh")
INSTALL_SCRIPT = os.path.join(CIV7_ROOT, "install.sh")

MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
}

GREEN, YELLOW, RED, CYAN, GRAY, RESET = (
    ("\033[32m", "\033[33m", "\033[31m", "\033[36m", "\033[90m", "\033[0m")
    if sys.stdout.isatty() else ("", "", "", "", "", "")
)

ALLOW_MIRROR = True


def run_script(path):
    """Run a ported shell script and return (ok, combined output)."""
    if not os.path.isfile(path):
        return False, "script not found: %s" % path
    proc = subprocess.run(
        ["/bin/bash", path],
        cwd=os.path.dirname(path) or CIV7_ROOT,
        capture_output=True, text=True,
    )
    out = (proc.stdout or "") + (proc.stderr or "")
    return proc.returncode == 0, out


class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "Civ7MapEditor/1.0"
    protocol_version = "HTTP/1.1"

    # ---- helpers -------------------------------------------------------

    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        # Same-origin only: this server writes files and runs install scripts,
        # so it must not be reachable from an arbitrary page in the browser.
        origin = self.headers.get("Origin")
        if origin and self._origin_ok(origin):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _origin_ok(self, origin):
        host, port = self.server.server_address[0], self.server.server_address[1]
        allowed = {
            "http://localhost:%d" % port,
            "http://127.0.0.1:%d" % port,
            "http://[::1]:%d" % port,
        }
        return origin in allowed

    def _json(self, code, obj):
        self._send(code, json.dumps(obj))

    def _reject_cross_origin(self):
        """True (and responds) if an API call came from another origin."""
        origin = self.headers.get("Origin")
        if origin and not self._origin_ok(origin):
            self.log_msg(RED, "BLOCKED", "cross-origin API call from %s" % origin)
            self._json(403, {"success": False, "error": "cross-origin request refused"})
            return True
        return False

    def log_msg(self, color, tag, msg):
        sys.stdout.write("%s[%s]%s %s\n" % (color, tag, RESET, msg))
        sys.stdout.flush()

    def log_message(self, fmt, *args):
        pass  # quiet: we log the interesting events ourselves

    # ---- routes --------------------------------------------------------

    def do_OPTIONS(self):
        self._send(200, b"", "text/plain")

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/api/status":
            self._json(200, {"status": "ok", "version": "1.0.0"})
            return
        self.serve_static(path)

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        if self._reject_cross_origin():
            return
        if path == "/api/save":
            self.api_save()
        elif path == "/api/build-preview":
            self.api_script(PREVIEW_SCRIPT, "PREVIEW", "build-preview.sh")
        elif path == "/api/install":
            self.api_script(INSTALL_SCRIPT, "INSTALL", "install.sh")
        else:
            self._json(404, {"success": False, "error": "no such endpoint"})

    def api_save(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
            data = json.loads(self.rfile.read(length).decode("utf-8"))
            # basename strips any directory component the client sent
            filename = os.path.basename(data.get("filename") or "")
            content = data.get("content")
            if not filename or not filename.endswith(".js") or content is None:
                self._json(400, {"success": False, "error": "bad filename or content"})
                return

            written = []
            targets = [MAPS_PRIMARY]
            if ALLOW_MIRROR:
                targets.append(MAPS_MIRROR)
            for d in targets:
                if os.path.isdir(d):
                    target = os.path.join(d, filename)
                    with open(target, "w", encoding="utf-8", newline="\n") as fh:
                        fh.write(content)
                    written.append(target)

            if not written:
                self._json(500, {"success": False,
                                 "error": "no maps directory found under %s" % CIV7_ROOT})
                return

            for w in written:
                self.log_msg(GREEN, "SAVE", w.replace(CIV7_ROOT + os.sep, ""))
            self._json(200, {"success": True,
                             "message": "File saved to maps directory",
                             "written": written})
        except Exception as exc:
            self.log_msg(RED, "ERROR", "save failed: %s" % exc)
            self._json(500, {"success": False, "error": str(exc)})

    def api_script(self, script, tag, label):
        self.log_msg(YELLOW, tag, "running %s ..." % label)
        try:
            ok, output = run_script(script)
            sys.stdout.write(output.rstrip() + "\n" if output.strip() else "")
            sys.stdout.flush()
            if ok:
                self._json(200, {"success": True, "output": output})
            else:
                self._json(500, {"success": False, "error": output.strip() or "script failed",
                                 "output": output})
        except Exception as exc:
            self.log_msg(RED, "ERROR", "%s failed: %s" % (label, exc))
            self._json(500, {"success": False, "error": str(exc)})

    def serve_static(self, url_path):
        rel = urllib.parse.unquote(url_path).lstrip("/")
        if rel in ("", "index.html"):
            rel = "index.html"
        # Contain the path inside ROOT (the PowerShell original did not).
        rel = posixpath.normpath(rel).lstrip("/")
        full = os.path.abspath(os.path.join(ROOT, *rel.split("/")))
        if not (full == ROOT or full.startswith(ROOT + os.sep)):
            self._send(403, b"Forbidden", "text/plain; charset=utf-8")
            return
        if not os.path.isfile(full):
            self._send(404, b"File Not Found", "text/plain; charset=utf-8")
            return
        ctype = MIME.get(os.path.splitext(full)[1].lower(), "application/octet-stream")
        with open(full, "rb") as fh:
            self._send(200, fh.read(), ctype)


class Server(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def bind(preferred):
    """Mirror the PowerShell fallback: try the wanted port, then the next few."""
    for port in [preferred] + [preferred + n for n in range(1, 11)]:
        try:
            return Server(("127.0.0.1", port), Handler), port
        except OSError as exc:
            if exc.errno not in (48, 98):  # EADDRINUSE
                raise
    raise SystemExit("could not bind %d-%d" % (preferred, preferred + 10))


def main():
    global ALLOW_MIRROR
    ap = argparse.ArgumentParser(description="Civ VII map editor companion server")
    ap.add_argument("--port", type=int, default=8080)
    ap.add_argument("--no-open", action="store_true", help="do not open a browser")
    ap.add_argument("--no-mirror", action="store_true",
                    help="save only to EuropeMediterranean/maps, not the ' - Copy' mirror")
    args = ap.parse_args()
    ALLOW_MIRROR = not args.no_mirror

    httpd, port = bind(args.port)
    url = "http://localhost:%d/" % port

    line = "=" * 58
    print("%s%s%s" % (CYAN, line, RESET))
    print("%s  Civ VII Visual Map Editor Server Started%s" % (YELLOW, RESET))
    print("%s  URL: %s%s" % (GREEN, url, RESET))
    print("%s  serving:  %s%s" % (GRAY, ROOT, RESET))
    print("%s  saving to: %s%s" % (GRAY, MAPS_PRIMARY, RESET))
    if ALLOW_MIRROR and os.path.isdir(MAPS_MIRROR):
        print("%s  mirror:    %s%s" % (GRAY, MAPS_MIRROR, RESET))
    print("%s  Press Ctrl+C to stop the server%s" % (GRAY, RESET))
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
