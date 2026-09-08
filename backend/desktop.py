"""PyInstaller entry point for the PyTrail desktop build.

Runs the FastAPI backend and pywebview window in one process; each extra
launch reuses the running instance and opens one more window instead of
starting a second server.
"""

from __future__ import annotations

import json
import os
import socket
import sys
import time
import traceback
import webbrowser
from pathlib import Path
from threading import Thread
from urllib.error import URLError
from urllib.request import urlopen

from app.practice_worker import run as run_practice_worker

DEFAULT_TITLE = "PyTrail"
DATA_DIR_NAME = "PyTrail"
SERVER_FILE_NAME = "server.json"
LOG_FILE_NAME = "desktop.log"
HEALTH_TIMEOUT_SECONDS = 60.0
HEALTH_POLL_INTERVAL = 0.25
WORKER_FLAG = "--pytrail-practice-worker"
EXEC_FLAG = "--pytrail-exec-stdin"


def data_dir() -> Path:
    root = os.getenv("APPDATA") or os.path.expanduser("~/.local/share")
    return Path(root) / DATA_DIR_NAME


def bundle_dir() -> Path:
    return Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))


def serve_forever_worker() -> None:
    if sys.argv[1:] != [WORKER_FLAG]:
        return
    run_practice_worker()
    sys.exit(0)


def serve_forever_exec() -> None:
    """Dispatch the in-lesson playground in frozen builds.

    ``/api/execute`` normally runs ``python -I -c code``, but a PyInstaller
    exe cannot interpret ``-c``.  When the API spawns us with this flag it
    feeds the source via stdin; we compile and exec it directly so the
    playground behaves like an interactive ``python -c`` session.
    """
    if sys.argv[1:] != [EXEC_FLAG]:
        return
    code = sys.stdin.buffer.read().decode("utf-8")
    for stream in (sys.stdout, sys.stderr):
        if stream is not None and hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    try:
        compiled = compile(code, "<playground>", "exec")
        exec(compiled, {"__name__": "__main__"})
    except SystemExit:
        pass
    except BaseException:
        import traceback

        traceback.print_exc()
        sys.exit(1)
    sys.exit(0)


def attach_log_streams(store: Path) -> None:
    """Give windowed builds a real stdout/stderr.

    The PyInstaller windowed bootloader leaves sys.stdout/sys.stderr as None,
    and uvicorn's startup logging then dies with AttributeError before the
    health check can ever succeed. Redirect both to an append-only log file;
    launches that already have console or pipe handles are left untouched.
    The worker mode is dispatched earlier and always runs with pipes.
    """
    if sys.stdout is not None and sys.stderr is not None:
        return
    stream = open(  # noqa: SIM115 - stays open as sys.stdout/stderr for the process lifetime
        store / LOG_FILE_NAME, "a", buffering=1, encoding="utf-8", errors="replace"
    )
    if sys.stdout is None:
        sys.stdout = stream
    if sys.stderr is None:
        sys.stderr = stream


def load_or_create_secret_key(store: Path) -> str:
    existing = store.read_text(encoding="utf-8").strip() if store.is_file() else ""
    if existing:
        return existing
    import secrets

    generated = secrets.token_hex(32)
    store.parent.mkdir(parents=True, exist_ok=True)
    store.write_text(generated, encoding="utf-8")
    return generated


def configure_environment() -> Path:
    store = data_dir()
    store.mkdir(parents=True, exist_ok=True)
    database_path = (store / "learning.db").resolve()
    os.environ.setdefault("DATABASE_URL", f"sqlite:///{database_path.as_posix()}")
    os.environ.setdefault("PYTRAIL_LOCAL_MODE", "1")
    os.environ.setdefault("SECRET_KEY", load_or_create_secret_key(store / "secret.key"))
    if getattr(sys, "frozen", False):
        base = bundle_dir()
        os.environ.setdefault(
            "COURSE_CONTENT_ROOT", str(base / "content" / "python-100-days")
        )
        os.environ.setdefault("PYTRAIL_STATIC_DIR", str(base / "web"))
    return store


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def server_is_healthy(port: int) -> bool:
    try:
        with urlopen(f"http://127.0.0.1:{port}/api/health", timeout=1.0) as response:
            return response.status == 200
    except OSError, URLError:
        return False


def start_server(port: int) -> Thread:
    import uvicorn

    from app.main import app

    config = uvicorn.Config(
        app,
        host="127.0.0.1",
        port=port,
        log_level="warning",
        lifespan="on",
    )
    server = uvicorn.Server(config)

    def run() -> None:
        server.run()

    thread = Thread(target=run, name="pytrail-api", daemon=True)
    thread.start()
    return thread


def wait_until_healthy(port: int) -> bool:
    deadline = time.monotonic() + HEALTH_TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        if server_is_healthy(port):
            return True
        time.sleep(HEALTH_POLL_INTERVAL)
    return False


def remember_running_instance(port: int, pid: int, store: Path) -> None:
    payload = json.dumps({"port": port, "pid": pid})
    (store / SERVER_FILE_NAME).write_text(payload, encoding="utf-8")


def read_recorded_instance(store: Path) -> tuple[int, int] | None:
    try:
        payload = json.loads((store / SERVER_FILE_NAME).read_text(encoding="utf-8"))
        return int(payload["port"]), int(payload["pid"])
    except OSError, ValueError, KeyError, TypeError:
        return None


def open_browser_window(url: str) -> None:
    webbrowser.open(url)


def open_desktop_window(url: str, title: str) -> bool:
    try:
        import webview
    except Exception:
        return False
    try:
        webview.create_window(title, url, width=1440, height=900, min_size=(768, 540))
        webview.start()
    except Exception:
        return False
    return True


def run(store: Path) -> None:
    configure_environment()

    url = None
    recorded = read_recorded_instance(store)
    if recorded and server_is_healthy(recorded[0]):
        url = f"http://127.0.0.1:{recorded[0]}"
    if url is None:
        port = find_free_port()
        start_server(port)
        if not wait_until_healthy(port):
            print("PyTrail backend failed to start.", file=sys.stderr)
            sys.exit(1)
        remember_running_instance(port, os.getpid(), store)
        url = f"http://127.0.0.1:{port}"

    if open_desktop_window(url, DEFAULT_TITLE):
        return
    open_browser_window(url)
    print(
        "PyTrail could not create a desktop window and opened your browser "
        "instead. Close the console or press Ctrl+C to exit.",
        file=sys.stderr,
    )
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        pass


def main() -> None:
    serve_forever_worker()
    serve_forever_exec()
    store = data_dir()
    store.mkdir(parents=True, exist_ok=True)
    attach_log_streams(store)
    try:
        run(store)
    except SystemExit:
        raise
    except BaseException:
        # Windowed builds have no console; persist the traceback so the
        # failure is diagnosable from %APPDATA%/PyTrail/desktop.log.
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
