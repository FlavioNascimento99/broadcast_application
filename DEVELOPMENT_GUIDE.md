# 🚀 Guia Prático: Development & Deployment

## 📋 Quick Reference

### Ports & URLs
```
Frontend (React):        http://localhost:5173 (dev) / :3001 (prod)
Backend (Node.js):       http://localhost:3000
Backend WS:              ws://localhost:3000/socket.io
Middleware Broker 1:     localhost:9000 (clients)  | :9100 (peers)
Middleware Broker 2:     localhost:9001 (clients)  | :9101 (peers)
PostgreSQL:              localhost:5432
```

---

## 🏗️ Setup Local Completo (5 terminais)

### Terminal 1: PostgreSQL
```bash
# macOS
brew services start postgresql

# Windows (cmd as admin)
"C:\Program Files\PostgreSQL\15\bin\pg_ctl.exe" -D "C:\Program Files\PostgreSQL\15\data" start

# Linux
sudo systemctl start postgresql
```

Verificar:
```bash
psql -U postgres -d publisher_db
\dt  # Listar tabelas
```

---

### Terminal 2: Middleware Broker 1
```bash
cd middleware
go run ./cmd/broker -client-addr :9000 -peer-addr :9100 -peers localhost:9101

# Saída esperada:
# Broker ID: broker-1234567890
# Listening for clients on :9000
# Listening for peers on :9100
# Connecting to peer localhost:9101
```

---

### Terminal 3: Middleware Broker 2 (Opcional - High Availability)
```bash
cd middleware
go run ./cmd/broker -client-addr :9001 -peer-addr :9101 -peers localhost:9100

# Saída esperada:
# Broker ID: broker-9876543210
# Listening for clients on :9001
# Listening for peers on :9101
# Connected to peer localhost:9100
```

---

### Terminal 4: Backend
```bash
cd backend

# Verificar .env
cat .env

# Instalar dependências
npm install

# Migrations Prisma
npm run prisma:migrate

# Iniciar servidor
npm run dev

# Saída esperada:
# API listening on port 3000
# [Index] Event service initialized
# [MiddlewareClient] Connected to broker: localhost:9000
# [MiddlewareClient] Subscribed to post_created
# [MiddlewareClient] Subscribed to topic_created
```

---

### Terminal 5: Frontend
```bash
cd frontend

# Instalar dependências
npm install

# Iniciar dev server
npm run dev

# Acessar:
# http://localhost:5173
# ou http://127.0.0.1:5173
```

---

## ✅ Validação: Fluxo Completo

### 1. Verificar Conectividade

**Frontend Console (DevTools)**
```javascript
// Deve aparecer
[WebSocket] Connecting to: http://localhost:3000
[WebSocket] Connected
[useWebSocket] Connected
```

**Backend Console**
```
[Index] Event service initialized
[MiddlewareClient] Connected to broker: localhost:9000
[Socket.IO] Client connected: socket_id_xyz
[Socket.IO] Client socket_id_xyz subscribed to posts
```

---

### 2. Teste: Criar Tópico

**Ação:** Frontend → TopicForm → Digite nome e descrição → "Create Topic"

**Esperado:**
- ✅ Tópico aparece na lista de topics
- ✅ Backend console: `[EventService] Topic created event published`
- ✅ Middleware console: `client: new message from topic_created subscriber`
- ✅ Frontend console: `[WebSocket] Topic created: {...}`

---

### 3. Teste: Criar Post

**Ação:** Frontend → Selecionar tópico → TopicForm → "New Post" → Preencher → Publish

**Esperado:**
- ✅ Post aparece na lista instantaneamente (WebSocket!)
- ✅ Backend console: `[EventService] Post created event published`
- ✅ Middleware: evento roteado para todos os subscribers
- ✅ Frontend mostra notificação "🔴 Real-time updates enabled"

---

### 4. Teste: Multi-cliente (Abrir 2 abas)

**Ação:** 
1. Browser Tab A: http://localhost:5173 (aberta)
2. Browser Tab B: http://localhost:5173 (nova aba)
3. Tab A: Criar novo post
4. Tab B: Verificar se aparece instantaneamente

**Esperado:**
- ✅ Post criado em Tab A aparece em Tab B sem refresh manual
- ✅ Demonstra que WebSocket está funcionando

---

## 🐳 Docker Compose (Opcional - Prod)

Criar `docker-compose.yml` na raiz:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: publisher_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  broker:
    image: golang:1.21
    working_dir: /app
    volumes:
      - ./middleware:/app
    ports:
      - "9000:9000"
      - "9100:9100"
    command: go run ./cmd/broker -client-addr :9000 -peer-addr :9100

  backend:
    image: node:18-alpine
    working_dir: /app
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/publisher_db
      MIDDLEWARE_BROKERS: broker:9000
      PORT: 3000
    depends_on:
      - postgres
      - broker
    volumes:
      - ./backend:/app
    ports:
      - "3000:3000"
    command: sh -c "npm install && npm run prisma:migrate && npm run dev"

  frontend:
    image: node:18-alpine
    working_dir: /app
    volumes:
      - ./frontend:/app
    ports:
      - "5173:5173"
    command: sh -c "npm install && npm run dev"

volumes:
  postgres_data:
```

**Usar:**
```bash
docker-compose up -d

# Verificar logs
docker-compose logs -f backend

# Parar
docker-compose down
```

---

## 📦 Build para Produção

### Backend Build
```bash
cd backend

# Build TypeScript
npm run build

# Variáveis de ambiente para prod
cat > .env.production << EOF
DATABASE_URL=postgresql://user:pass@prod-db.com:5432/publisher_db
MIDDLEWARE_BROKERS=broker1.com:9000,broker2.com:9000
NODE_ENV=production
PORT=3000
EOF

# Deploy (exemplo com PM2)
pm2 start dist/index.js --name "publisher-backend"
```

---

### Frontend Build
```bash
cd frontend

# Build
npm run build

# Output: dist/
# Deploy em servidor estático (Netlify, Vercel, S3, etc.)
```

---

### Middleware Build (Go)
```bash
cd middleware

# Build binários
go build -o broker ./cmd/broker
go build -o publisher ./cmd/publisher
go build -o subscriber ./cmd/subscriber

# Deploy em servidor
./broker -client-addr :9000 -peer-addr :9100 -peers peer1:9100,peer2:9100
```

---

## 🔐 Segurança em Produção

### 1. Autenticação WebSocket
```typescript
// backend/src/index.ts
const io = new SocketIOServer(server, {
  cors: {origin: process.env.FRONTEND_URL},
  auth: {
    key: 'value'
  }
})

io.use((socket, next) => {
  const token = socket.handshake.auth.token
  if (!validateToken(token)) {
    return next(new Error('Authentication error'))
  }
  next()
})
```

### 2. Validação de Tópicos
```typescript
// backend/src/services/EventService.ts
async publishPostCreated(postData: any) {
  // Validar se usuário pode publicar neste tópico
  if (!userCanPublish(postData.topic_id)) {
    throw new Error('Unauthorized')
  }
  await this.client.publish('post_created', postData)
}
```

### 3. Rate Limiting
```typescript
// backend - instalar npm install express-rate-limit
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100 // 100 requests per 15 min
})

app.use('/api/posts', limiter)
app.use('/api/topics', limiter)
```

### 4. HTTPS/WSS
```typescript
// backend/src/index.ts - usar HTTPS
import https from 'https'
import fs from 'fs'

const options = {
  key: fs.readFileSync('/path/to/key.pem'),
  cert: fs.readFileSync('/path/to/cert.pem')
}

const server = https.createServer(options, app)
// ... rest do código
```

---

## 📊 Monitoramento & Logs

### Backend: Structured Logging
```typescript
// criar logger service
export class Logger {
  static info(component: string, message: string, data?: any) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      component,
      message,
      ...data
    }))
  }
}

// usar
Logger.info('EventService', 'Post published', {postId, topicId})
```

### Saída produção-pronta (JSON):
```json
{
  "timestamp": "2026-05-11T10:30:00.000Z",
  "level": "INFO",
  "component": "EventService",
  "message": "Post published",
  "postId": "uuid-123",
  "topicId": "uuid-456"
}
```

**Usar com ELK Stack:**
```bash
# Filebeat → Logstash → Elasticsearch → Kibana
```

---

## 🧪 Testes

### Backend: Unit Tests
```bash
# Instalar Jest
npm install --save-dev jest ts-jest @types/jest

# test/services/EventService.test.ts
describe('EventService', () => {
  it('should publish post event', async () => {
    const svc = new EventService()
    await svc.publishPostCreated({id: '123'})
    // assert
  })
})

# Rodar
npm test
```

### Frontend: Component Tests
```bash
# Instalar Vitest + React Testing Library
npm install --save-dev vitest react-testing-library

# test/hooks/useWebSocket.test.ts
describe('useWebSocket', () => {
  it('should connect to server', async () => {
    const {result} = renderHook(() => useWebSocket())
    await waitFor(() => {
      expect(result.current.wsConnected).toBe(true)
    })
  })
})

# Rodar
npm run test
```

---

## 🆘 Troubleshooting Avançado

### Debug: Broker não recebe mensagens

```bash
# Terminal extra: testar com Go client
cd middleware

# Publisher
go run ./cmd/publisher \
  -brokers localhost:9000 \
  -topic test_topic \
  -count 1

# Subscriber (em outro terminal)
go run ./cmd/subscriber \
  -brokers localhost:9000 \
  -topics test_topic
```

### Debug: WebSocket desconecta

```typescript
// backend/src/index.ts
io.on('connection', (socket) => {
  console.log(`[DEBUG] Socket ${socket.id} connected`)
  
  socket.on('error', (error) => {
    console.error(`[DEBUG] Socket ${socket.id} error:`, error)
  })
  
  socket.on('disconnect', (reason) => {
    console.log(`[DEBUG] Socket ${socket.id} disconnected: ${reason}`)
    // Motivos: 'client namespace disconnect', 'transport close', etc
  })
})
```

### Debug: Event não chega no Frontend

```typescript
// frontend/src/services/WebSocketService.ts
private handleMessage(msg: WireMessage) {
  console.log('[DEBUG] All messages:', msg) // Log tudo
  // ... rest do código
}
```

---

## 📈 Performance Tuning

### Backend Optimizações

1. **Connection pooling (Prisma)**
   ```env
   DATABASE_URL=postgresql://...?schema=public&connection_limit=20
   ```

2. **Compress responses**
   ```typescript
   import compression from 'compression'
   app.use(compression())
   ```

3. **Async event publishing (não bloqueia request)**
   ```typescript
   // Sem await - publica assincronamente
   eventService.publishPostCreated(post).catch(err => {
     console.error('Event publish failed:', err)
   })
   res.status(201).json(post)  // Retorna imediatamente
   ```

---

### Frontend Optimizações

1. **Lazy load components**
   ```typescript
   const PostList = lazy(() => import('./components/PostList'))
   ```

2. **Memoization**
   ```typescript
   const TopicForm = memo(({...}) => {...})
   ```

3. **Virtual scrolling (muitos posts)**
   ```bash
   npm install react-window
   ```

---

### Middleware (Go) Optimizações

1. **Increase buffer size**
   ```go
   client.send = make(chan []byte, 5000)  // Aumentar conforme carga
   ```

2. **Goroutine pool**
   ```go
   // middleware/internal/broker/pool.go
   type WorkerPool struct {
     workers int
     tasks chan Task
   }
   ```

---

## 🎯 Checklist de Deployment

- [ ] Variáveis de ambiente (.env) configuradas
- [ ] Database migrations rodadas (`npm run prisma:migrate`)
- [ ] CORS configurado para domínios corretos
- [ ] SSL/TLS ativado (HTTPS/WSS)
- [ ] Rate limiting ativado
- [ ] Autenticação implementada (JWT)
- [ ] Logs estruturados configurados
- [ ] Backup de database agendado
- [ ] Monitoramento (Datadog, New Relic, etc) ativado
- [ ] Testes passando (unit + integration)
- [ ] Load testing realizado (k6, Apache JMeter)

---

## 📞 Suporte & Links

- **Go Broker Docs**: https://golang.org/pkg/net/
- **Socket.IO Docs**: https://socket.io/docs/v4/
- **Prisma Docs**: https://www.prisma.io/docs/
- **React Docs**: https://react.dev

---

**Desenvolvido para operações em escala com confiabilidade** 🚀
