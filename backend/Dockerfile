FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Mitigación para "Illegal Instruction" (SIGILL / status -4) en hardware antiguo
ENV OPENBLAS_CORETYPE=GENERIC
ENV NPY_DISABLE_CPU_FEATURES="AVX512F AVX512_SKX AVX2 AVX F16C FMA3 SSE42 SSE41 SSE4A"
ENV PIP_NO_CACHE_DIR=1

# Instalamos dependencias de compilación adicionales para hardware antiguo
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    make \
    cmake \
    autoconf \
    automake \
    libtool \
    pkg-config \
    curl \
    ca-certificates \
    zlib1g-dev \
    libjpeg-dev \
    libfreetype6-dev \
    libwebp-dev \
    libtiff5-dev \
    libffi-dev \
    libssl-dev \
    libpq-dev \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*



# Instalar dependencias Python
COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Copiar el resto del código
COPY . .

COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

# ── Target: development ──────────────────────────────────
FROM python:3.12-slim AS development

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DJANGO_DEBUG=True

# Mitigación para "Illegal Instruction" (SIGILL / status -4) en hardware antiguo
ENV OPENBLAS_CORETYPE=GENERIC
ENV NPY_DISABLE_CPU_FEATURES="AVX512F AVX512_SKX AVX2 AVX F16C FMA3 SSE42 SSE41 SSE4A"
ENV PIP_NO_CACHE_DIR=1

# Repetimos dependencias en el stage de desarrollo
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    make \
    cmake \
    autoconf \
    automake \
    libtool \
    pkg-config \
    curl \
    ca-certificates \
    zlib1g-dev \
    libjpeg-dev \
    libfreetype6-dev \
    libwebp-dev \
    libtiff5-dev \
    libffi-dev \
    libssl-dev \
    libpq-dev \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*



COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Copiar el resto del código
COPY . .

COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

EXPOSE 8100

ENTRYPOINT ["/entrypoint.sh"]
CMD ["sh", "-c", "python manage.py runserver 0.0.0.0:${PORT:-8100}"]
