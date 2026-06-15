FROM python:3.12-slim

# Install system dependencies for:
# 1. Compilation of C-based python packages (gcc, g++, python3-dev, libffi-dev)
# 2. python-magic (libmagic1)
# 3. Weasyprint (libpango, libharfbuzz, libpangoft2, libpangocairo, shared-mime-info)
# 4. curl for healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3-dev \
    libffi-dev \
    libmagic1 \
    libpango-1.0-0 \
    libharfbuzz0b \
    libpangoft2-1.0-0 \
    libpangocairo-1.0-0 \
    shared-mime-info \
    media-types \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create directories for data persistence
RUN mkdir -p /app/uploads /app/db

EXPOSE 8000
