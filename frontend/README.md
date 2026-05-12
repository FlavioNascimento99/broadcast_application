# Publisher Frontend

React + Tailwind CSS frontend with neo-brutalist design for the Publisher messaging platform.

## Features

- ⚡ **React 18** with TypeScript
- 🎨 **Tailwind CSS** for styling
- 🎯 **Vite** for fast development and building
- 🎭 **Neo-brutalist design** with neon colors and bold typography
- 🔌 **API integration** with Express backend
- 📱 **Responsive layout** (mobile-friendly)

## Tech Stack

- **React 18** — UI library
- **TypeScript** — Type safety
- **Tailwind CSS** — Utility-first CSS
- **Vite** — Build tool
- **Axios** — HTTP client
- **PostCSS + Autoprefixer** — CSS processing

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Server starts at `http://localhost:3001` with auto-reload.

### Build

```bash
npm run build
```

Compiles TypeScript and bundles with Vite to `dist/`.

### Preview

```bash
npm run preview
```

Preview the production build locally.

## API Configuration

The frontend connects to the backend at `http://localhost:3000/api`.

Make sure the backend server is running before starting the frontend.

See [../publisher_nodejs/README.md](../publisher_nodejs/README.md) for backend setup.

## Project Structure

```
src/
├── App.tsx                    # Main app component
├── main.tsx                   # React entry point
├── index.css                  # Global styles with Tailwind
├── components/
│   ├── TopicForm.tsx         # Form to create topics
│   ├── TopicList.tsx         # Display topics grid
│   ├── PostForm.tsx          # Form to create posts
│   └── PostList.tsx          # Display posts list
└── services/
    └── api.ts                # API client with axios

public/                        # Static assets
index.html                     # HTML entry point
```

## Design System

### Colors (Neo-brutalist Palette)

```
Primary: Neon Pink (#FF006E)
Secondary: Cyan (#00D9FF)
Accent: Purple (#B700FF)
Warning: Yellow (#FFBE0B)
Success: Green (#00FF41)
Background: Black (#0a0a0a)
```

### Components

- **Cards** — Bold border (4px), padding, shadow
- **Buttons** — Thick border, uppercase text, hover state with color change
- **Inputs** — Dark background, cyan border, focus on pink
- **Typography** — Bold, uppercase, wide letter-spacing

## Features

### Topics Management

- ✅ Create new topics with name and description
- ✅ View all topics in a grid layout
- ✅ Click topic to view its posts
- ✅ Delete topics (cascades to posts)

### Posts Management

- ✅ Create posts within a topic
- ✅ Display author name and content
- ✅ Show creation timestamp
- ✅ Delete individual posts
- ✅ Filter posts by topic

### Status Indicator

- 🟢 Green when connected to backend
- 🔴 Red when disconnected
- 🟡 Yellow when checking connection
- Manual retry button for reconnection

## Development Tips

### Hot Module Replacement

Changes to React components are automatically reloaded without losing state.

### TypeScript

All components are fully typed. Check your IDE for type hints and auto-completion.

### Tailwind CSS

Use utility classes for styling. Custom neo-brutalist utilities are in `src/index.css`:

```tsx
<div className="neobrutalist-card">
  <h2 className="neobrutalist-heading">Title</h2>
  <button className="neobrutalist-button">Action</button>
</div>
```

### API Calls

The `src/services/api.ts` module provides typed API methods:

```typescript
import { topicsAPI, postsAPI } from './services/api'

const topics = await topicsAPI.getAll()
const posts = await postsAPI.getByTopicId(topicId)
```

## Troubleshooting

### "Cannot connect to backend"

Make sure the backend API is running at `http://localhost:3000`:

```bash
# From publisher_nodejs/
npm run dev
```

### Port 3001 already in use

Change the port in `vite.config.ts`:

```typescript
server: {
  port: 3002,
}
```

### TypeScript errors

Run type checking:

```bash
npx tsc --noEmit
```

## Build & Deployment

### Production Build

```bash
npm run build
```

Creates optimized bundle in `dist/`.

### Deploy to Vercel

```bash
npm i -g vercel
vercel
```

### Deploy to Netlify

```bash
npm i -g netlify-cli
netlify deploy --prod --dir=dist
```

**Note:** Update API URL in `src/services/api.ts` to point to your production backend.

## Neo-Brutalism Inspiration

This design is inspired by:

- Raw, unpolished aesthetics
- Geometric shapes
- High contrast colors
- Thick borders and bold typography
- Asymmetrical layouts
- Monospace accents

See `tailwind.config.ts` for customization.

## License

MIT
