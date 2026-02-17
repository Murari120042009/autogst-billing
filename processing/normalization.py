"""
Image Normalization Module
Performs rotation, deskew, threshold, blur, contrast, and recovery filters.
"""
import cv2
import numpy as np
from typing import Any

def normalize_image(image_path: str, recovery_mode: bool = False) -> Any:
    """
    Normalize image for OCR: rotate, deskew, threshold, blur, contrast.
    If recovery_mode, apply dilation and sharpening.
    Args:
        image_path: Path to image file.
        recovery_mode: Whether to apply recovery filters.
    Returns:
        Processed image array (numpy ndarray)
    """
    img = cv2.imread(image_path, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("File not readable")

    # Auto-rotate (basic: if height > width, rotate 90)
    h, w = img.shape[:2]
    if h > w:
        img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)

    # Deskew (simple: use moments)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    coords = np.column_stack(np.where(gray > 0))
    angle = 0.0
    if coords.shape[0] > 0:
        rect = cv2.minAreaRect(coords)
        angle = rect[-1]
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle
        (h, w) = img.shape[:2]
        M = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
        img = cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Adaptive threshold
    thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                   cv2.THRESH_BINARY, 31, 10)
    # Median blur
    blur = cv2.medianBlur(thresh, 3)
    # Contrast enhancement
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    contrast = clahe.apply(blur)

    result = contrast

    if recovery_mode:
        # Dilation
        kernel = np.ones((2,2), np.uint8)
        dilated = cv2.dilate(result, kernel, iterations=1)
        # Sharpening
        sharpen_kernel = np.array([[0,-1,0], [-1,5,-1], [0,-1,0]])
        sharpened = cv2.filter2D(dilated, -1, sharpen_kernel)
        result = sharpened

    return result

if __name__ == "__main__":
    # Example usage
    out = normalize_image("./sample_invoice.jpg", recovery_mode=True)
    cv2.imwrite("./normalized_invoice.jpg", out)
