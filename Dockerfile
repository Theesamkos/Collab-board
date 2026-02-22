FROM python:3.11-slim

WORKDIR /app

COPY services/intent-recognition/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY services/intent-recognition/main.py .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
