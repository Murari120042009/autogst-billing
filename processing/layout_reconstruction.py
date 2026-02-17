"""
Layout Reconstruction Module
Sorts OCR output, clusters rows, separates header/table/footer.
"""
from typing import List, Dict, Any
import numpy as np

def layout_reconstruction(ocr_output: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Reconstructs layout from OCR output.
    Args:
        ocr_output: List of {text, box, confidence}
    Returns:
        dict: {header_text, table_rows, footer_text}
    """
    # Sort by Y (top of box)
    ocr_sorted = sorted(ocr_output, key=lambda x: min([pt[1] for pt in x["box"]]))
    rows = []
    current_row = []
    last_y = None
    for item in ocr_sorted:
        y = min([pt[1] for pt in item["box"]])
        if last_y is None or abs(y - last_y) < 30:
            current_row.append(item)
        else:
            rows.append(current_row)
            current_row = [item]
        last_y = y
    if current_row:
        rows.append(current_row)

    # Heuristic: header = first 2 rows, footer = last 2 rows, table = middle
    header_text = " ".join([cell["text"] for row in rows[:2] for cell in row])
    footer_text = " ".join([cell["text"] for row in rows[-2:] for cell in row])
    table_rows = [[cell["text"] for cell in row] for row in rows[2:-2]] if len(rows) > 4 else []

    return {
        "header_text": header_text,
        "table_rows": table_rows,
        "footer_text": footer_text
    }

if __name__ == "__main__":
    # Example usage
    sample_ocr = [
        {"text": "GSTIN: 22AAAAA0000A1Z5", "box": [[10,10],[100,10],[100,30],[10,30]], "confidence": 0.99},
        {"text": "Invoice No: 123", "box": [[10,40],[100,40],[100,60],[10,60]], "confidence": 0.98},
        {"text": "Item", "box": [[10,80],[100,80],[100,100],[10,100]], "confidence": 0.97},
        {"text": "Total: 1000", "box": [[10,400],[100,400],[100,420],[10,420]], "confidence": 0.97},
    ]
    out = layout_reconstruction(sample_ocr)
    print(out)
