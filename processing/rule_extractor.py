"""
Rule-Based Extractor Module
Extracts GSTIN, invoice number, date, phone, HSN, tax using regex.
"""
import re
from typing import Dict, Any

def rule_based_extract(text: str) -> Dict[str, Any]:
    """
    Extracts invoice fields using regex.
    Args:
        text: OCR text (joined)
    Returns:
        dict: Partial structured invoice
    """
    patterns = {
        "gstin": r"[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}",
        "invoice_number": r"(?:Invoice\s*No\.?|Inv\.?\s*No\.?|Bill\s*No\.?)[^\dA-Z]*([A-Z0-9\-/]+)",
        "date": r"\b(\d{2}[/-]\d{2}[/-]\d{4})\b",
        "phone": r"\b[6-9][0-9]{9}\b",
        "hsn": r"\b[0-9]{4,8}\b",
        "tax_percent": r"(\d{1,2}\.\d{1,2}|\d{1,2})%"
    }
    result = {}
    for key, pat in patterns.items():
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            result[key] = m.group(1) if m.lastindex else m.group(0)
    return result

if __name__ == "__main__":
    # Example usage
    sample = "GSTIN: 22AAAAA0000A1Z5\nInvoice No: INV-1234\nDate: 12/02/2026\nPhone: 9876543210\nHSN: 123456\nCGST 9% SGST 9%"
    out = rule_based_extract(sample)
    print(out)
