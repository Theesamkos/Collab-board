# ─── Stage 1: Build Environment ───────────────────────────────────────────────
# Install deps and pre-build wheels; nothing from this stage leaks into the
# final image, keeping it lean.

FROM python:3.11-slim AS builder

WORKDIR /app

# Copy only requirements first — layer is cached until requirements.txt changes
COPY requirements.txt .

# Pre-build wheels for every dependency
RUN pip wheel --no-cache-dir --wheel-dir /app/wheels -r requirements.txt


# ─── Stage 2: Final Production Image ──────────────────────────────────────────

FROM python:3.11-slim

# Non-root user for security
RUN useradd --create-home appuser

WORKDIR /home/appuser/app

# Bring in the pre-built wheels and requirements list
COPY --from=builder /app/wheels /wheels
COPY requirements.txt .

# Install from local wheels — no network call at runtime
RUN pip install --no-cache-dir /wheels/*

# Copy application source
COPY main.py .

# Hand ownership to the non-root user
RUN chown -R appuser:appuser /home/appuser/app

USER appuser

EXPOSE 8000

# Run via uvicorn; workers=1 keeps the footprint minimal for this stateless service
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
