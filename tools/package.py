#!/usr/bin/env python3
"""Create a reproducible, dependency-free local Foundry module ZIP."""
import hashlib
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / "module.json").read_text())
translations = json.loads((ROOT / "lang/en.json").read_text())

def translation_exists(path):
    value = translations
    for part in path.split("."):
        if not isinstance(value, dict) or part not in value:
            return False
        value = value[part]
    return isinstance(value, str)

assert manifest["id"] == "fabula-affinity-nameplates"
assert all(str(value) == "13" for value in manifest["compatibility"].values())
for name in manifest["esmodules"] + [lang["path"] for lang in manifest["languages"]] + [manifest["readme"], manifest["license"]]:
    assert (ROOT / name).is_file(), "Missing manifest path: " + name

for key in translations["FAN"]["settings"]:
    for field in ["name", "hint"]:
        assert translation_exists("FAN.settings.{}.{}".format(key, field))
for key in ["belowNameplates", "aboveNameplates", "leftNameplates", "rightNameplates", "belowToken", "aboveToken", "leftToken", "rightToken"]:
    assert translation_exists("FAN.placements." + key)
for key in ["physical", "air", "bolt", "dark", "earth", "fire", "ice", "light", "poison"]:
    assert translation_exists("FAN.elements." + key)
for key in ["VU", "RS", "IM", "AB"]:
    assert translation_exists("FAN.affinities." + key)
for key in ["font", "shadow", "outline", "positioning"]:
    assert translation_exists("FAN.groups." + key)

runtime = [ROOT / name for name in ["module.json", "README.md", "LICENSE", "ASSET_NOTICE.md", "CHANGELOG.md"]]
runtime += sorted((ROOT / "scripts").glob("*.mjs")) + sorted((ROOT / "lang").glob("*.json"))
for source in (ROOT / "scripts").glob("*.mjs"):
    for imported in re.findall(r'from\s+["\'](\.[^"\']+)["\']', source.read_text()):
        assert (source.parent / imported).is_file(), "Missing import: " + imported

destination = ROOT / "dist"
destination.mkdir(exist_ok=True)
archive = destination / "{}-{}.zip".format(manifest["id"], manifest["version"])
with zipfile.ZipFile(str(archive), "w", compression=zipfile.ZIP_DEFLATED) as output:
    for path in sorted(runtime):
        info = zipfile.ZipInfo(path.relative_to(ROOT).as_posix(), (2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        output.writestr(info, path.read_bytes())
with zipfile.ZipFile(str(archive)) as output:
    assert output.testzip() is None
    assert "module.json" in output.namelist()
    assert len(output.namelist()) == len(runtime)
checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
archive.with_suffix(".zip.sha256").write_text(checksum + "  " + archive.name + "\n")
for name in ["module.json", "manifest.json"]:
    (destination / name).write_text(json.dumps(manifest, indent=2) + "\n")
print("Packaged {} files: {}".format(len(runtime), archive))
print("SHA-256: " + checksum)
