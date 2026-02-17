"""
OCR Engine Module using PaddleOCR
Supports multi-pass (normal, high contrast, denoised) and merges results.
"""
from paddleocr import PaddleOCR
import cv2
import numpy as np
from typing import List, Dict, Any

def run_ocr(image: np.ndarray, ocr: PaddleOCR) -> List[Dict[str, Any]]:
    """
    Runs OCR and returns list of {text, box, confidence}.
    """
    result = ocr.ocr(image, cls=True)
    out = []
    for line in result[0]:
        text = line[1][0]
        conf = float(line[1][1])
        box = line[0]
        out.append({"text": text, "box": box, "confidence": conf})
    return out

def merge_ocr_results(*results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Merge OCR results by box overlap, keep highest confidence.
    """
    merged = {}
    for res in results:
        for item in res:
            key = tuple(map(lambda x: int(x), np.array(item["box"]).flatten()))
            if key not in merged or item["confidence"] > merged[key]["confidence"]:
                merged[key] = item
    return list(merged.values())

def ocr_engine(image_path: str) -> List[Dict[str, Any]]:
    """
    Runs PaddleOCR on image with multi-pass and merges results.
    Args:
        image_path: Path to image file.
    Returns:
        List of {text, box, confidence}
    """
    ocr = PaddleOCR(use_angle_cls=True, lang='en')
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError("File not readable")

    # Pass 1: normal
    res1 = run_ocr(img, ocr)
    # Pass 2: high contrast
    high_contrast = cv2.convertScaleAbs(img, alpha=1.5, beta=0)
    res2 = run_ocr(high_contrast, ocr)
    # Pass 3: denoised
    denoised = cv2.fastNlMeansDenoisingColored(img, None, 10, 10, 7, 21)
    res3 = run_ocr(denoised, ocr)

    merged = merge_ocr_results(res1, res2, res3)
    return merged

if __name__ == "__main__":
    # Example usage
    out = ocr_engine("./sample_invoice.jpg")
    for item in out:
        print(item)
