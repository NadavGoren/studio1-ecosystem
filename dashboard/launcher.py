#!/usr/bin/env python3
"""
Studio 1 — App Launcher Server

Run once:   python3 launcher.py
Then open:  http://localhost:7777

Each app starts in the background. Clicking Launch in the dashboard
opens that app's URL in Google Chrome.
"""

import subprocess
import os
import signal
import json
import time
import socket
import glob
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs


REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def p(*parts):
    return os.path.join(REPO, *parts)


# ── App registry ─────────────────────────────────────────────────────────────
# kind:
#   server   — spawn a process, wait for port, then open Chrome to url
#   static   — no process; open file:// in Chrome
#   desktop  — spawn a process, no URL
APPS = {
    # ── Generators ────────────────────────────────────────────────
    "flow-field": {
        "name": "Flow Field Generator",
        "group": "Generators",
        "kind": "server",
        "cwd": p("generators", "Flow Field Generator"),
        "cmd": ["python3", "app.py"],
        "port": 8000,
        "url": "http://localhost:8000",
    },
    "hatch": {
        "name": "Hatch Generator",
        "group": "Generators",
        "kind": "server",
        "cwd": p("generators", "Hatch Generator"),
        "cmd": ["npm", "run", "dev"],
        "port": 4000,
        "url": "http://localhost:4000",
    },
    "image-processor-backend": {
        "name": "Image Processor (Backend)",
        "group": "Generators",
        "kind": "server",
        "cwd": p("generators", "Image Processor", "backend"),
        "cmd": ["python3", "app.py"],
        "port": 5500,
        "url": "http://localhost:5500",
    },
    "image-processor-frontend": {
        "name": "Image Processor (Frontend)",
        "group": "Generators",
        "kind": "server",
        "cwd": p("generators", "Image Processor", "frontend"),
        "cmd": ["npm", "run", "dev", "--", "--port", "5174"],
        "port": 5174,
        "url": "http://localhost:5174",
    },
    "midi": {
        "name": "Midi Project",
        "group": "Generators",
        "kind": "server",
        "cwd": p("generators", "Midi Project"),
        "cmd": ["python3", "app.py"],
        "port": 5050,
        "url": "http://localhost:5050",
    },
    "stl-generator": {
        "name": "STL Generator",
        "group": "Generators",
        "kind": "server",
        "cwd": p("generators", "STL GENERATOR", "stl-generator"),
        "cmd": ["npm", "run", "dev"],
        "port": 5173,
        "url": "http://localhost:5173",
    },
    "fill-generator": {
        "name": "Fill Generator (STL2SVG)",
        "group": "Generators",
        "kind": "server",
        "cwd": p("generators", "Fill Generator", "STL2SVG Generator"),
        "cmd": ["python3", "server.py"],
        "port": 8001,
        "url": "http://localhost:8001/3d-generator.html",
    },
    "home-generator": {
        "name": "HOME Generator",
        "group": "Generators",
        "kind": "server",
        "cwd": p("generators", "Fill Generator", "HOME Generator"),
        "cmd": ["npm", "run", "dev", "--", "--port", "3002"],
        "port": 3002,
        "url": "http://localhost:3002",
    },
    "cube-generator": {
        "name": "3D Cube Generator",
        "group": "Generators",
        "kind": "server",
        "cwd": p("generators", "Fill Generator", "3D Cube Generator"),
        "cmd": ["python3", "server.py", "8003"],
        "port": 8003,
        "url": "http://localhost:8003/3d-generator.html",
    },
    "fill-generator-classic": {
        "name": "Fill Generator",
        "group": "Generators",
        "kind": "static",
        "cwd": p("generators", "Fill Generator", "Fill Generator"),
        "file": "index.html",
    },
    "ribbon": {
        "name": "Ribbon Generator",
        "group": "Generators",
        "kind": "server",
        "cwd": p("generators", "Ribbon Generator"),
        "cmd": ["python3", "app.py"],
        "port": 8002,
        "url": "http://localhost:8002",
    },
    "music-viz": {
        "name": "Music Viz (Buu)",
        "group": "Generators",
        "kind": "desktop",
        "cwd": p("generators", "Music Viz"),
        "cmd": ["python3", "Buu.py"],
        "port": None,
        "url": None,
    },
    "snake": {
        "name": "Snake",
        "group": "Generators",
        "kind": "static",
        "cwd": p("generators", "Snake"),
        "file": "index.html",
    },
    "gif-generator": {
        "name": "GIF Generator",
        "group": "Generators",
        "kind": "server",
        "cwd": p("generators", "GIF Generator"),
        "cmd": ["python3", "-m", "http.server", "8088"],
        "port": 8088,
        "url": "http://localhost:8088",
    },
    "svg-splitter": {
        "name": "SVG Splitter",
        "group": "Generators",
        "kind": "static",
        "cwd": p("generators", "SVG Splitter"),
        "file": "index.html",
    },
    "weaving": {
        "name": "Weaving Generator",
        "group": "Generators",
        "kind": "static",
        "cwd": p("generators", "Weaving Generator"),
        "file": "index.html",
    },
    "woven-grid": {
        "name": "Woven Grid Generator",
        "group": "Generators",
        "kind": "static",
        "cwd": p("generators", "Woven Grid Generator"),
        "file": "index.html",
    },
    "hershey-hebrew": {
        "name": "Hershey Hebrew Generator",
        "group": "Generators",
        "kind": "server",
        "cwd": p("generators", "Hershey Hebrew Generator"),
        "cmd": ["python3", "server.py"],
        "port": 8095,
        "url": "http://localhost:8095",
    },
    "modular": {
        "name": "Modular Generator",
        "group": "Generators",
        "kind": "static",
        "cwd": p("generators", "Modular Generator"),
        "file": "index.html",
    },
    "rietveld-lattice": {
        "name": "Rietveld Lattice",
        "group": "Generators",
        "kind": "server",
        "cwd": p("generators", "Rietveld Lattice"),
        "cmd": ["npm", "run", "dev"],
        "port": 6060,
        "url": "http://localhost:6060",
    },
    # ── Plotter ───────────────────────────────────────────────────
    "plotter-ui": {
        "name": "Plotter UI",
        "group": "Plotter",
        "kind": "server",
        "cwd": p("plotter-slicer", "plotter-ui"),
        "cmd": ["python3", "app.py"],
        "port": 5001,
        "url": "http://localhost:5001",
    },
    # ── OS / Utilities ────────────────────────────────────────────
    "studio-os": {
        "name": "Studio-OS",
        "group": "OS",
        "kind": "server",
        "cwd": p("studio-os", "Studio-OS"),
        "cmd": ["npm", "run", "dev", "--", "--port", "3001"],
        "port": 3001,
        "url": "http://localhost:3001",
    },
    "tracker": {
        "name": "Studio 1 Tracker",
        "group": "Utilities",
        "kind": "server",
        "cwd": p("studio1-tracker"),
        "cmd": ["npm", "start"],
        "port": 3137,
        "url": "http://localhost:3137",
    },
}


running = {}  # app_id -> subprocess.Popen


def get_shell_env():
    env = os.environ.copy()
    extras = [
        "/usr/local/bin",
        "/opt/homebrew/bin",
        os.path.expanduser("~/.npm-global/bin"),
    ]
    extras += glob.glob(os.path.expanduser("~/.nvm/versions/node/*/bin"))
    env["PATH"] = ":".join(extras) + ":" + env.get("PATH", "")
    return env


def is_port_in_use(port):
    if not port:
        return False
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.3)
        return s.connect_ex(("127.0.0.1", port)) == 0


def wait_for_port(port, timeout=20):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if is_port_in_use(port):
            return True
        time.sleep(0.3)
    return False


def open_in_chrome(url):
    try:
        subprocess.Popen(
            ["open", "-a", "Google Chrome", url],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except Exception:
        pass


def clean_lock_files(app_id):
    cwd = APPS[app_id].get("cwd", "")
    if not cwd:
        return
    lock = os.path.join(cwd, ".next", "dev", "lock")
    if os.path.exists(lock):
        try:
            os.remove(lock)
        except OSError:
            pass


def start_app(app_id):
    app = APPS[app_id]
    kind = app["kind"]

    if kind == "static":
        file_url = "file://" + os.path.join(app["cwd"], app["file"])
        open_in_chrome(file_url)
        return {"status": "started", "url": file_url, "static": True}

    cwd = app["cwd"]
    if not os.path.isdir(cwd):
        return {"status": "error", "message": f"Directory not found: {cwd}"}

    port = app.get("port")

    # Already running externally?
    if port and is_port_in_use(port):
        open_in_chrome(app["url"])
        return {"status": "already_running", "url": app["url"]}

    # Already running by us?
    if app_id in running and running[app_id].poll() is None:
        if app["url"]:
            open_in_chrome(app["url"])
        return {"status": "already_running", "url": app.get("url")}

    clean_lock_files(app_id)

    try:
        if kind == "desktop":
            proc = subprocess.Popen(
                app["cmd"],
                cwd=cwd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                preexec_fn=os.setsid,
                env=get_shell_env(),
            )
            running[app_id] = proc
            return {"status": "started", "url": None, "desktop": True}

        # kind == "server"
        proc = subprocess.Popen(
            app["cmd"],
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            preexec_fn=os.setsid,
            env=get_shell_env(),
        )
        running[app_id] = proc

        # Wait for the port to come up (npm dev servers can take ~10s)
        if not wait_for_port(port, timeout=25):
            if proc.poll() is not None:
                output = proc.stdout.read().decode(errors="replace")[:500]
                del running[app_id]
                return {"status": "error", "message": f"Process exited.\n{output}"}
            # Process is alive but port didn't open — open Chrome anyway
        open_in_chrome(app["url"])
        return {"status": "started", "url": app["url"]}
    except FileNotFoundError as e:
        return {"status": "error", "message": str(e)}


def stop_app(app_id):
    app = APPS.get(app_id, {})
    if app.get("kind") == "static":
        return {"status": "not_running"}

    if app_id not in running:
        return {"status": "not_running"}

    proc = running[app_id]
    if proc.poll() is not None:
        del running[app_id]
        return {"status": "not_running"}

    try:
        os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
        proc.wait(timeout=5)
    except (ProcessLookupError, subprocess.TimeoutExpired):
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        except ProcessLookupError:
            pass

    del running[app_id]
    return {"status": "stopped"}


def get_status():
    out = {}
    for app_id, app in APPS.items():
        if app["kind"] == "static":
            out[app_id] = "ready"
            continue
        if app_id in running and running[app_id].poll() is None:
            out[app_id] = "running"
            continue
        if app_id in running:
            del running[app_id]
        port = app.get("port")
        out[app_id] = "running" if port and is_port_in_use(port) else "stopped"
    return out


# ── HTTP server ──────────────────────────────────────────────────────────────
class LauncherHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.dirname(os.path.abspath(__file__)), **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/status":
            return self._json(get_status())

        if path == "/api/apps":
            info = {}
            for k, v in APPS.items():
                info[k] = {
                    "name": v["name"],
                    "group": v.get("group", "Other"),
                    "kind": v["kind"],
                    "url": v.get("url"),
                    "port": v.get("port"),
                }
            return self._json(info)

        if path == "/api/start":
            app_id = parse_qs(parsed.query).get("app", [None])[0]
            if app_id not in APPS:
                return self._json({"status": "error", "message": "Unknown app"}, 400)
            return self._json(start_app(app_id))

        if path == "/api/stop":
            app_id = parse_qs(parsed.query).get("app", [None])[0]
            if app_id not in APPS:
                return self._json({"status": "error", "message": "Unknown app"}, 400)
            return self._json(stop_app(app_id))

        return super().do_GET()

    def _json(self, data, code=200):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        if args and "/api/" in str(args[0]):
            return
        super().log_message(format, *args)


def cleanup():
    print("\nShutting down apps...")
    for app_id in list(running.keys()):
        stop_app(app_id)
    print("Done.")


if __name__ == "__main__":
    PORT = 7777
    server = HTTPServer(("127.0.0.1", PORT), LauncherHandler)

    print("╔════════════════════════════════════════════╗")
    print("║   Studio 1 — Dashboard Launcher            ║")
    print(f"║   http://localhost:{PORT}                      ║")
    print("║   Press Ctrl+C to stop.                    ║")
    print("╚════════════════════════════════════════════╝")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        cleanup()
        server.server_close()
