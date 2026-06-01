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
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    && rm -rf /var/lib/apt/lists/*



# Instalar dependencias Python
COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Crear usuario no root
RUN groupadd -g 1000 django && \
    useradd -u 1000 -g django -s /bin/bash -m django

# Copiar el resto del código
COPY . .
RUN chown -R django:django /app

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
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Crear usuario no root en stage de desarrollo
RUN groupadd -g 1000 django && \
    useradd -u 1000 -g django -s /bin/bash -m django

# Copiar el resto del código
COPY . .
RUN chown -R django:django /app

COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

EXPOSE 8100

# USER django  # Comentado para evitar conflictos de permisos con volúmenes locales

ENTRYPOINT ["/entrypoint.sh"]
CMD ["sh", "-c", "daphne -b 0.0.0.0 -p ${PORT:-8100} config.asgi:application"]
