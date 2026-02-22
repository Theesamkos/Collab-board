FROM python:3.11-slim

WORKDIR /app

COPY services/intent-recognition/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY services/intent-recognition/ ./services/intent-recognition/

EXPOSE 8000

CMD ["python", "services/intent-recognition/main.py"]
