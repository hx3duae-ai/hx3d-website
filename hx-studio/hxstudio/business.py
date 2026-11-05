"""HX 3D business tools: production usage report (grams / hours / colour changes) and owner-priced quote PDFs.

BUSINESS RULE: this module never calculates, estimates or suggests a price, cost or margin.
Only the owner decides prices; the quote PDF only lays out the amounts the owner typed in,
and the HTTP endpoint for it requires the owner token (HX_OWNER_TOKEN).
"""
from __future__ import annotations
import datetime, hashlib, hmac, io, os
from .config import BRAND

DEFAULTS = {"flush_g_per_change": 0.35}
# an editable ASSUMPTION, not a Bambu/AMS specification.


def color_changes_estimate(height_mm, layer, n_colors, density_of_changes=0.5):
    if n_colors <= 1: return 0
    return int((height_mm / layer) * (n_colors - 1) * density_of_changes)


def usage(parts_by_color: dict, hours: float, height_mm: float, layer=0.2, flush_g_per_change=None):
    """parts_by_color = {hex: grams}. Physical usage only (grams, hours) - no money, no price."""
    fpc = DEFAULTS["flush_g_per_change"] if flush_g_per_change is None else flush_g_per_change
    items = [{"label": f"filament {hx}", "grams": round(g, 2)} for hx, g in parts_by_color.items()]
    changes = color_changes_estimate(height_mm, layer, len(parts_by_color))
    purge_g = changes * fpc
    return {"items": items, "filament_g": round(sum(parts_by_color.values()), 2),
            "purge": {"color_changes_est": changes, "grams": round(purge_g, 1), "note": "ESTIMATE - read the real purge volume from Bambu Studio"},
            "print_hours": round(hours, 2), "pricing": "Prices are set by the owner only - this tool does not calculate or suggest prices."}


def owner_token_ok(presented: str | None) -> bool:
    """True only if HX_OWNER_TOKEN is configured (>= 24 chars) and matches (constant time)."""
    expected = os.environ.get("HX_OWNER_TOKEN", "")
    if len(expected) < 24 or not presented: return False
    return hmac.compare_digest(hashlib.sha256(presented.encode()).digest(), hashlib.sha256(expected.encode()).digest())


def quote_pdf(client: dict, lines: list[dict], currency="AED", notes="", validity_days=14, logo_text="HX 3D") -> bytes:
    """Lays out the amounts the OWNER entered. Never invents or adjusts a number."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors as rc
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet
    buf = io.BytesIO(); st = getSampleStyleSheet()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=40, rightMargin=40, topMargin=40, bottomMargin=40)
    pink = rc.HexColor(BRAND["pink"])
    S = [Table([[Paragraph(f'<font color="#FF66B2" size="26"><b>{logo_text}</b></font>', st["Normal"]),
                 Paragraph("<b>QUOTATION</b><br/>%s" % datetime.date.today().isoformat(), st["Normal"])]], colWidths=[300, 215]),
         Spacer(1, 14),
         Paragraph(f"<b>Client:</b> {client.get('name','')}<br/>{client.get('contact','')}<br/>{client.get('address','')}", st["Normal"]), Spacer(1, 12)]
    rows = [["Item", "Qty", "Unit", "Total"]]; total = 0.0
    for l in lines:
        t = l["qty"] * l["unit"]; total += t; rows.append([l["desc"], str(l["qty"]), f"{l['unit']:.2f}", f"{t:.2f}"])
    rows.append(["", "", "TOTAL " + currency, f"{total:.2f}"])
    tb = Table(rows, colWidths=[300, 50, 80, 85])
    tb.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), rc.HexColor("#050505")), ("TEXTCOLOR", (0, 0), (-1, 0), rc.white),
                            ("LINEBELOW", (0, 0), (-1, 0), 2, pink), ("GRID", (0, 1), (-1, -2), 0.3, rc.grey),
                            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"), ("ALIGN", (1, 0), (-1, -1), "RIGHT")]))
    S += [tb, Spacer(1, 12), Paragraph(f"Valid for {validity_days} days. {notes}", st["Normal"])]
    doc.build(S); return buf.getvalue()
