# Quiniela Mundial 2026 API

Backend REST para una quiniela del Mundial 2026. Permite registrar usuarios, iniciar sesion con JWT, crear grupos, unirse por codigo, pronosticar partidos, consultar clasificaciones, ver dashboard y administrar el calendario/resultados con sincronizacion desde TheSportsDB.

## Tecnologias

- NestJS
- TypeORM
- MySQL
- JWT
- class-validator
- TheSportsDB

## Instalacion

```bash
npm install
cp .env.example .env
npm run start:dev
```

La API levanta por defecto en `http://localhost:3000`.

## MySQL con Docker

```bash
docker run --name quiniela-mysql -e MYSQL_ALLOW_EMPTY_PASSWORD=yes -e MYSQL_DATABASE=quiniela_mundial -p 3306:3306 -d mysql:8
```

Si prefieres usar contrasena:

```bash
docker run --name quiniela-mysql -e MYSQL_ROOT_PASSWORD=tu_clave -e MYSQL_DATABASE=quiniela_mundial -p 3306:3306 -d mysql:8
```

Luego actualiza `DATABASE_PASSWORD` en `.env`.

## Variables de entorno

```env
PORT=3000
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_USERNAME=root
DATABASE_PASSWORD=
DATABASE_NAME=quiniela_mundial
JWT_SECRET=coloca-una-clave-segura
SPORTSDB_SYNC_ENABLED=true
SPORTSDB_API_KEY=123
SPORTSDB_SYNC_INTERVAL_MS=1200000
SPORTSDB_WORLD_CUP_LEAGUE_ID=4429
SPORTSDB_WORLD_CUP_SEASON=2026
SPORTSDB_EVENTS_SEASON_URL=
SPORTSDB_EVENTS_DAY_URL=
```

El proyecto usa `synchronize: true` en TypeORM, por lo que crea/actualiza tablas automaticamente en desarrollo. Para produccion se recomienda migraciones.

## Autenticacion y roles

Los endpoints privados requieren:

```http
Authorization: Bearer <token>
```

Roles disponibles:

- `visitante`: rol contemplado para visitantes/no autenticados.
- `usuario`: rol por defecto al registrarse.
- `admin`: puede administrar partidos y ejecutar sincronizaciones.

No se crea un administrador automaticamente. Para pruebas, registra un usuario y cambia su columna `role` a `admin` en MySQL.

## Endpoints principales

Auth:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`

Usuarios:

- `GET /users/me`
- `PATCH /users/me`

Grupos:

- `POST /grupos`
- `GET /grupos`
- `GET /grupos/:id`
- `GET /grupos/:id/codigo`
- `POST /grupos/unirse`
- `GET /grupos/:id/participantes`
- `GET /grupos/:id/clasificacion`

Partidos:

- `GET /partidos`
- `GET /partidos?fase=&fecha=&estado=`
- `GET /partidos/:id`

Administrador:

- `POST /partidos`
- `PATCH /partidos/:id`
- `PATCH /partidos/:id/resultado`
- `POST /sincronizacion/partidos`
- `POST /sincronizacion/resultados`

Pronosticos:

- `POST /pronosticos`
- `PATCH /pronosticos/:id`
- `GET /pronosticos/mis-pronosticos`
- `GET /pronosticos/grupo/:grupoId`
- `GET /pronosticos/grupo/:grupoId/posicion`

Dashboard:

- `GET /dashboard`

## Pronosticos

Ejemplo para crear un pronostico:

```json
{
  "grupoId": 1,
  "partidoId": 10,
  "golesLocal": 2,
  "golesVisitante": 1
}
```

Reglas:

- Solo se puede pronosticar antes del inicio del partido y si esta `programado`.
- Un usuario no puede duplicar pronostico para el mismo partido dentro del mismo grupo.
- Un usuario no puede modificar pronosticos de otros usuarios.
- El usuario debe pertenecer al grupo.

Puntuacion:

- 3 puntos por marcador exacto.
- 1 punto por acertar ganador o empate.
- 0 puntos si no acierta.

Los puntos se guardan en cada pronostico y se recalculan cuando cambia el resultado oficial del partido.

## TheSportsDB

El flujo correcto es:

```text
TheSportsDB -> SincronizacionService -> MySQL -> PartidosService -> Frontend
```

Con `SPORTSDB_SYNC_ENABLED=true`, al iniciar el backend se sincroniza el calendario de temporada y los resultados del dia. Luego se actualizan resultados cada `SPORTSDB_SYNC_INTERVAL_MS`; el valor esperado es `1200000`, equivalente a 20 minutos.

La API gratuita usa:

```env
SPORTSDB_API_KEY=123
```

Puedes dejar vacias `SPORTSDB_EVENTS_SEASON_URL` y `SPORTSDB_EVENTS_DAY_URL` para usar la URL de temporada por defecto y configurar la diaria cuando sea necesario. Si se configuran, aceptan `{API_KEY}`, `{LEAGUE_ID}` y `{SEASON}` como placeholders.

La sincronizacion registra logs de URL consultada, eventos recibidos, partidos creados, partidos actualizados, resultados actualizados, errores de API y respuestas vacias.
