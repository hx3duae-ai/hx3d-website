"""Printer / material / brand configuration. Every number that is an ASSUMPTION is tagged."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
FONTS = ROOT / "fonts"

BRAND = {"black": "#050505", "pink": "#FF66B2", "white": "#FFFFFF", "name": "HX 3D AI Studio"}

# Default printer profile. build_volume is the published Bambu Lab P2S figure as far as known to the
# author - tagged ASSUMPTION: confirm on Bambu's spec page before relying on edge-of-bed prints.
PRINTERS = {
    "bambu_p2s": {"name": "Bambu Lab P2S", "build_volume": [256, 256, 256], "nozzle": 0.4, "layer_heights": [0.12, 0.16, 0.2, 0.28],
                  "ams_slots": 4, "max_ams_units": 4, "margin": 5, "volume_is_assumption": True,
                  "speed_mm3_s": 12.0},   # average volumetric throughput used for time ESTIMATES only
}
DEFAULT_PRINTER = "bambu_p2s"

# density g/cm3, price/kg are editable defaults (ASSUMPTION), clearance = print-in-place gap estimate
MATERIALS = {
    "PLA":  {"density": 1.24, "price_kg": 20.0, "clearance": 0.30, "min_wall": 0.8, "max_overhang": 50},
    "PETG": {"density": 1.27, "price_kg": 22.0, "clearance": 0.35, "min_wall": 0.8, "max_overhang": 45},
    "ABS":  {"density": 1.04, "price_kg": 22.0, "clearance": 0.40, "min_wall": 1.2, "max_overhang": 45},
}
DEFAULT_MATERIAL = "PLA"
