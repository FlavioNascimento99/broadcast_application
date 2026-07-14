# Deploying to Railway

This stack has 4 pieces — Postgres, the Go middleware broker, the Express backend, and the Nginx
frontend — deployed as 4 separate Railway services inside one project, all built from this same
GitHub repo using each service's `Dockerfile`. Railway's private networking lets them reach each
other by hostname (`<service-name>.railway.internal`) without exposing anything but the frontend
to the public internet.

Prerequisite: push the fixes in this branch to GitHub first — Railway builds from the repo, not
from your local working copy.

## 1. Create the project

1. On [railway.app](https://railway.app), **New Project** → **Empty Project**.
2. Connect your GitHub account if you haven't already (Railway needs repo read access, even for
   public repos, to trigger builds on push).

## 2. Add PostgreSQL

**+ New** → **Database** → **Add PostgreSQL**. Railway provisions it and exposes a `DATABASE_URL`
variable you'll reference from the backend service. Leave its name as `Postgres`.

## 3. Add the middleware (Go broker)

**+ New** → **GitHub Repo** → select this repo.

- Settings → **Root Directory**: `middleware`
- Settings → **Service Name**: `middleware` (so its private hostname is predictable)
- Railway auto-detects `middleware/Dockerfile` — no env vars needed, no public domain.

## 4. Add the backend (Express API)

**+ New** → **GitHub Repo** → same repo again.

- Settings → **Root Directory**: `backend`
- Settings → **Service Name**: `backend`
- Variables:
  ```
  DATABASE_URL=${{Postgres.DATABASE_URL}}
  MIDDLEWARE_BROKERS=middleware.railway.internal:9000
  PORT=3000
  FRONTEND_URL=          # fill in after step 5, then redeploy
  ```
- No public domain needed — only the frontend talks to it, over the private network.

## 5. Add the frontend (Nginx + React)

**+ New** → **GitHub Repo** → same repo again.

- Settings → **Root Directory**: `frontend`
- Settings → **Service Name**: `frontend`
- Variables:
  ```
  BACKEND_HOST=backend.railway.internal
  BACKEND_PORT=3000
  ```
- Settings → **Networking** → **Generate Domain** (target port `80`). This gives you a public URL
  like `broadcast-app-production.up.railway.app` — **this is the link you put in your portfolio**
  (or attach a custom domain from the same screen).

## 6. Close the loop

Go back to the **backend** service's variables and set:

```
FRONTEND_URL=https://<the-domain-from-step-5>
```

This is what the backend uses to build its CORS allow-list for both REST and Socket.IO. Redeploy
the backend after setting it.

## 7. Verify

- `https://<frontend-domain>/` loads the app.
- `https://<frontend-domain>/api/health` returns `{"status":"ok",...}`.
- Create a topic in one browser tab, open a second tab — the new topic should appear live via
  WebSocket, proving frontend → backend → middleware → backend → frontend all round-tripped.

## Notes

- The backend runs `prisma db push` on container start (see `backend/Dockerfile`), so the schema
  syncs automatically on first boot — no manual migration step.
- All 4 services rebuild automatically on every push to the connected branch.
- Free/Hobby usage limits apply per Railway's current pricing — check your project's usage tab if
  you want to keep this fully within a free tier.
