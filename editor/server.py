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
import re
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
PREVIEW_SCRIPT = os.path.join(CIV7_ROOT, "preview", "build-preview.sh")
INSTALL_SCRIPT = os.path.join(CIV7_ROOT, "install.sh")
# The Eurasia maps' geography is built from the Europe file, so saving that file rebuilds it, and
# the built file itself is not saved from the editor (the next rebuild would overwrite the edit).
EURASIA_BUILD = os.path.join(CIV7_ROOT, "tools", "eurasia-compressed", "build.mjs")
COMPACT_BUILD = os.path.join(CIV7_ROOT, "tools", "europe-compact", "build.mjs")
SHARED_GEO = "europe-large-geo.js"
GENERATED_GEO = {"europe-compact-geo.js": "It is built from europe-large-geo.js: edit the shared geography there (this file is rebuilt when you save it) and what is compact-only - the projection, Iceland, Ireland, the moved starts - in tools/europe-compact/build.mjs.",
                 "europe-alt-geo.js": "It is built from europe-large-geo.js: edit the shared geography there (this file is rebuilt when you save it) and Eurasia's own - the Eastern Ocean and East Asia - in tools/eurasia-compressed/build.mjs."}

# Which geography file the editor opens first. Set by --map; the browser can
# switch to any other file /api/maps lists.
SELECTED_MAP = None

# Labels for the files we ship, so the picker reads better than a bare filename.
MAP_LABELS = {
    "europe-large-geo.js": "Europe & Mediterranean - shared by all four maps",
    "europe-alt-geo.js": "Eurasia Compressed (built from the Europe file - view only)",
    "europe-compact-geo.js": "Europe & Mediterranean, compact 90x76 (built from the Europe file - view only)",
    "europe-geo.js": "Europe & Mediterranean (Standard, not registered)",
}

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



def build_id():
    """Newest mtime across the editor's own files.

    Served with /api/status and injected into index.html, so the page can notice it
    is a cached copy older than the server and say so instead of half-working.
    """
    newest = 0
    for base, _dirs, names in os.walk(ROOT):
        if os.sep + "." in base:
            continue
        for n in names:
            if n.endswith((".html", ".css", ".js", ".py")):
                try:
                    newest = max(newest, os.path.getmtime(os.path.join(base, n)))
                except OSError:
                    pass
    return str(int(newest))


def geo_files():
    """Editable geography files, nicest-named first."""
    try:
        names = sorted(n for n in os.listdir(MAPS_PRIMARY) if n.endswith("-geo.js"))
    except OSError:
        return []
    order = list(MAP_LABELS)
    names.sort(key=lambda n: (order.index(n) if n in order else 99, n))
    return [{"file": n, "label": MAP_LABELS.get(n, n)} for n in names]


TOP_KEY = re.compile(r"^    ([A-Za-z_$][A-Za-z0-9_$]*)\s*:", re.M)


def top_level_keys(text):
    """Top-level GEO keys, by the file's own 4-space house indent."""
    return set(TOP_KEY.findall(text))


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
        # Never cache. This is a local editing tool whose files change under the
        # browser constantly, and a half-stale mix of page and scripts fails in
        # confusing ways - a cached index.html asking for a script that has since
        # been deleted leaves the editor up but with no map loaded at all.
        self.send_header("Cache-Control", "no-store, must-revalidate")
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
            self._json(200, {"status": "ok", "version": "2.0.0", "build": build_id()})
            return
        if path == "/api/maps":
            files = geo_files()
            names = [f["file"] for f in files]
            sel = SELECTED_MAP if SELECTED_MAP in names else (names[0] if names else None)
            self._json(200, {"files": files, "selected": sel})
            return
        if path.startswith("/maps/"):
            self.serve_map(path[len("/maps/"):])
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
        """Write a geography file back to the mod.

        The browser sends the complete file text, produced by patching the text it
        loaded (see js/geo-io.js), so comments and untouched keys are already
        byte-identical. This is the backstop: if the incoming text has lost a
        top-level key the file on disk has, refuse the write rather than let a
        serializer regression quietly delete geography again.
        """
        try:
            length = int(self.headers.get("Content-Length") or 0)
            data = json.loads(self.rfile.read(length).decode("utf-8"))
            filename = os.path.basename(data.get("filename") or "")
            content = data.get("content")
            if not filename.endswith("-geo.js") or content is None:
                self._json(400, {"success": False, "error": "bad filename or content"})
                return

            if filename in GENERATED_GEO:
                self.log_msg(RED, "REFUSED", "%s is generated" % filename)
                self._json(403, {"success": False,
                                 "error": "Not saved: %s is generated. %s" % (filename, GENERATED_GEO[filename])})
                return

            target = os.path.join(MAPS_PRIMARY, filename)
            if not os.path.isfile(target):
                self._json(404, {"success": False, "error": "no such map file: %s" % filename})
                return

            with open(target, "r", encoding="utf-8") as fh:
                before = fh.read()

            lost = sorted(top_level_keys(before) - top_level_keys(content))
            if lost and not data.get("allowKeyLoss"):
                self.log_msg(RED, "REFUSED", "%s would lose: %s" % (filename, ", ".join(lost)))
                self._json(409, {"success": False, "keysLost": lost,
                                 "error": "refusing to save: would drop %d top-level key(s): %s"
                                          % (len(lost), ", ".join(lost))})
                return

            backup = target + ".bak"
            with open(backup, "w", encoding="utf-8", newline="\n") as fh:
                fh.write(before)
            with open(target, "w", encoding="utf-8", newline="\n") as fh:
                fh.write(content)

            self.log_msg(GREEN, "SAVE", "%s  (previous kept as %s)"
                         % (filename, os.path.basename(backup)))
            message = "Saved %s (backup: %s)" % (filename, os.path.basename(backup))
            written = [target]
            if filename == SHARED_GEO and os.path.isfile(EURASIA_BUILD):
                # carry the shared geography into the Eurasia maps
                proc = subprocess.run(["node", EURASIA_BUILD], cwd=CIV7_ROOT, capture_output=True, text=True)
                line = (proc.stdout.strip().splitlines() or [""])[0]
                if proc.returncode == 0:
                    self.log_msg(GREEN, "EURASIA", line)
                    message += "; Eurasia maps rebuilt"
                    if "found under the ocean" in line:
                        message += " (left out of Eurasia: " + line.split("found under the ocean: ", 1)[1].rstrip(")") + ")"
                    written.append(os.path.join(MAPS_PRIMARY, "europe-alt-geo.js"))
                else:
                    self.log_msg(RED, "EURASIA", (proc.stderr or proc.stdout).strip()[-400:])
                    message += "; Eurasia rebuild FAILED - run node tools/eurasia-compressed/build.mjs to see why"
            if filename == SHARED_GEO and os.path.isfile(COMPACT_BUILD):
                # ...and into the compact 90x76 size of the Europe & Mediterranean maps
                proc = subprocess.run(["node", COMPACT_BUILD], cwd=CIV7_ROOT, capture_output=True, text=True)
                if proc.returncode == 0:
                    self.log_msg(GREEN, "COMPACT", (proc.stdout.strip().splitlines() or [""])[0])
                    message += "; compact 90x76 geography rebuilt"
                    written.append(os.path.join(MAPS_PRIMARY, "europe-compact-geo.js"))
                else:
                    self.log_msg(RED, "COMPACT", (proc.stderr or proc.stdout).strip()[-400:])
                    message += "; compact rebuild FAILED - run node tools/europe-compact/build.mjs to see why"
            self._json(200, {"success": True, "message": message, "written": written})
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

    def serve_map(self, rel):
        """Read-only access to the mod's maps folder, so the page can import the
        live rasterizer and geography modules instead of a stale generated copy."""
        rel = posixpath.normpath(urllib.parse.unquote(rel)).lstrip("/")
        full = os.path.abspath(os.path.join(MAPS_PRIMARY, *rel.split("/")))
        if not full.startswith(MAPS_PRIMARY + os.sep) or not full.endswith(".js"):
            self._send(403, b"Forbidden", "text/plain; charset=utf-8")
            return
        if not os.path.isfile(full):
            self._send(404, b"File Not Found", "text/plain; charset=utf-8")
            return
        with open(full, "rb") as fh:
            self._send(200, fh.read(), MIME[".js"])

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
            body = fh.read()
        if os.path.basename(full) == "index.html":
            body = body.replace(b"__BUILD__", build_id().encode())
        self._send(200, body, ctype)


class Server(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def port_holder(port):
    """Describe whatever already owns `port`, so the error can name it."""
    try:
        out = subprocess.run(["lsof", "-nP", "-tiTCP:%d" % port, "-sTCP:LISTEN"],
                             capture_output=True, text=True).stdout.split()
        if not out:
            return ""
        pid = out[0]
        cmd = subprocess.run(["ps", "-o", "command=", "-p", pid],
                             capture_output=True, text=True).stdout.strip()
        return "  pid %s: %s" % (pid, cmd)
    except Exception:
        return ""


def bind(preferred):
    """Bind the requested port, or stop.

    The PowerShell original quietly walked up to the next free port. That reads fine
    in the startup banner and then wastes an afternoon: a second editor lands on
    8081 while the browser tab still points at 8080, and the two disagree about what
    is on disk. Refuse instead, and say what is holding the port.
    """
    try:
        return Server(("127.0.0.1", preferred), Handler), preferred
    except OSError as exc:
        if exc.errno not in (48, 98):  # EADDRINUSE
            raise
    holder = port_holder(preferred)
    raise SystemExit(
        "port %d is already in use%s\n"
        "Stop it first, or start on another port with --port <n>."
        % (preferred, ("\n" + holder) if holder else "")
    )


def main():
    global SELECTED_MAP
    ap = argparse.ArgumentParser(description="Civ VII map editor companion server")
    ap.add_argument("--port", type=int, default=8080)
    ap.add_argument("--no-open", action="store_true", help="do not open a browser")
    ap.add_argument("--map", metavar="FILE", default=None,
                    help="geography file to open first, e.g. europe-alt-geo.js "
                         "(default: the first one listed; switchable in the browser)")
    ap.add_argument("--no-mirror", action="store_true", help=argparse.SUPPRESS)
    args = ap.parse_args()

    available = [f["file"] for f in geo_files()]
    if not available:
        raise SystemExit("no *-geo.js files in %s" % MAPS_PRIMARY)
    if args.map:
        want = os.path.basename(args.map)
        if not want.endswith(".js"):
            want += "-geo.js" if not want.endswith("-geo") else ".js"
        if want not in available:
            raise SystemExit("unknown map %r; available: %s" % (args.map, ", ".join(available)))
        SELECTED_MAP = want
    else:
        SELECTED_MAP = available[0]

    httpd, port = bind(args.port)
    url = "http://localhost:%d/" % port

    line = "=" * 58
    print("%s%s%s" % (CYAN, line, RESET))
    print("%s  Civ VII Visual Map Editor Server Started%s" % (YELLOW, RESET))
    print("%s  URL: %s%s" % (GREEN, url, RESET))
    print("%s  serving:  %s%s" % (GRAY, ROOT, RESET))
    print("%s  maps:      %s%s" % (GRAY, MAPS_PRIMARY, RESET))
    print("%s  editing:   %s%s" % (GRAY, SELECTED_MAP, RESET))
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
