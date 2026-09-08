# One-folder Windows desktop build for PyTrail.
#
# Prerequisites: the web bundle must already exist at frontend/dist and the
# backend environment must be synced (uv sync --locked). Run from backend/:
#   uv run pyinstaller pytrail_desktop.spec --noconfirm
# Output lands in dist/PyTrail/ and can be zipped for distribution.

import os
from pathlib import Path

SPECPATH = Path(SPECPATH).resolve()  # noqa: F821 - injected by PyInstaller

CONTENT_ROOT = SPECPATH / "content" / "python-100-days"
PRACTICE_ROOT = SPECPATH / "content" / "practice"
WEB_ROOT = SPECPATH.parent / "frontend" / "dist"


def tree_datas(root: Path, dest: str) -> list[tuple[str, str]]:
    return [
        (str(path), os.path.join(dest, str(path.parent.relative_to(root))))
        for path in root.rglob("*")
        if path.is_file()
    ]


missing = [str(path) for path in (CONTENT_ROOT, PRACTICE_ROOT, WEB_ROOT) if not path.is_dir()]
if missing:
    raise SystemExit(
        "Missing required build inputs: "
        + ", ".join(missing)
        + ". Build the frontend (pnpm build) and check content/ first."
    )

a = Analysis(
    ["desktop.py"],
    pathex=[str(SPECPATH)],
    binaries=[],
    datas=tree_datas(CONTENT_ROOT, os.path.join("content", "python-100-days"))
    + tree_datas(PRACTICE_ROOT, os.path.join("content", "practice"))
    + tree_datas(WEB_ROOT, "web"),
    hiddenimports=[
        "uvicorn.logging",
        "uvicorn.loops.auto",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan.on",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["psycopg", "pytest", "httpx2", "ruff"],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="PyTrail",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="PyTrail",
)
