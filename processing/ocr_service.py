"""
OCR Microservice for AutoGST Billing
Exposes a POST endpoint to process images and PDFs using PaddleOCR.
"""
import uvicorn
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends
from fastapi.responses import JSONResponse
import logging
from paddleocr import PaddleOCR
import cv2
import numpy as np
import fitz  # PyMuPDF
from io import BytesIO
from typing import List, Dict, Any
import gc

# 1️⃣ LOGGING CONFIG
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ocr-service")

# 2️⃣ LIMITS & CONSTANTS
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_PDF_PAGES = 5                 # Prevents long-running blocking jobs
MAX_IMAGE_DIMENSION = 2000        # Downscale if larger (Memory safety)

# 3️⃣ SINGLETON OCR INSTANCE (Global Scope)
try:
    logger.info("Initializing PaddleOCR (Heavy Model Loading)...")
    # Initialize once at startup to avoid reloading per request
    ocr_engine = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
    logger.info("PaddleOCR Initialized Successfully")
except Exception as e:
    logger.critical(f"Failed to initialize PaddleOCR: {e}")
    raise RuntimeError("OCR Engine could not start")

app = FastAPI(title="AutoGST OCR Service")

def resize_image_if_large(img: np.ndarray) -> np.ndarray:
    """
    Downscale image if dimensions exceed MAX_IMAGE_DIMENSION.
    Preserves aspect ratio. Reduces OCR memory usage.
    """
    height, width = img.shape[:2]
    if max(height, width) > MAX_IMAGE_DIMENSION:
        scale = MAX_IMAGE_DIMENSION / max(height, width)
        new_width = int(width * scale)
        new_height = int(height * scale)
        logger.info(f"Downscaling image from {width}x{height} to {new_width}x{new_height}")
        return cv2.resize(img, (new_width, new_height), interpolation=cv2.INTER_AREA)
    return img

def process_image(image_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Process a single image byte stream through PaddleOCR.
    """
    try:
        # Decode image from bytes
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise ValueError("Could not decode image")

        # 🛡️ Memory Protection: Resize huge images
        img = resize_image_if_large(img)

        # Run OCR
        result = ocr_engine.ocr(img, cls=True)
        
        output = []
        if result and result[0]:
            for line in result[0]:
                text = line[1][0]
                confidence = float(line[1][1])
                box = line[0] # [[x1,y1], [x2,y2], ...]
                output.append({
                    "text": text,
                    "confidence": round(confidence, 4),
                    "box": box
                })
        return output
    except Exception as e:
        logger.error(f"Image processing error: {e}")
        raise e

def process_pdf(pdf_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Process a PDF byte stream by converting pages to images using PyMuPDF.
    """
    pdf_results = []
    doc = None
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        total_pages = len(doc)
        logger.info(f"Processing PDF with {total_pages} pages")

        if total_pages > MAX_PDF_PAGES:
            raise ValueError(f"PDF exceeds max allowed pages ({MAX_PDF_PAGES})")

        for i in range(total_pages):
            page = doc.load_page(i)
            # Render page to image (pixmap)
            # Use lower DPI if you hit memory issues (e.g. 150-200)
            pix = page.get_pixmap(dpi=300) 
            img_bytes = pix.tobytes("png")
            
            # Process the image
            page_data = process_image(img_bytes)
            
            pdf_results.append({
                "page": i + 1,
                "content": page_data
            })
            
            # Explicit cleanup per page
            del pix
            del img_bytes
            gc.collect()

        return pdf_results
    except Exception as e:
        logger.error(f"PDF processing error: {e}")
        raise e
    finally:
        if doc:
            doc.close()

@app.post("/ocr")
async def extract_text(
    file: UploadFile = File(...),
    business_id: str = None, # Optional metadata
    job_id: str = None       # Optional metadata
):
    """
    Extract text from uploaded image or PDF.
    """
    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded")
    
    logger.info(f"Processing Job: {job_id} | Business: {business_id} | File: {file.filename}")

    try:
        # 🛡️ 1. STREAMING SIZE CHECK
        # Read in chunks to avoid blowing RAM on huge bombs
        content = bytearray()
        CHUNK_SIZE = 1024 * 1024 # 1MB
        
        while True:
            chunk = await file.read(CHUNK_SIZE)
            if not chunk:
                break
            content.extend(chunk)
            if len(content) > MAX_FILE_SIZE:
                 raise HTTPException(status_code=413, detail=f"File exceeds size limit of {MAX_FILE_SIZE/1024/1024}MB")

        content = bytes(content)
        file_type = file.content_type
        
        response_data = {}

        if file_type == "application/pdf" or file.filename.lower().endswith(".pdf"):
            logger.info("Detected PDF format")
            extracted = process_pdf(content)
            response_data = {"type": "pdf", "pages": extracted}
        elif file_type.startswith("image/") or file.filename.lower().endswith((".jpg", ".jpeg", ".png")):
            logger.info("Detected Image format")
            extracted = process_image(content)
            response_data = {"type": "image", "content": extracted}
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type. Use PDF or Image.")

        return JSONResponse(content={
            "status": "success",
            "job_id": job_id,
            "business_id": business_id,
            "data": response_data
        })

    except HTTPException as he:
        # Pass through HTTP Exceptions (like 413)
        raise he
    except Exception as e:
        logger.error(f"OCR Extraction Failed: {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(e)}
        )
    finally:
        # Force garbage collection after heavy request
        gc.collect()

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ocr-engine"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
