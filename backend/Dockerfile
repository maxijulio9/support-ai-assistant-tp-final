FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# el host vacio escucha en IPv4 e IPv6, hace falta para la red privada de Railway, y el puerto sale de PORT
CMD ["sh", "-c", "exec uvicorn app.main:app --host '' --port ${PORT:-8000}"]
