# Dockerfile for backend (Crew + MCP + FastAPI later)
FROM python:3.11-slim

# Avoid Python buffering
ENV PYTHONUNBUFFERED=1

# Set work directory
WORKDIR /app

# System deps for psycopg2, Tesseract, and PDF tools
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-deu \
    poppler-utils \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY requirements.txt .
# Install all requirements + crewai-tools explicitly
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir crewai-tools
# Copy project
COPY . .

# Create uploads directory
RUN mkdir -p /app/uploads

# Expose FastAPI port
EXPOSE 8000

# Default command (also overridden by docker-compose, but good to have)
CMD ["uvicorn", "src.automation.api:app", "--host", "0.0.0.0", "--port", "8000"]