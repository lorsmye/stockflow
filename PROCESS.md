# PROCESS

## Como aborde el problema

Primero priorice el deploy y la arquitectura. La prueba pide frontend en Vercel y permite usar Next.js con API Routes, asi que tome ese camino para evitar mantener backend separado, CORS y configuraciones duplicadas.

Despues defini el dominio minimo:

- Producto: SKU, nombre, precio, categoria.
- Sucursal: nombre y ubicacion.
- Stock: producto + sucursal + cantidad, con indice unico.
- Movimiento: tipo, producto, cantidad, origen, destino, estado, intentos y razon de fallo.

Luego implemente el backend en este orden:

1. Conexion MongoDB reutilizable para serverless.
2. Modelos Mongoose e indices.
3. CRUD de productos y sucursales.
4. Registro de movimientos en estado `pending` con validacion inicial de stock cuando aplica.
5. Worker con lock temporal, reintentos y actualizacion atomica de stock.
6. Dashboard y reporte.
7. UI operativa.
8. Tests y documentacion.

Deje para el final los extras no criticos: Docker local, seed y pruebas. No agregue autenticacion para no meter seguridad incompleta.

## Herramientas usadas

- Node.js y npm.
- Next.js App Router.
- MongoDB/Mongoose.
- Zod.
- Vitest.
- Docker Compose para Mongo local.
- Vercel como objetivo de deploy.

## Diagrama

```txt
Usuario
  |
  v
React Dashboard
  |
  v
Next.js Route Handlers
  |
  +--> CRUD productos / sucursales
  |
  +--> Crear movimiento pending
  |       |
  |       v
  |     after() dispara worker
  |
  +--> Worker HTTP /api/worker/process
          |
          v
        MongoDB
          |
          +--> Stock
          +--> Movimiento historico
```

## Decisiones tecnicas importantes

1. Next.js fullstack

   Elegi un monolito deployable en Vercel para concentrar el tiempo en funcionalidad y no en infraestructura. Esto tambien hace que el frontend y backend compartan modelos mentales y validaciones.

2. Soft delete de productos y sucursales

   Los productos se desactivan en lugar de borrarse fisicamente. Asi el SKU sigue reservado y los movimientos historicos conservan una referencia valida, evitando que un producto nuevo herede el historial de otro SKU reutilizado. Aplique el mismo criterio a sucursales: se desactivan, no se eliminan, y solo se permite hacerlo cuando no tienen stock asignado.

3. Worker simple en lugar de cola externa

   Use `after()` para disparar el worker despues de responder con el movimiento `pending`, y mantuve un endpoint de worker para cron o reintentos manuales. Si el worker detecta un fallo recuperable, agenda un segundo ciclo corto antes de marcar `failed`. Es una solucion pragmatica para 48 horas. El trade-off es que no tiene las garantias operativas de Redis/RabbitMQ.

4. Descuento atomico de stock

   Para salidas y transferencias, primero valido que haya stock al crear el movimiento, pero el descuento real usa una condicion atomica en MongoDB: solo descuenta si `quantity >= cantidad`. Esto cubre el caso mas importante de concurrencia: dos movimientos creados como pendientes compitiendo por el mismo inventario.

## Que deje para el final

- Pulido visual fino.
- Auth.
- Cola real.
- Transacciones MongoDB.
- Tests de integracion con MongoDB real.
