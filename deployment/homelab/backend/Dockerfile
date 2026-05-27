FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements-homelab.lock ./requirements-homelab.lock
RUN pip install --user -r requirements-homelab.lock

FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /bin/bash appuser

COPY --from=builder /root/.local /root/.local
COPY --chown=appuser:appuser . .

ENV PATH=/root/.local/bin:$PATH

USER appuser

EXPOSE 8080

CMD ["sh", "-lc", "uvicorn app.main:app --host 0.0.0.0 --port 8080"]
