# HomeOps RPG — Backend (API)

API REST con **Express**, **MySQL** (`mysql2`) y arquitectura modular.

Repositorio: [homeops-backend](https://github.com/Ismaelmc8/homeops-backend)

---

## Requisitos

- Node.js LTS (v20+)
- MySQL con base `homeops` creada (ver `sql/001_init.sql`)

---

## Configuración

1. Instalar dependencias:

```powershell
npm install
```

2. Variables de entorno:

```powershell
copy .env.example .env
```

Edita `.env` con MySQL y `CORS_ORIGIN` (URL del front, ej. `http://localhost:5173`).

Puedes usar `DATABASE_URL` (como en otras apps) o `DB_HOST` / `DB_USER` / etc.:

```env
DATABASE_URL=mysql://usuario:password@localhost:3306/homeops
```

Si reutilizas el usuario de otra app (p. ej. `Formula1`), ese usuario debe tener permisos sobre la base `homeops`. Ejecuta como admin MySQL:

```powershell
mysql -u root -p < sql/grant-homeops-formula1.sql
```

3. Inicializar base de datos y migraciones E1:

```powershell
npm run db:migrate
```

---

## Arrancar

**Solo API:**

```powershell
npm run dev
```

API en `http://localhost:4000` (puerto por defecto).

**Comprobar:**

```powershell
curl http://localhost:4000/api/health
```

Respuesta esperada: `{"status":"ok","db":true}`.

---

## Desde la carpeta raíz del monorepo local

En `Tareas del hogar/` (orquestación con front-end):

```powershell
npm run dev
```

---

## Estructura

```text
src/
  config/       db, env
  routes/       endpoints
  controllers/  capa HTTP
  services/     lógica
  models/       SQL
  middleware/   auth (E1), errores
  exceptions/
  utils/
sql/            migraciones numeradas
```

## Motor de recompensas (E2)

Ver comentarios en `src/services/rewardEngine.js`. Ejecutar migración E2:

```powershell
npm run db:migrate
npm test
```

Documentación: `../docs/evolutivos/E2-gamificacion-nucleo.md`.

## Cola y prioridad (E3)

Motor Kanban, prioridad invisible, modo recuperación y métricas. Migración E3 incluida en `npm run db:migrate`.

```powershell
npm run db:migrate
npm test
```

Documentación: `../docs/evolutivos/E3-cola-y-prioridad.md` · Changelog: `../docs/changelog/E3.md`.

## Hogar compartido (E4)

Cooperación, asignación, eventos y objetivos semanales. Migración `005_e4_cooperation.sql` incluida en `npm run db:migrate`.

**Sesiones:** JWT firmado en `Authorization: Bearer` guardado en `localStorage` del front (mismo enfoque E1).

Documentación: `../docs/evolutivos/E4-hogar-compartido.md` · Changelog: `../docs/changelog/E4.md`.

## Social y retención (E6)

Feedback, kudos, bonus diario, microobjetivos, historial y MVP/ranking opt-in. Migración `006_e6_social.sql`.

Documentación: `../docs/evolutivos/E6-social-y-retencion.md` · Changelog: `../docs/changelog/E6.md`.
