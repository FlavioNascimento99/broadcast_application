# Quick Start Guide

Guia completo para rodar o projeto Publisher (Backend + Frontend).

## Project Structure

```
/
├── middleware_messaging/        # Go implementation (coming soon)
├── publisher_nodejs/            # Express backend API
├── frontend/                    # React frontend
└── subscriber_nextjs/           # Next.js subscriber (optional)
```

## Prerequisites

- Node.js 18+
- npm or yarn
- PostgreSQL 12+ (running locally)

## Step 1: Setup Backend (Express + TypeScript)

Navigate to `publisher_nodejs/`:

```bash
cd publisher_nodejs
npm install
```

Configure PostgreSQL credentials in `.env`:

```bash
copy .env.example .env
```

Edit `.env`:

```env
PORT=3000
DATABASE_URL=postgresql://postgres:admin@localhost:5432/post_db
```

Create database tables:

```bash
npm run prisma:push
```

Start the backend server:

```bash
npm run dev
```

Expected output:
```
API listening on port 3000
```

The backend is now running at `http://localhost:3000`.

## Step 2: Setup Frontend (React + Tailwind)

**In a new terminal**, navigate to `frontend/`:

```bash
cd frontend
npm install
```

Start the development server:

```bash
npm run dev
```

Expected output:
```
  ➜  Local:   http://localhost:3001/
  ➜  press h to show help
```

The frontend will automatically open at `http://localhost:3001`.

## Step 3: Test the Application

### Check Backend Connection

In the frontend, you should see a **green indicator** in the top-right corner showing "Connected".

If it shows red/error:
1. Verify backend is running on port 3000
2. Check PostgreSQL is running
3. Verify `.env` has correct DATABASE_URL

### Create a Topic

1. In the **left panel**, fill "Topic Name" (e.g., "JavaScript")
2. Optionally add a description
3. Click "Create Topic"
4. The topic appears in the **right panel**

### Create a Post

1. Click "View Posts" on any topic
2. Fill "Your Name" and "Post Content"
3. Click "Publish Post"
4. The post appears below

### Manage Data

- **Delete Topic** — Removes topic and all its posts
- **Delete Post** — Removes individual post
- **Back to Topics** — Returns to main view

## Running Both Servers Concurrently

### Option 1: Two Terminal Windows

**Terminal 1:**
```bash
cd publisher_nodejs && npm run dev
```

**Terminal 2:**
```bash
cd frontend && npm run dev
```

### Option 2: Using npm-run-all (Recommended)

In the root directory, create a simple script:

```powershell
# terminal 1
cd publisher_nodejs && npm run dev

# In another terminal
cd frontend && npm run dev
```

Or install `npm-run-all`:

```bash
npm install -g npm-run-all
```

Then run from root:

```bash
concurrently "cd publisher_nodejs && npm run dev" "cd frontend && npm run dev"
```

## API Endpoints

See [publisher_nodejs/API_DOCUMENTATION.md](publisher_nodejs/API_DOCUMENTATION.md) for complete API documentation.

**Quick Reference:**

```bash
# Health check
curl http://localhost:3000/api/health

# Get all topics
curl http://localhost:3000/api/topics

# Create topic
curl -X POST http://localhost:3000/api/topics \
  -H "Content-Type: application/json" \
  -d '{"name":"Tech","description":"Technology topics"}'

# Get posts by topic
curl http://localhost:3000/api/posts/topic/{topicId}

# Create post
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -d '{"author":"John","content":"Great post!","topic_id":"{topicId}"}'
```

## Building for Production

### Backend

```bash
cd publisher_nodejs
npm run build
npm start
```

The compiled JavaScript runs from `dist/`.

### Frontend

```bash
cd frontend
npm run build
```

Creates optimized bundle in `dist/`.

Deploy `frontend/dist` to:
- Vercel
- Netlify
- AWS S3 + CloudFront
- GitHub Pages
- Any static host

**Important:** Update API URL in `frontend/src/services/api.ts`:

```typescript
const API_BASE_URL = 'https://your-backend-domain.com/api'
```

Then rebuild:

```bash
npm run build
```

## Environment Variables

### Backend (.env)

```env
PORT=3000
DATABASE_URL=postgresql://postgres:admin@localhost:5432/post_db
```

### Frontend (src/services/api.ts)

```typescript
const API_BASE_URL = 'http://localhost:3000/api'
```

For production, change to your deployed backend URL.

## Troubleshooting

### "Cannot connect to backend" (Red indicator on frontend)

1. **Check backend is running:**
   ```bash
   curl http://localhost:3000/api/health
   ```

2. **Check PostgreSQL:**
   ```bash
   psql -U postgres -d post_db
   ```

3. **Check .env credentials:**
   ```bash
   cat publisher_nodejs/.env
   ```

4. **Restart backend:**
   ```bash
   # Ctrl+C to stop
   npm run dev
   ```

### "Module not found" errors

```bash
# Clean install
rm -r node_modules
npm cache clean --force
npm install
```

### Port already in use

```bash
# Find process on port 3000
netstat -ano | findstr :3000

# Kill process (replace PID)
taskkill /PID <PID> /F
```

### TypeScript compilation errors

```bash
# Check types
npx tsc --noEmit

# Rebuild
npm run build
```

## Next Steps

1. ✅ Backend running (port 3000)
2. ✅ Frontend running (port 3001)
3. ✅ Tested creating topics and posts
4. ⏳ (Optional) Deploy to production
5. ⏳ (Optional) Integrate with Go middleware
6. ⏳ (Optional) Connect Next.js subscriber

## Architecture

```
┌─────────────────────────────────────────┐
│         Frontend (React)                 │
│     localhost:3001                       │
│   ┌──────────────────────────────┐      │
│   │ Topic Management            │      │
│   │ Post Management             │      │
│   │ Neo-brutalist UI            │      │
│   └──────────────────────────────┘      │
└────────┬────────────────────────────────┘
         │ HTTP/REST (Axios)
         │
┌────────▼────────────────────────────────┐
│   Backend (Express + TypeScript)        │
│        localhost:3000                    │
│   ┌──────────────────────────────┐      │
│   │ Topic Routes                 │      │
│   │ Post Routes                  │      │
│   │ Prisma ORM                   │      │
│   └──────────────────────────────┘      │
└────────┬────────────────────────────────┘
         │ SQL
         │
┌────────▼────────────────────────────────┐
│    PostgreSQL Database                  │
│    (localhost:5432)                     │
│   ┌──────────────────────────────┐      │
│   │ topics table                 │      │
│   │ posts table                  │      │
│   └──────────────────────────────┘      │
└─────────────────────────────────────────┘
```

## Resources

- [Backend README](publisher_nodejs/README.md)
- [Frontend README](frontend/README.md)
- [API Documentation](publisher_nodejs/API_DOCUMENTATION.md)
- [PostgreSQL Setup](publisher_nodejs/POSTGRESQL_SETUP.md)
- [Troubleshooting](publisher_nodejs/TROUBLESHOOTING.md)
- [Prisma Guide](publisher_nodejs/PRISMA_GUIDE.md)

## Support

For issues or questions, check the documentation files listed above.
