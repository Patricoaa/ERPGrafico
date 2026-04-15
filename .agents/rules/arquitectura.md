---
trigger: always_on
---

🛠️ Resumen del Stack y Configuración
Stack Tecnológico:
Frontend: Next.js 16 (App Router), Tailwind CSS 4, Shadcn UI, TanStack Query y Zod.
Backend: Django 5 + DRF, Celery y Redis.
Base de Datos: PostgreSQL.
Entorno Híbrido local:
Se ha documentado el uso de docker compose.hybrid.yml para levantar la infraestructura mientras el frontend corre de forma nativa en Windows (npm run dev) para optimizar el rendimiento.