# StockFlow

Mini plataforma fullstack para controlar inventario multi-sucursal con movimientos asincronos.

## Stack

- Next.js 16 App Router
- React 19
- MongoDB + Mongoose
- Zod para validacion
- Vitest para pruebas unitarias
- Vercel como destino de deploy

## Funcionalidad

- CRUD de productos.
- CRUD de sucursales.
- Dashboard con stock total por producto y stock por sucursal.
- Registro de entradas, salidas y transferencias.
- Movimientos creados como `pending` y procesados despues de responder al cliente.
- Worker HTTP en `/api/worker/process` para procesar pendientes desde el boton de la UI o desde cron.
- Reintentos: cada movimiento falla definitivamente hasta agotar `maxAttempts`.
- Validacion inicial de stock al registrar salidas/transferencias.
- Validacion atomica de stock disponible con MongoDB para evitar sobreventa por concurrencia.
- Historial de movimientos con filtros por estado y sucursal.
- Detalle de cada movimiento.
- Reporte por rango de fechas con totales por tipo y sucursal.

## Setup local

1. Instalar dependencias:

```bash
npm install
```

2. Crear `.env.local`:

```bash
MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/stockflow?appName=stockflow-cluster
MONGODB_DB_NAME=stockflow
WORKER_SECRET=
```

3. Si usas Mongo local, levantar MongoDB con Docker:

```bash
docker compose up -d
```

Si usas MongoDB Atlas, puedes saltar el paso de Docker.

4. Cargar datos demo:

```bash
npm run seed
```

5. Ejecutar la app:

```bash
npm run dev
```

La app queda en `http://localhost:3000`.

## Variables de entorno

```bash
MONGODB_URI=mongodb://localhost:27017/stockflow
MONGODB_DB_NAME=stockflow
WORKER_SECRET=
```

`WORKER_SECRET` es opcional. Si se define, `/api/worker/process` requiere:

```txt
Authorization: Bearer <WORKER_SECRET>
```

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run test
npm run seed
```

## Deploy

Frontend y backend viven en el mismo proyecto Next.js, asi que el deploy recomendado es un solo proyecto en Vercel.

1. Crear una base MongoDB Atlas.
2. Subir el repo publico a GitHub.
3. Importar el repo en Vercel.
4. Configurar `MONGODB_URI` y `MONGODB_DB_NAME`.
5. Deploy.

URL de Vercel: https://stockflow-sigma-sandy.vercel.app/

## Arquitectura

```txt
React UI
  |
  v
Next.js Route Handlers
  |
  v
MongoDB Atlas / Mongo local
  |
  v
Worker HTTP /api/worker/process
  |
  v
Stocks actualizados + movimientos historicos
```

## Decisiones y trade-offs

Use Next.js fullstack para reducir superficie de deploy: no hay CORS, no hay dos servicios que coordinar y las API Routes viven cerca de la UI.

No use RabbitMQ/BullMQ en esta version. Para 48 horas, el procesamiento se resuelve con un worker HTTP ejecutado desde la UI o desde un cron. Es simple, corre en Vercel y deja visible el estado `pending` antes de actualizar stock. En produccion con mayor carga, moveria esto a BullMQ/Redis o una cola administrada.

La concurrencia de stock se maneja con `findOneAndUpdate` atomico usando `quantity: { $gte: cantidad }`. Si dos salidas compiten por el mismo stock, Mongo solo permite descontar a la que aun cumple la condicion.

Al crear una salida o transferencia tambien se valida el stock visible en ese momento. El worker vuelve a validar de forma atomica al procesar, porque entre la creacion `pending` y el procesamiento puede haber otro movimiento que consuma el inventario.

Las transferencias descuentan origen y luego incrementan destino. Si el incremento falla, se intenta compensar devolviendo stock al origen. Para una version mas robusta usaria transacciones MongoDB en replica set.

## Que haria diferente con una semana

- Cola real con BullMQ + Redis o servicio administrado.
- Transacciones MongoDB para transferencias multi-documento.
- Autenticacion con roles por sucursal.
- Auditoria mas completa con usuario, IP y metadata del request.
- Observabilidad con logs estructurados y metricas de worker.
- Mas pruebas de integracion con una base MongoDB efimera.
- Paginacion y busqueda avanzada en productos y movimientos.
