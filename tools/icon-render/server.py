#!/usr/bin/env python3
"""Serve the icon render page and accept rendered PNGs back.

    python3 tools/icon-render/server.py Byzantium/icons          # then open http://127.0.0.1:8765/

The page (index.html) exposes window.renderSvg(svgText, size) -> PNG data URL. Run this in the
browser console (or via an automation tool) to render every source and post the results here:

    const specs = [["civ_sym_byzantium",256],["unitflag_cataphract",128]];   // name, pixel size
    const out = {};
    for (const [n, size] of specs) {
      const t = await (await fetch('/src/' + n + '.svg', {cache:'no-store'})).text();
      out[n] = await renderSvg(t, size);
    }
    await (await fetch('/save', {method:'POST', body: JSON.stringify(out)})).json();

The SVGs are read from <icons dir>/src and the PNGs are written next to them in <icons dir>.
A browser is used because ImageMagick on this machine lacks librsvg and Chrome headless hangs.
"""
import base64, json, os, sys
from http.server import SimpleHTTPRequestHandler, HTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
ICONS = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(os.getcwd(), "Byzantium", "icons")
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8765


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/src/"):
            name = os.path.basename(self.path.split("?")[0])
            path = os.path.join(ICONS, "src", name)
            if not os.path.isfile(path):
                self.send_error(404); return
            data = open(path, "rb").read()
            self.send_response(200); self.send_header("Content-Type", "image/svg+xml")
            self.send_header("Content-Length", str(len(data))); self.end_headers(); self.wfile.write(data)
            return
        path = os.path.join(HERE, "index.html")
        data = open(path, "rb").read()
        self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data))); self.end_headers(); self.wfile.write(data)

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        data = json.loads(self.rfile.read(n))
        written = []
        for name, url in data.items():
            safe = os.path.basename(name)
            with open(os.path.join(ICONS, safe + ".png"), "wb") as fh:
                fh.write(base64.b64decode(url.split(",", 1)[1]))
            written.append(safe)
        body = json.dumps({"written": written}).encode()
        self.send_response(200); self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    print(f"serving icon render page on http://127.0.0.1:{PORT}/  (icons: {ICONS})")
    HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
