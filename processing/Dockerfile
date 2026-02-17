# 🐍 PYTHON OCR SERVICE DOCKERFILE

FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
# libgomp1: for OpenMP (PaddleOCR/PyTorch)
# libgl1-mesa-glx: for OpenCV
RUN apt-get update && apt-get install -y \
    libgomp1 \
    libgl1-mesa-glx \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Optimize Python
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download OCR models during build to warm cache (if possible/needed)
# This prevents downloading on first run in production
RUN python -c "from paddleocr import PaddleOCR; PaddleOCR(use_angle_cls=True, lang='en')"

COPY . .

# Create non-root user
RUN useradd -m appuser && chown -R appuser /app
USER appuser

# Healthcheck
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "ocr_service:app", "--host", "0.0.0.0", "--port", "8000"]
