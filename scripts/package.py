"""Package the already-built offline plugin without node_modules or source files."""
import hashlib
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parent.parent
plugin = root / "utools"
version = json.loads((plugin / "plugin.json").read_text())["version"]
package = root / f"utools-funcalc-{version}.upx"
with ZipFile(package, "w", ZIP_DEFLATED) as archive:
    for name in ["plugin.json", "preload.js", "logo.png"]:
        archive.write(plugin / name, name)
    for path in sorted((plugin / "dist").rglob("*")):
        if path.is_file():
            archive.write(path, path.relative_to(plugin))
(root / "SHA256SUMS").write_text(f"{hashlib.sha256(package.read_bytes()).hexdigest()}  {package.name}\n")
print(package.name)
