"""Verification API application package."""

import sys
from pathlib import Path
import importlib.util

# Ensure project root and all package paths are in sys.path
# __file__ is apps/verification-api/app/__init__.py -> 4 parents up to project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
PACKAGES_PATH = PROJECT_ROOT / "packages"
API_PATH = PROJECT_ROOT / "apps" / "verification-api"

pkg_map = {
    "verification_procedures": PACKAGES_PATH / "verification-procedures",
    "verification_fees": PACKAGES_PATH / "verification-fees",
    "verification_payments": PACKAGES_PATH / "verification-payments",
    "verification_certificates": PACKAGES_PATH / "verification-certificates",
    "verification_reminders": PACKAGES_PATH / "verification-reminders",
    "measurement": PACKAGES_PATH / "measurement",
}

for path_item in [PROJECT_ROOT, API_PATH, PACKAGES_PATH] + list(pkg_map.values()):
    if path_item.exists() and str(path_item) not in sys.path:
        sys.path.insert(0, str(path_item))

for mod_name, pkg_path in pkg_map.items():
    if mod_name not in sys.modules and pkg_path.exists():
        init_path = pkg_path / "__init__.py"
        if init_path.exists():
            spec = importlib.util.spec_from_file_location(
                mod_name,
                str(init_path),
                submodule_search_locations=[str(pkg_path)],
            )
            if spec and spec.loader:
                mod = importlib.util.module_from_spec(spec)
                sys.modules[mod_name] = mod
                sys.modules[f"packages.{mod_name}"] = mod
                spec.loader.exec_module(mod)
