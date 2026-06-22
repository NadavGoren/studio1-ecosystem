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
import threading
import tempfile
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs


REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# ── App registry ─────────────────────────────────────────────────────────────
# Apps are DISCOVERED, not hardcoded. Every app folder carries its own
# `launcher.json` manifest — the single source of truth for how it launches:
#
#   { "id": "flow-field", "name": "Flow Field Generator", "group": "Generators",
#     "kind": "server", "cmd": ["python3", "app.py"], "port": 8000 }
#
# kind:
#   server   — spawn `cmd`, wait for `port`, then open Chrome to the url
#              (url = http://localhost:<port><path>; `path` defaults to "")
#   static   — no process; open file://<cwd>/<file> in Chrome
#   desktop  — spawn `cmd`, no URL (e.g. a Tkinter app)
#
# Drop a folder with a launcher.json anywhere under the repo and it shows up
# here automatically — no edits to this file. Restart launcher.py to pick up
# newly added or changed manifests.

GROUP_RANK = {"Generators": 0, "Plotter": 1, "OS": 2, "Utilities": 3}

# Directory names never descended into while discovering manifests:
#   node_modules/__pycache__ — noise;  _template — a copy-me stub, not a real app;
#   dashboard — this launcher itself.  Hidden dirs (.git, .claude) are pruned too.
_SKIP_DIRS = {"node_modules", "__pycache__", "_template", "dashboard"}

manifest_errors = {}  # launcher.json path -> parse/validation error (shown at startup)


def discover_apps():
    """Walk the repo and build the app registry from per-app launcher.json files.

    The manifest's location IS the app's working directory, so moving an app
    folder can never desync its launch config from the dashboard.
    """
    found = {}
    for dirpath, dirnames, filenames in os.walk(REPO):
        # Prune noise + hidden dirs in place so os.walk never descends into them.
        dirnames[:] = [d for d in dirnames if d not in _SKIP_DIRS and not d.startswith(".")]
        if "launcher.json" not in filenames:
            continue
        mpath = os.path.join(dirpath, "launcher.json")
        try:
            with open(mpath, encoding="utf-8") as f:
                cfg = json.load(f)
        except (OSError, ValueError) as e:
            manifest_errors[mpath] = str(e)
            continue

        aid = cfg.get("id")
        if not aid:
            manifest_errors[mpath] = "missing required field 'id'"
            continue
        if aid in found:
            manifest_errors[mpath] = f"duplicate id '{aid}' (also at {found[aid]['cwd']})"
            continue

        kind = cfg.get("kind", "server")
        app = {
            "name": cfg.get("name", aid),
            "group": cfg.get("group", "Other"),
            "kind": kind,
            "cwd": dirpath,
            "order": cfg.get("order", 1000),
        }
        if kind == "static":
            app["file"] = cfg.get("file", "index.html")
        elif kind == "desktop":
            app["cmd"] = cfg.get("cmd", [])
            app["port"] = None
            app["url"] = None
        else:  # server
            app["cmd"] = cfg.get("cmd", [])
            port = cfg.get("port")
            app["port"] = port
            app["url"] = f"http://localhost:{port}{cfg.get('path', '')}" if port else None

        found[aid] = app

    # Sort by group rank, then the app's own `order`, then name — a stable,
    # curated sequence independent of filesystem walk order.
    return dict(sorted(
        found.items(),
        key=lambda kv: (GROUP_RANK.get(kv[1]["group"], 99), kv[1]["order"], kv[1]["name"]),
    ))


APPS = discover_apps()


running = {}    # app_id -> subprocess.Popen
launching = {}  # app_id -> True while we wait (in a thread) for its port
errors = {}     # app_id -> last startup error message


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
    # Probe BOTH IPv4 and IPv6 loopback. Vite/npm dev servers bind "localhost"
    # which resolves to ::1 (IPv6) — an IPv4-only probe misses them entirely,
    # making the launcher think they're down and spawn a doomed duplicate.
    if not port:
        return False
    for family, addr in ((socket.AF_INET, "127.0.0.1"), (socket.AF_INET6, "::1")):
        try:
            with socket.socket(family, socket.SOCK_STREAM) as s:
                s.settimeout(0.3)
                if s.connect_ex((addr, port)) == 0:
                    return True
        except OSError:
            pass
    return False


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


def log_path(app_id):
    return os.path.join(tempfile.gettempdir(), f"studio1-{app_id}.log")


def read_log_tail(app_id, limit=1500):
    try:
        with open(log_path(app_id), "r", errors="replace") as f:
            return f.read()[-limit:].strip()
    except OSError:
        return ""


def await_port_and_open(app_id):
    """Background worker: wait for the app's port, then open Chrome.

    Runs in its own thread so a slow dev-server cold start never blocks the
    dashboard (status polls, other launches) the way the old inline wait did.
    """
    app = APPS.get(app_id, {})
    port = app.get("port")
    proc = running.get(app_id)
    try:
        deadline = time.time() + 90
        while time.time() < deadline:
            if port and is_port_in_use(port):
                break  # server is up
            if proc is not None and proc.poll() is not None:
                # Process exited before the port opened — surface why, fast.
                errors[app_id] = read_log_tail(app_id) or "Process exited during startup."
                running.pop(app_id, None)
                return
            if not port:
                break  # nothing portwise to wait on
            time.sleep(0.3)
        # Port is up (or alive-but-slow past the deadline) — open it.
        if app.get("url"):
            open_in_chrome(app["url"])
    finally:
        launching.pop(app_id, None)


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

    # Already running externally or by us?
    if port and is_port_in_use(port):
        open_in_chrome(app["url"])
        return {"status": "already_running", "url": app["url"]}
    if app_id in launching:
        return {"status": "starting", "url": app.get("url")}
    if app_id in running and running[app_id].poll() is None:
        if app.get("url"):
            open_in_chrome(app["url"])
        return {"status": "already_running", "url": app.get("url")}

    clean_lock_files(app_id)
    errors.pop(app_id, None)

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

        # kind == "server" — log to a file (not a PIPE). A chatty dev server
        # that fills an undrained PIPE buffer will block and hang; a file won't.
        logf = open(log_path(app_id), "w")
        try:
            proc = subprocess.Popen(
                app["cmd"],
                cwd=cwd,
                stdout=logf,
                stderr=subprocess.STDOUT,
                preexec_fn=os.setsid,
                env=get_shell_env(),
            )
        finally:
            logf.close()  # the child keeps its own copy of the fd
        running[app_id] = proc
        launching[app_id] = True

        # Return immediately; a background thread waits for the port and opens
        # Chrome the moment the server is actually ready.
        threading.Thread(
            target=await_port_and_open, args=(app_id,), daemon=True
        ).start()
        return {"status": "starting", "url": app.get("url")}
    except FileNotFoundError as e:
        errors[app_id] = str(e)
        return {"status": "error", "message": str(e)}


def stop_app(app_id):
    app = APPS.get(app_id, {})
    if app.get("kind") == "static":
        return {"status": "not_running"}

    launching.pop(app_id, None)
    errors.pop(app_id, None)

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
        port = app.get("port")
        proc = running.get(app_id)
        alive = proc is not None and proc.poll() is None
        if port and is_port_in_use(port):
            launching.pop(app_id, None)
            out[app_id] = "running"
        elif app_id in launching and alive:
            out[app_id] = "starting"
        elif alive and not port:        # desktop app, no port to probe
            out[app_id] = "running"
        elif app_id in errors:
            out[app_id] = "error"
        else:
            if proc is not None and not alive:
                running.pop(app_id, None)
            out[app_id] = "stopped"
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

        if path == "/api/errors":
            return self._json(errors)

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
    server = ThreadingHTTPServer(("127.0.0.1", PORT), LauncherHandler)

    print("╔════════════════════════════════════════════╗")
    print("║   Studio 1 — Dashboard Launcher            ║")
    print(f"║   http://localhost:{PORT}                      ║")
    print("║   Press Ctrl+C to stop.                    ║")
    print("╚════════════════════════════════════════════╝")
    print(f"Discovered {len(APPS)} apps from launcher.json manifests.")
    if manifest_errors:
        print("⚠  Skipped malformed manifests:")
        for mpath, err in manifest_errors.items():
            print(f"   • {os.path.relpath(mpath, REPO)}: {err}")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        cleanup()
        server.server_close()
