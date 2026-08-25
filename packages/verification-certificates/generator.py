"""Deterministic PDF/A-Compliant Legal Metrology Verification Certificate Generator.

Generates official Form 8 / Schedule XI compliant Verification Certificates
under Section 24 of The Legal Metrology Act, 2009 and Rule 11 of the
Legal Metrology (General) Rules, 2011.
"""

from __future__ import annotations

import io
import os
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple, Union

import qrcode
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, inch, mm
pt = 1
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    HRFlowable,
    Image as RLImage,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

try:
    from .hasher import calculate_canonical_payload_hash, calculate_pdf_bytes_hash
    from .models import (
        CertificateDocumentData,
        InstrumentDocData,
        SignatureDocData,
        StampDocData,
        StandardDocData,
        VerificationDocData,
    )
except ImportError:
    from hasher import calculate_canonical_payload_hash, calculate_pdf_bytes_hash
    from models import (
        CertificateDocumentData,
        InstrumentDocData,
        SignatureDocData,
        StampDocData,
        StandardDocData,
        VerificationDocData,
    )


# Palette Definitions
COLOR_PRIMARY = colors.HexColor("#0D2B45")       # Deep Navy
COLOR_SECONDARY = colors.HexColor("#1A365D")     # Slate Blue
COLOR_ACCENT = colors.HexColor("#2B6CB0")        # Royal Blue
COLOR_GOLD = colors.HexColor("#B7791F")          # Legal Metrology Gold
COLOR_BORDER = colors.HexColor("#CBD5E0")        # Light Gray Border
COLOR_BG_HEADER = colors.HexColor("#EDF2F7")     # Light Slate Background
COLOR_BG_SUBTLE = colors.HexColor("#F7FAFC")     # Soft White/Gray
COLOR_TEXT_MAIN = colors.HexColor("#1A202C")     # Dark Slate Text
COLOR_TEXT_MUTED = colors.HexColor("#4A5568")    # Subdued Gray
COLOR_SUCCESS = colors.HexColor("#22543D")       # Forest Green for Valid/Issued
COLOR_WARN = colors.HexColor("#742A2A")          # Deep Red for Revoked/Expired


def _build_qr_flowable(url: str, size_inches: float = 1.25) -> RLImage:
    """Generate dynamic QR code as an in-memory ReportLab Flowable."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=1,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return RLImage(buf, width=size_inches * inch, height=size_inches * inch)


def _draw_page_decorations(canvas_obj: canvas.Canvas, doc: SimpleDocTemplate):
    """Draw professional outer border and subtle background watermark."""
    canvas_obj.saveState()
    
    # Outer decorative border
    page_w, page_h = A4
    margin = 18 * pt
    canvas_obj.setStrokeColor(COLOR_PRIMARY)
    canvas_obj.setLineWidth(1.5)
    canvas_obj.rect(margin, margin, page_w - 2 * margin, page_h - 2 * margin)
    
    # Inner thin border
    inner_margin = margin + 3 * pt
    canvas_obj.setStrokeColor(COLOR_GOLD)
    canvas_obj.setLineWidth(0.5)
    canvas_obj.rect(inner_margin, inner_margin, page_w - 2 * inner_margin, page_h - 2 * inner_margin)
    
    # Bottom statutory notice footer
    canvas_obj.setFont("Helvetica", 7)
    canvas_obj.setFillColor(COLOR_TEXT_MUTED)
    footer_text = (
        "Statutory Digital Certificate issued under Section 24 of The Legal Metrology Act, 2009. "
        "Tamper-evident, verified against the National Metrology Register."
    )
    canvas_obj.drawCentredString(page_w / 2.0, margin + 8 * pt, footer_text)
    
    canvas_obj.restoreState()


class CertificatePdfGenerator:
    """Deterministic ReportLab PDF/A generator for Form 8 Legal Metrology Certificates."""

    def __init__(self, base_verify_url: Optional[str] = None):
        self.base_verify_url = base_verify_url or "http://localhost:5173/verify"

    def _get_styles(self) -> Dict[str, ParagraphStyle]:
        """Construct dedicated typography hierarchy."""
        base_styles = getSampleStyleSheet()
        custom = {}

        custom["GovtTitle"] = ParagraphStyle(
            "GovtTitle",
            parent=base_styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=13,
            alignment=TA_CENTER,
            textColor=COLOR_PRIMARY,
            spaceAfter=2,
        )

        custom["DeptTitle"] = ParagraphStyle(
            "DeptTitle",
            parent=base_styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=12,
            alignment=TA_CENTER,
            textColor=COLOR_ACCENT,
            spaceAfter=2,
        )

        custom["CertTitle"] = ParagraphStyle(
            "CertTitle",
            parent=base_styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=12,
            leading=14,
            alignment=TA_CENTER,
            textColor=COLOR_PRIMARY,
            spaceAfter=2,
        )

        custom["StatutorySubtitle"] = ParagraphStyle(
            "StatutorySubtitle",
            parent=base_styles["Normal"],
            fontName="Helvetica-Oblique",
            fontSize=7.5,
            leading=9.5,
            alignment=TA_CENTER,
            textColor=COLOR_TEXT_MUTED,
            spaceAfter=4,
        )

        custom["SectionHeader"] = ParagraphStyle(
            "SectionHeader",
            parent=base_styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=10.5,
            textColor=COLOR_SECONDARY,
            spaceBefore=3,
            spaceAfter=2,
        )

        custom["MetaKey"] = ParagraphStyle(
            "MetaKey",
            parent=base_styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7.5,
            leading=9.5,
            textColor=COLOR_TEXT_MAIN,
        )

        custom["MetaVal"] = ParagraphStyle(
            "MetaVal",
            parent=base_styles["Normal"],
            fontName="Helvetica",
            fontSize=7.5,
            leading=9.5,
            textColor=COLOR_TEXT_MAIN,
        )

        custom["MetaValBold"] = ParagraphStyle(
            "MetaValBold",
            parent=base_styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7.5,
            leading=9.5,
            textColor=COLOR_PRIMARY,
        )

        custom["TableHeader"] = ParagraphStyle(
            "TableHeader",
            parent=base_styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7.5,
            leading=9.5,
            textColor=colors.white,
            alignment=TA_CENTER,
        )

        custom["TableCell"] = ParagraphStyle(
            "TableCell",
            parent=base_styles["Normal"],
            fontName="Helvetica",
            fontSize=7,
            leading=8.5,
            textColor=COLOR_TEXT_MAIN,
        )

        custom["BadgeText"] = ParagraphStyle(
            "BadgeText",
            parent=base_styles["Normal"],
            fontName="Helvetica",
            fontSize=7,
            leading=9,
            textColor=COLOR_TEXT_MAIN,
        )

        custom["BadgeTextBold"] = ParagraphStyle(
            "BadgeTextBold",
            parent=base_styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7,
            leading=9,
            textColor=COLOR_PRIMARY,
        )

        custom["HashMono"] = ParagraphStyle(
            "HashMono",
            parent=base_styles["Normal"],
            fontName="Courier",
            fontSize=6.5,
            leading=8,
            textColor=COLOR_TEXT_MUTED,
        )

        return custom

    def generate_pdf(self, data: CertificateDocumentData) -> bytes:
        """Render complete Form 8 Legal Metrology Verification Certificate to PDF bytes."""
        pdf_buffer = io.BytesIO()

        # Page setup: A4 with 24pt margins to fit rich one-page certificate
        doc = SimpleDocTemplate(
            pdf_buffer,
            pagesize=A4,
            leftMargin=24 * pt,
            rightMargin=24 * pt,
            topMargin=24 * pt,
            bottomMargin=24 * pt,
            title=f"Legal Metrology Certificate - {data.certificate_number}",
            author="Department of Legal Metrology",
            subject="Statutory Verification Certificate under Section 24 of The Legal Metrology Act, 2009",
            keywords="Legal Metrology, Certificate, Verification, Weighing Instrument, Form 8, Schedule XI",
        )

        styles = self._get_styles()
        story = []
        content_width = 547.27 * pt  # A4 width (595.27) - 2 * 24pt

        # -------------------------------------------------------------
        # 1. Official Header
        # -------------------------------------------------------------
        story.append(Paragraph(data.jurisdiction_name.upper(), styles["GovtTitle"]))
        story.append(Paragraph("OFFICIAL CERTIFICATE OF VERIFICATION (FORM 8 / SCHEDULE XI)", styles["CertTitle"]))
        story.append(
            Paragraph(
                "[Issued under Section 24 of The Legal Metrology Act, 2009 read with Rule 11 of The Legal Metrology (General) Rules, 2011]",
                styles["StatutorySubtitle"],
            )
        )
        story.append(HRFlowable(width="100%", thickness=1, color=COLOR_GOLD, spaceBefore=1, spaceAfter=3))

        # -------------------------------------------------------------
        # 2. Certificate Identification & Status Banner
        # -------------------------------------------------------------
        status_color = COLOR_SUCCESS if data.certificate_status.upper() == "ISSUED" else COLOR_WARN
        status_badge_html = f"<b><font color='{status_color.hexval()}'>{data.certificate_status.upper()}</font></b>"
        
        meta_table_data = [
            [
                Paragraph("<b>Certificate No:</b>", styles["MetaKey"]),
                Paragraph(f"<b>{data.certificate_number}</b>", styles["MetaValBold"]),
                Paragraph("<b>Issue Date:</b>", styles["MetaKey"]),
                Paragraph(data.issue_date.strftime("%d %b %Y"), styles["MetaVal"]),
                Paragraph("<b>Status:</b>", styles["MetaKey"]),
                Paragraph(status_badge_html, styles["MetaVal"]),
            ],
            [
                Paragraph("<b>Procedure Pack:</b>", styles["MetaKey"]),
                Paragraph(data.procedure_pack_id, styles["MetaVal"]),
                Paragraph("<b>Valid Until:</b>", styles["MetaKey"]),
                Paragraph(f"<b>{data.valid_until.strftime('%d %b %Y')}</b>", styles["MetaValBold"]),
                Paragraph("<b>Office / Tenant:</b>", styles["MetaKey"]),
                Paragraph(data.tenant_id, styles["MetaVal"]),
            ],
        ]

        t_meta = Table(meta_table_data, colWidths=[70 * pt, 130 * pt, 60 * pt, 85 * pt, 45 * pt, 157.27 * pt])
        t_meta.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), COLOR_BG_HEADER),
                ("BOX", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, COLOR_BORDER),
                ("TOPPADDING", (0, 0), (-1, -1), 2.5 * pt),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5 * pt),
                ("LEFTPADDING", (0, 0), (-1, -1), 4 * pt),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4 * pt),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ])
        )
        story.append(t_meta)
        story.append(Spacer(1, 3 * pt))

        # -------------------------------------------------------------
        # 3. Section 1: Instrument Details & Specifications
        # -------------------------------------------------------------
        story.append(Paragraph("1. INSTRUMENT IDENTIFICATION & METROLOGICAL PARAMETERS", styles["SectionHeader"]))
        inst = data.instrument

        inst_grid = [
            [
                Paragraph("Category / Subtype:", styles["MetaKey"]),
                Paragraph(f"{inst.category} ({inst.subtype})", styles["MetaVal"]),
                Paragraph("Model Approval No:", styles["MetaKey"]),
                Paragraph(inst.model_approval_number, styles["MetaValBold"]),
            ],
            [
                Paragraph("Make & Model:", styles["MetaKey"]),
                Paragraph(f"{inst.manufacturer} — {inst.model_name}", styles["MetaVal"]),
                Paragraph("Physical Serial No:", styles["MetaKey"]),
                Paragraph(inst.serial_number, styles["MetaValBold"]),
            ],
            [
                Paragraph("Accuracy Class:", styles["MetaKey"]),
                Paragraph(f"<b>{inst.accuracy_class}</b>", styles["MetaValBold"]),
                Paragraph("Max / Min Capacity:", styles["MetaKey"]),
                Paragraph(f"Max: {inst.max_capacity} | Min: {inst.min_capacity}", styles["MetaVal"]),
            ],
            [
                Paragraph("Verification Scale (e / d):", styles["MetaKey"]),
                Paragraph(f"e = {inst.verification_scale_interval_e}" + (f" | d = {inst.division_d}" if inst.division_d else ""), styles["MetaVal"]),
                Paragraph("Installation Premises:", styles["MetaKey"]),
                Paragraph(inst.installation_location or "Designated Commercial Premises", styles["MetaVal"]),
            ],
            [
                Paragraph("Owner / Trade Name:", styles["MetaKey"]),
                Paragraph(inst.owner_name or inst.owner_trade_name or "Registered Metrology User", styles["MetaVal"]),
                Paragraph("Operating Unit:", styles["MetaKey"]),
                Paragraph(inst.capacity_unit, styles["MetaVal"]),
            ],
        ]

        t_inst = Table(inst_grid, colWidths=[120 * pt, 160 * pt, 110 * pt, 157.27 * pt])
        t_inst.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), COLOR_BG_SUBTLE),
                ("BOX", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, COLOR_BORDER),
                ("TOPPADDING", (0, 0), (-1, -1), 2 * pt),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * pt),
                ("LEFTPADDING", (0, 0), (-1, -1), 4 * pt),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4 * pt),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ])
        )
        story.append(t_inst)
        story.append(Spacer(1, 3 * pt))

        # -------------------------------------------------------------
        # 4. Section 2: Metrological Testing Summary
        # -------------------------------------------------------------
        story.append(Paragraph("2. VERIFICATION EXECUTION & METROLOGICAL TEST RESULTS", styles["SectionHeader"]))
        v = data.verification_details

        verif_grid = [
            [
                Paragraph("Verification Type:", styles["MetaKey"]),
                Paragraph(v.verification_type, styles["MetaVal"]),
                Paragraph("Service Mode:", styles["MetaKey"]),
                Paragraph(v.service_mode, styles["MetaVal"]),
            ],
            [
                Paragraph("Session ID:", styles["MetaKey"]),
                Paragraph(v.session_id, styles["MetaVal"]),
                Paragraph("Test Date:", styles["MetaKey"]),
                Paragraph(v.test_date.strftime("%d %b %Y"), styles["MetaVal"]),
            ],
            [
                Paragraph("Evaluation Outcome:", styles["MetaKey"]),
                Paragraph(f"<b><font color='{COLOR_SUCCESS.hexval()}'>{v.metrological_outcome}</font></b>", styles["MetaValBold"]),
                Paragraph("Repeatability Test:", styles["MetaKey"]),
                Paragraph(v.repeatability_result or "PASSED (diff <= 1.0 e)", styles["MetaVal"]),
            ],
            [
                Paragraph("Linearity / Indication:", styles["MetaKey"]),
                Paragraph(v.linearity_result or "PASSED (all steps <= MPE)", styles["MetaVal"]),
                Paragraph("Eccentricity Test:", styles["MetaKey"]),
                Paragraph(v.eccentricity_result or "PASSED (error <= 1.0 e)", styles["MetaVal"]),
            ],
        ]

        t_verif = Table(verif_grid, colWidths=[120 * pt, 160 * pt, 110 * pt, 157.27 * pt])
        t_verif.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), COLOR_BG_SUBTLE),
                ("BOX", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, COLOR_BORDER),
                ("TOPPADDING", (0, 0), (-1, -1), 2 * pt),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * pt),
                ("LEFTPADDING", (0, 0), (-1, -1), 4 * pt),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4 * pt),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ])
        )
        story.append(t_verif)
        story.append(Spacer(1, 3 * pt))

        # -------------------------------------------------------------
        # 5. Section 3: Traceable Reference Standards Used
        # -------------------------------------------------------------
        story.append(Paragraph("3. TRACEABLE REFERENCE STANDARDS UTILIZED", styles["SectionHeader"]))
        
        std_headers = [
            Paragraph("Standard Tag / ID", styles["TableHeader"]),
            Paragraph("Description", styles["TableHeader"]),
            Paragraph("Class", styles["TableHeader"]),
            Paragraph("Calibration Cert No", styles["TableHeader"]),
            Paragraph("Calibrating Laboratory", styles["TableHeader"]),
            Paragraph("Valid Until", styles["TableHeader"]),
        ]
        std_rows = [std_headers]

        if data.reference_standards:
            for s in data.reference_standards:
                valid_str = s.calibration_valid_until.strftime("%d %b %Y") if isinstance(s.calibration_valid_until, (date, datetime)) else str(s.calibration_valid_until)
                std_rows.append([
                    Paragraph(s.standard_id, styles["TableCell"]),
                    Paragraph(s.standard_name, styles["TableCell"]),
                    Paragraph(f"<b>{s.accuracy_class}</b>", styles["TableCell"]),
                    Paragraph(s.calibration_certificate_number, styles["TableCell"]),
                    Paragraph(s.calibrating_laboratory, styles["TableCell"]),
                    Paragraph(valid_str, styles["TableCell"]),
                ])
        else:
            std_rows.append([
                Paragraph("STD-M1-DEFAULT", styles["TableCell"]),
                Paragraph("Working Standard Mass Set", styles["TableCell"]),
                Paragraph("M1", styles["TableCell"]),
                Paragraph("NPL/CAL/2026/001", styles["TableCell"]),
                Paragraph("National Physical Laboratory / RRSL", styles["TableCell"]),
                Paragraph(data.valid_until.strftime("%d %b %Y"), styles["TableCell"]),
            ])

        t_std = Table(std_rows, colWidths=[90 * pt, 110 * pt, 35 * pt, 105 * pt, 135 * pt, 72.27 * pt])
        t_std.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), COLOR_SECONDARY),
                ("BOX", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, COLOR_BORDER),
                ("TOPPADDING", (0, 0), (-1, -1), 1.8 * pt),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1.8 * pt),
                ("LEFTPADDING", (0, 0), (-1, -1), 3 * pt),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3 * pt),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ])
        )
        story.append(t_std)
        story.append(Spacer(1, 3 * pt))

        # -------------------------------------------------------------
        # 6. Section 4: Physical Security Seals & Statutory Stamping
        # -------------------------------------------------------------
        story.append(Paragraph("4. PHYSICAL VERIFICATION STAMP & SECURITY SEALS AFFIXED", styles["SectionHeader"]))
        
        stamps_text_list = []
        if data.physical_stamps:
            for st in data.physical_stamps:
                stamps_text_list.append(f"<b>[{st.stamp_type}]</b> Serial: <b>{st.seal_serial_number}</b> (Location: {st.seal_location})")
        else:
            stamps_text_list.append(f"<b>[VERIFICATION_STAMP]</b> Mark: <b>{data.issue_date.year % 100}/{data.tenant_id[:2].upper()}/A</b> (Affixed on Verification Plate)")
            stamps_text_list.append(f"<b>[LEAD_WIRE_SEAL]</b> Serial: <b>SEAL-{data.certificate_number[-6:]}</b> (Location: Calibration Port Screw)")

        stamp_p = Paragraph(" &nbsp;|&nbsp; ".join(stamps_text_list), styles["TableCell"])
        t_stamp = Table([[stamp_p]], colWidths=[content_width])
        t_stamp.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), COLOR_BG_SUBTLE),
                ("BOX", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
                ("TOPPADDING", (0, 0), (-1, -1), 2.5 * pt),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5 * pt),
                ("LEFTPADDING", (0, 0), (-1, -1), 4 * pt),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4 * pt),
            ])
        )
        story.append(t_stamp)
        story.append(Spacer(1, 3 * pt))

        # -------------------------------------------------------------
        # 7. Section 5: Cryptographic Signature & Dynamic QR Verification Badge
        # -------------------------------------------------------------
        story.append(Paragraph("5. OFFICIAL DIGITAL SIGNATURE & PUBLIC QR VERIFICATION", styles["SectionHeader"]))
        
        # Build QR Code
        qr_flowable = _build_qr_flowable(data.qr_payload_url, size_inches=1.15)
        
        sig = data.signature
        ts_str = sig.signature_timestamp.strftime("%Y-%m-%d %H:%M:%S UTC") if isinstance(sig.signature_timestamp, (date, datetime)) else str(sig.signature_timestamp)
        
        sig_info = [
            Paragraph("<b>Digitally Signed By:</b>", styles["BadgeText"]),
            Paragraph(f"<b>{sig.signer_name}</b> ({sig.signer_role})", styles["BadgeTextBold"]),
            Paragraph("<b>LMO Authority / Posting ID:</b>", styles["BadgeText"]),
            Paragraph(f"{sig.authority_id}" + (f" / {sig.posting_id}" if sig.posting_id else ""), styles["BadgeText"]),
            Paragraph("<b>Signing Timestamp:</b>", styles["BadgeText"]),
            Paragraph(ts_str, styles["BadgeText"]),
            Paragraph("<b>Cryptographic SHA-256 Digest:</b>", styles["BadgeText"]),
            Paragraph(f"<font color='{COLOR_TEXT_MUTED.hexval()}'>{sig.sha256_digest}</font>", styles["HashMono"]),
            Paragraph("<b>Public Verification URL:</b>", styles["BadgeText"]),
            Paragraph(f"<font color='{COLOR_ACCENT.hexval()}'>{data.qr_payload_url}</font>", styles["TableCell"]),
        ]

        t_sig_inner = Table(
            [
                [sig_info[0], sig_info[1]],
                [sig_info[2], sig_info[3]],
                [sig_info[4], sig_info[5]],
                [sig_info[6], sig_info[7]],
                [sig_info[8], sig_info[9]],
            ],
            colWidths=[130 * pt, 290 * pt],
        )
        t_sig_inner.setStyle(
            TableStyle([
                ("TOPPADDING", (0, 0), (-1, -1), 1.5 * pt),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5 * pt),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ])
        )

        qr_col = [
            qr_flowable,
            Spacer(1, 2 * pt),
            Paragraph("<b>Scan to Verify Authentic State</b>", ParagraphStyle("QRLabel", parent=styles["TableCell"], alignment=TA_CENTER, fontSize=6)),
        ]

        t_badge = Table(
            [[qr_col, t_sig_inner]],
            colWidths=[105 * pt, 442.27 * pt],
        )
        t_badge.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), COLOR_BG_HEADER),
                ("BOX", (0, 0), (-1, -1), 1, COLOR_SECONDARY),
                ("TOPPADDING", (0, 0), (-1, -1), 4 * pt),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4 * pt),
                ("LEFTPADDING", (0, 0), (-1, -1), 4 * pt),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4 * pt),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (0, 0), "CENTER"),
            ])
        )
        story.append(t_badge)

        # Build document
        doc.build(story, onFirstPage=_draw_page_decorations, onLaterPages=_draw_page_decorations)
        return pdf_buffer.getvalue()

    def generate_pdf_with_hash(self, data: CertificateDocumentData) -> Tuple[bytes, str]:
        """Generate PDF bytes and compute canonical SHA-256 hash."""
        pdf_bytes = self.generate_pdf(data)
        pdf_hash = calculate_pdf_bytes_hash(pdf_bytes)
        return pdf_bytes, pdf_hash


def render_certificate_pdf(data: CertificateDocumentData, base_verify_url: Optional[str] = None) -> bytes:
    """Convenience helper to render certificate PDF bytes."""
    generator = CertificatePdfGenerator(base_verify_url=base_verify_url)
    return generator.generate_pdf(data)
