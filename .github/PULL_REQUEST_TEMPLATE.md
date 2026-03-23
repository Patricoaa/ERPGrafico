## ¿Qué hace este PR?

<!-- Describe en 2-3 líneas qué problema resuelve o qué feature agrega -->

---

## Tipo de cambio

<!-- Marca con una X lo que aplica -->

- [ ] `feat` — nueva funcionalidad
- [ ] `fix` — corrección de bug
- [ ] `chore` — configuración, dependencias, docker
- [ ] `refactor` — mejora de código sin cambiar comportamiento
- [ ] `docs` — documentación

---

## ¿Qué partes del sistema toca?

- [ ] Frontend (Next.js)
- [ ] Backend (Django / APIs)
- [ ] Base de datos (migraciones)
- [ ] Celery (tasks / workers)
- [ ] Redis
- [ ] Docker Compose / infraestructura
- [ ] Variables de entorno

---

## Variables de entorno nuevas o modificadas

<!-- Si no hay, escribe "Ninguna" -->
<!-- Si hay, agrégalas también al .env.example -->

```
NOMBRE_VARIABLE=descripcion_de_para_que_sirve
```

---

## Migraciones de base de datos

- [ ] Este PR incluye migraciones de Django
- [ ] No incluye migraciones

<!-- Si incluye migraciones, describe qué cambia en el esquema -->

---

## Cómo probar este PR localmente

<!-- Pasos concretos para que cualquiera (o vos en 3 meses) pueda verificar que funciona -->

1. 
2. 
3. 

<!-- ¿Necesita docker-compose up antes? ¿Algún comando extra? -->

---

## Checklist antes de mergear

- [ ] Probé los cambios con `npm run dev` (frontend)
- [ ] Probé los cambios con docker-compose levantado (backend)
- [ ] Si hay migraciones, las corrí y verifiqué
- [ ] Si hay variables de entorno nuevas, las agregué al `.env.example`
- [ ] El título del PR sigue la convención: `feat(frontend):`, `fix(backend):`, etc.
- [ ] Revisé el diff completo antes de abrir este PR

---

## Contexto adicional

<!-- Screenshots, links, decisiones técnicas importantes, o cualquier cosa relevante -->
<!-- Si este PR cierra un Issue, escribe: Closes #NRO_ISSUE -->
