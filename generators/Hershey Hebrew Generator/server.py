#!/usr/bin/env python3
"""Hershey Hebrew Generator — tiny local server.

Serves the static tool AND persists hand-edits to font/overrides.json so they are
saved to a real file forever (not just the browser).

  GET  /api/overrides  -> contents of font/overrides.json  (or {})
  POST /api/overrides  -> write the JSON body to font/overrides.json

Run:  python3 server.py [port]
"""
import json, os, sys
from http.server import SimpleHTTPRequestHandler, HTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
OVERRIDES = os.path.join(HERE, "font", "overrides.json")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8095


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=HERE, **k)

    def _json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.split("?")[0] == "/api/overrides":
            try:
                with open(OVERRIDES, encoding="utf-8") as f:
                    return self._json(json.load(f))
            except FileNotFoundError:
                return self._json({})
            except Exception as e:
                return self._json({"error": str(e)}, 500)
        return super().do_GET()

    def do_POST(self):
        if self.path.split("?")[0] == "/api/overrides":
            n = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(n) if n else b"{}"
            try:
                data = json.loads(raw or b"{}")
            except Exception as e:
                return self._json({"error": "bad json: " + str(e)}, 400)
            os.makedirs(os.path.dirname(OVERRIDES), exist_ok=True)
            tmp = OVERRIDES + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=1)
            os.replace(tmp, OVERRIDES)                     # atomic write
            return self._json({"ok": True, "glyphs": len(data)})
        return self._json({"error": "not found"}, 404)

    def log_message(self, *a):
        pass                                               # quiet


if __name__ == "__main__":
    print(f"Hershey Hebrew Generator — http://localhost:{PORT}")
    HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
