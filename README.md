# FeedBox: Docker volumes and container networking

FeedBox is a minimal feedback collector with PostgreSQL (`db`), Express (`api`), and an Nginx-served frontend (`web`).

## Project structure

```text
├── server.js
├── Dockerfile
├── package.json
├── package-lock.json
├── docker-compose.yml
├── docker-compose.override.yml
├── .env.example
└── client/
    ├── Dockerfile
    └── index.html
```

## Setup and run

In PowerShell, create the local environment file and start the stack:

```powershell
Copy-Item .env.example .env
docker compose config -q
docker compose up --build -d
```

- API: http://localhost:5000/api/messages
- Frontend: http://localhost:3000

Compose automatically merges `docker-compose.override.yml` with the main file.
The override is intended for local development: it bind-mounts the project
source into the API container, keeps container-installed dependencies in an
anonymous `/app/node_modules` volume, runs Nodemon, and serves the host client
files read-only. To inspect or validate only the base stack, pass the main
file explicitly:

```powershell
docker compose -f docker-compose.yml config -q
```

## Storage, networking, and service discovery

- PostgreSQL stores its data in the named `postgres_data` volume mounted at
  `/var/lib/postgresql/data`. Removing and recreating the database container
  does not remove this volume.
- The database has no published host port and is attached only to the internal
  `backend_net`. The API joins both `backend_net` and `frontend_net`; the web
  service joins only `frontend_net`.
- The API connects to PostgreSQL by the Compose service name `db` in
  `DATABASE_URL`. Compose DNS resolves that name on `backend_net`; no container
  IP address is hard-coded. The API's host port remains published for the
  browser-based client.
- `.env.example` is a local development template. Keep the database password
  in `POSTGRES_PASSWORD` and `DATABASE_URL` consistent, and do not commit `.env`.

## Verify persistence and service discovery

Post a message, recreate the stack without removing named volumes, then fetch
the messages again:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/messages `
  -ContentType 'application/json' -Body '{"text":"persistence-check"}'
docker compose down
docker compose up --build -d
Invoke-RestMethod -Uri http://localhost:5000/api/messages
```

The response after restart should still include `persistence-check`. `docker
compose down` preserves named volumes. Do not use `docker compose down -v`
unless you intend to delete the database volume and all stored messages.

The API's network path and DNS lookup can be checked from inside its container:

```powershell
docker compose exec -T api node -e "import('pg').then(async ({ default: pg }) => { const client = new pg.Client({ connectionString: process.env.DATABASE_URL }); await client.connect(); console.log((await client.query('select current_database() as database')).rows[0]); await client.end(); })"
docker compose ps
docker network ls
docker volume ls
```

The SQL query should return `feedbox`; `docker compose ps` should show `db`,
`api`, and `web` running. The backend network inspection should list the API
and database, while the frontend network should list the API and web service.
Compose prefixes network and volume names with the project name (normally the
workspace directory name). These PowerShell commands find and inspect the
assignment network and volume by their Compose labels:

```powershell
$backendNetwork = docker network ls --filter label=com.docker.compose.network=backend_net --format '{{.Name}}'
docker network inspect $backendNetwork
$databaseVolume = docker volume ls --filter label=com.docker.compose.volume=postgres_data --format '{{.Name}}'
docker volume inspect $databaseVolume
```

## Validation and cleanup

```powershell
docker compose config -q
docker compose -f docker-compose.yml config -q
docker compose up --build
```

There is no application test script in `package.json`; the Compose and runtime
checks above cover configuration, service startup, API-to-database service
discovery, and persistence. `.env` and `node_modules` are ignored and must not
be committed. To stop the containers without deleting data, run
`docker compose down`.
