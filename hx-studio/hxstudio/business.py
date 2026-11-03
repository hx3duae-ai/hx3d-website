"""HX 3D business tools: cost calculator, per-colour cost, price suggestion, quotes (PDF)."""
from __future__ import annotations
import datetime, io
from .config import MATERIALS, BRAND

DEFAULTS = {"material": "PLA", "price_kg": None, "power_w": 120.0, "kwh_price": 0.12, "machine_per_hour": 0.50,
            "labor_per_hour": 0.0, "labor_hours": 0.25, "failure_pct": 8.0, "margin_pct": 40.0, "vat_pct": 0.0,
            "flush_g_per_change": 0.35, "currency": "USD", "packaging": 0.0}
# every default above is an editable ASSUMPTION, not a Bambu/AMS specification.


def color_changes_estimate(height_mm, layer, n_colors, density_of_changes=0.5):
    if n_colors <= 1: return 0
    return int((height_mm / layer) * (n_colors - 1) * density_of_changes)


def cost(parts_by_color: dict, hours: float, height_mm: float, layer=0.2, **kw):
    """parts_by_color = {hex: grams}. Returns itemised cost + suggested price."""
    o = {**DEFAULTS, **{k: v for k, v in kw.items() if v is not None}}
    M = MATERIALS[o["material"]]; ppk = o["price_kg"] or M["price_kg"]
    items = []; mat_total = 0.0
    for hx, g in parts_by_color.items():
        c = g * ppk / 1000; mat_total += c; items.append({"label": f"filament {hx}", "grams": round(g, 2), "cost": round(c, 3)})
    n = len(parts_by_color); changes = color_changes_estimate(height_mm, layer, n)
    purge_g = changes * o["flush_g_per_change"]; purge_c = purge_g * ppk / 1000
    elec = o["power_w"] / 1000 * hours * o["kwh_price"]; mach = o["machine_per_hour"] * hours
    labor = o["labor_per_hour"] * o["labor_hours"]
    sub = mat_total + purge_c + elec + mach + labor + o["packaging"]
    fail = sub * o["failure_pct"] / 100
    total = sub + fail
    price = total * (1 + o["margin_pct"] / 100); vat = price * o["vat_pct"] / 100
    return {"items": items, "material_cost": round(mat_total, 3),
            "purge": {"color_changes_est": changes, "grams": round(purge_g, 1), "cost": round(purge_c, 3), "note": "ESTIMATE - read the real purge volume from Bambu Studio"},
            "electricity": round(elec, 3), "machine": round(mach, 3), "labor": round(labor, 3), "packaging": o["packaging"],
            "failure_allowance": round(fail, 3), "cost_total": round(total, 2), "margin_pct": o["margin_pct"],
            "price_ex_vat": round(price, 2), "vat": round(vat, 2), "price_inc_vat": round(price + vat, 2),
            "profit": round(price - total, 2), "currency": o["currency"], "assumptions": o}


def quote_pdf(client: dict, lines: list[dict], currency="USD", notes="", validity_days=14, logo_text="HX 3D") -> bytes:
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
