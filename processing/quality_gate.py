"""
Image Quality Gate Module
Checks image sharpness, brightness, and size using OpenCV.
"""
import cv2
import numpy as np
from typing import Dict


def check_image_quality(image_path: str) -> Dict[str, str]:
    """
    Checks image for sharpness, brightness, and minimum size.
    Args:
        image_path: Path to image file.
    Returns:
        dict: {status: "passed"|"rejected", reason: str}
    """
    img = cv2.imread(image_path, cv2.IMREAD_COLOR)
    if img is None:
        return {"status": "rejected", "reason": "File not readable"}

    h, w = img.shape[:2]
    if h < 1000 or w < 1000:
        return {"status": "rejected", "reason": "Image too small (<1000px)"}

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    lap_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    if lap_var < 100:
        return {"status": "rejected", "reason": "Image too blurry (variance < 100)"}

    brightness = float(np.mean(gray))
    if brightness < 80:
        return {"status": "rejected", "reason": "Image too dark (brightness < 80)"}
    if brightness > 200:
        return {"status": "rejected", "reason": "Image too bright (brightness > 200)"}

    return {"status": "passed", "reason": "OK"}


if __name__ == "__main__":
    # Example usage
    result = check_image_quality("./sample_invoice.jpg")
    print(result)
