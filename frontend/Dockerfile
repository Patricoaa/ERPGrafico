# Desarrollo local — imagen ligera solo para instalar dependencias
# El código fuente se monta como volumen (bind mount)
FROM node:20-alpine

WORKDIR /app

# Instalar dependencias nativas si son necesarias
RUN apk add --no-cache libc6-compat

# Copiar solo los manifiestos para cachear la capa de dependencias
COPY package.json package-lock.json* ./
RUN npm ci

# El resto del código se monta como volumen en docker-compose.yml
# No se hace COPY . . ni npm run build aquí

EXPOSE 3000

CMD ["npm", "run", "dev"]
