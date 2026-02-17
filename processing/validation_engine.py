"""
Validation Engine Module
Validates GSTIN, math, and GST rules. Uses Decimal for math.
"""
import re
from decimal import Decimal, InvalidOperation
from typing import Dict, Any, List

def validate_gstin(gstin: str) -> bool:
    """Validates GSTIN format and checksum."""
    if not re.match(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$", gstin):
        return False
    # Checksum validation (mod 36)
    factor = [1,2]*7
    charset = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    s = 0
    for i, c in enumerate(gstin[:-1]):
        s += factor[i%14] * charset.index(c)
    check = charset[s%36]
    return gstin[-1] == check

def validate_invoice(invoice: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validates invoice fields and math.
    Args:
        invoice: Structured invoice dict
    Returns:
        dict: {is_valid, field_errors, row_errors, confidence_score}
    """
    field_errors = {}
    row_errors = []
    score = Decimal('1.0')
    # GSTIN
    gstin = invoice.get('gstin')
    if gstin and not validate_gstin(gstin):
        field_errors['gstin'] = 'Invalid GSTIN'
        score -= Decimal('0.2')
    # Math checks
    lines = invoice.get('lines', [])
    taxable_sum = Decimal('0')
    total_sum = Decimal('0')
    for i, row in enumerate(lines):
        try:
            qty = Decimal(str(row.get('qty', '0')))
            rate = Decimal(str(row.get('rate', '0')))
            total = Decimal(str(row.get('total', '0')))
            if qty * rate != total:
                row_errors.append({'row': i, 'error': 'qty x rate != total'})
                score -= Decimal('0.05')
            taxable_sum += total
        except InvalidOperation:
            row_errors.append({'row': i, 'error': 'Invalid number'})
            score -= Decimal('0.05')
    # Invoice totals
    try:
        taxable = Decimal(str(invoice.get('taxable', '0')))
        tax = Decimal(str(invoice.get('tax', '0')))
        grand_total = Decimal(str(invoice.get('grand_total', '0')))
        if taxable_sum != taxable:
            field_errors['taxable'] = 'Sum of line totals != taxable'
            score -= Decimal('0.1')
        if taxable + tax != grand_total:
            field_errors['grand_total'] = 'taxable + tax != grand_total'
            score -= Decimal('0.1')
    except InvalidOperation:
        field_errors['totals'] = 'Invalid number in totals'
        score -= Decimal('0.1')
    # GST rules
    cgst = invoice.get('cgst')
    sgst = invoice.get('sgst')
    igst = invoice.get('igst')
    if cgst and not sgst:
        field_errors['sgst'] = 'CGST present, SGST missing'
        score -= Decimal('0.1')
    if igst and (cgst or sgst):
        field_errors['igst'] = 'IGST with CGST/SGST not allowed'
        score -= Decimal('0.1')
    return {
        'is_valid': not field_errors and not row_errors,
        'field_errors': field_errors,
        'row_errors': row_errors,
        'confidence_score': float(max(score, Decimal('0')))
    }

if __name__ == "__main__":
    # Example usage
    sample = {
        'gstin': '22AAAAA0000A1Z5',
        'lines': [
            {'qty': 2, 'rate': 500, 'total': 1000},
            {'qty': 1, 'rate': 500, 'total': 500}
        ],
        'taxable': 1500,
        'tax': 270,
        'grand_total': 1770,
        'cgst': 135,
        'sgst': 135
    }
    out = validate_invoice(sample)
    print(out)
