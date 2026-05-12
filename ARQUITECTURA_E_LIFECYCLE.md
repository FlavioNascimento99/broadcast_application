# 📊 Arquitetura e Lifecycle da Integração Middleware Pub/Sub

## 📋 Índice
1. [Visão Geral da Arquitetura](#visão-geral-da-arquitetura)
2. [Fluxo de Dados e Lifecycle](#fluxo-de-dados-e-lifecycle)
3. [Componentes Técnicos](#componentes-técnicos)
4. [Guia de Implementação](#guia-de-implementação)
5. [Troubleshooting](#troubleshooting)

---

## 🏗️ Visão Geral da Arquitetura

### Topologia de Rede

```
┌─────────────┐                    ┌──────────────┐
│   Frontend  │◄────WebSocket──────►│   Backend    │
│  (React)    │                    │  (Node.js)   │
└─────────────┘                    └──────────────┘
                                           │
                                    TCP (Port 9000)
                                           │
                                           ▼
┌────────────────────────────────────────────────────────────────┐
│              Middleware Pub/Sub (Go)                            │
├────────────────────────────────────────────────────────────────┤
│  ┌────────────┐  ┌────────────┐  ┌──────────────┐             │
│  │  Broker    │  │  Topics    │  │  Subscribers │             │
│  │ (Manager)  │  │   (Maps)   │  │   (Queue)    │             │
│  └────────────┘  └────────────┘  └──────────────┘             │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │        Protocolo JSON Line-Delimited                     │  │
│  │  • subscribe    • publish    • unsubscribe              │  │
│  │  • ack          • event      • error                    │  │
│  └─────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              Peer-to-Peer Mesh                         │   │
│  │     (Broker replication & failover)                    │   │
│  └────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
                           │
                    ┌──────┴──────┐
                    ▼             ▼
              ┌─────────┐    ┌─────────┐
              │ Broker 1│    │ Broker 2│
              │ :9000   │    │ :9001   │
              └─────────┘    └─────────┘
```

---

## 🔄 Fluxo de Dados e Lifecycle

### 1️⃣ Inicialização da Aplicação

#### Backend
```
1. app.listen() (server HTTP)
   │
   ├─► server = http.createServer(app)
   │
   ├─► io = new SocketIOServer(server) 
   │   └─► Configurar CORS para frontend
   │
   ├─► eventService = getEventService()
   │   └─► eventService.initialize()
   │       └─► MiddlewareClient.connect()
   │           ├─► Conectar a localhost:9000 (ou MIDDLEWARE_BROKERS)
   │           ├─► Listener: 'connected', 'disconnected', 'event', 'error'
   │           └─► Retry automático a cada 5000ms se falhar
   │
   ├─► Listener: io.on('connection') 
   │   └─► Quando frontend conecta via WebSocket
   │
   └─► server.listen(3000)
       └─► Aguardando conexões de clientes
```

#### Frontend
```
1. App.mount() → App.tsx
   │
   └─► useWebSocket() hook
       ├─► getWebSocketService()
       │   └─► MiddlewareClient.connect('http://localhost:3000')
       │
       ├─► Listener: 'connected', 'disconnected', 'middleware:connected'
       │
       └─► subscribeToPostEvents() + subscribeToTopicEvents()
           ├─► ws.emit('subscribe:posts')
           └─► ws.emit('subscribe:topics')
```

---

### 2️⃣ Fluxo: Criar um novo Post

#### Sequência Completa (Happy Path)

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: Usuário clica "Publish Post"                           │
└─────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│ PostForm.handleSubmit()                                          │
│ • Valida inputs (author, content, topic_id)                     │
│ • Prepara payload: {author, content, topic_id}                  │
└─────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│ POST /api/posts (HTTP)                                           │
│ Content-Type: application/json                                  │
│ Body: {author, content, topic_id}                               │
└─────────────────────────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────────────────────┐
│ BACKEND: routes/posts.ts → router.post('/')                      │
│                                                                   │
│ 1. Valida body (author, content, topic_id required)              │
│                                                                   │
│ 2. PostRepository.create({author, content, topic_id})            │
│    └─► Prisma insert into posts table                            │
│        └─► Gera ID (UUID), created_at (timestamp)                │
│                                                                   │
│ 3. EventService.publishPostCreated({id, author, content, ...})   │
│    └─► MiddlewareClient.publish('post_created', payload)         │
│        └─► Serializa para JSON                                   │
│        └─► Envia via TCP ao broker: ":9000"                      │
│            JSON: {                                               │
│              "type": "publish",                                  │
│              "topic": "post_created",                            │
│              "payload": {data...},                               │
│              "req_id": "req_1234567890"                          │
│            }                                                     │
│                                                                   │
│ 4. Aguarda ACK do broker (timeout: 30s)                          │
│    └─► Broker retorna: {type: "ack", status: "delivered|...", req_id}  │
│                                                                   │
│ 5. res.status(201).json(post)                                    │
│    └─► Retorna post criado ao frontend                          │
└──────────────────────────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────────────────────┐
│ MIDDLEWARE BROKER (Go): :9000                                    │
│                                                                   │
│ 1. Recebe mensagem de publish do backend                         │
│    {type: "publish", topic: "post_created", payload: {...}}     │
│                                                                   │
│ 2. Lookup topic em topics map                                    │
│    └─► if !exists: criar novo topic("post_created")             │
│                                                                   │
│ 3. Busca subscribers para "post_created" topic                   │
│    ├─► Frontend WebSocket subscribers?                           │
│    │   └─► SIM: envia evento {type: "event", payload: {...}}    │
│    │   └─► NÃO: descarta mensagem, status = "discarded"         │
│    │                                                              │
│    └─► Retorna ACK: {type: "ack", status: "delivered", req_id}   │
│                                                                   │
│ 4. Se mesh de brokers: replicar em peers                         │
│    └─► Conectados em :9100, :9101, etc.                         │
│        └─► peer_publish message                                  │
└──────────────────────────────────────────────────────────────────┘
              │
              ├─────────────────────────┐
              │                         │
              ▼                         ▼
┌─────────────────────────────────┐  ┌──────────────────────────────┐
│ FRONTEND WebSocket Listener      │  │ BACKEND Listener             │
│                                  │  │ (Backend já subscrito)       │
│ io.on('post:created')            │  │                              │
│                                  │  │ EventService.on('event')     │
│ 1. Recebe evento do broker       │  │ 1. Filtra topic == "post_created" │
│    {data: post}                  │  │ 2. io.to('posts').emit(...)  │
│                                  │  │    └─► Retransmite para todos│
│ 2. Callback: onPostCreated()     │  │        que estão em 'posts'  │
│    setPostsRefresh((p)=>p+1)     │  │        (só frontend ouve)    │
│                                  │  │                              │
│ 3. PostList.useEffect           │  │                              │
│    └─► Trigger refetch de posts │  │                              │
│        GET /api/posts           │  │                              │
│                                  │  │                              │
│ 4. UI atualiza com novo post    │  │ Logs: "[Index] Broadcasting"│
└─────────────────────────────────┘  └──────────────────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│ FRONTEND: PostList re-renderiza  │
│                                  │
│ • Nova linha com post criado      │
│ • Animação/highlight opcional     │
│ • Notificação de sucesso         │
└─────────────────────────────────┘
```

---

### 3️⃣ Fluxo: Subscriber Recebe Evento

```
┌──────────────────────────────────────────────────────────┐
│ Frontend conecta via WebSocket                           │
│ socket.emit('subscribe:posts')                           │
└──────────────────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────────────┐
│ Backend: io.on('connection')                             │
│                                                           │
│ socket.on('subscribe:posts') {                           │
│   socket.join('posts')  // room de broadcasts            │
│   eventService.subscribeToPostCreated()                  │
│   eventService.subscribeToPostDeleted()  // ← Novo v2    │
│   └─► MiddlewareClient.subscribe('post_created')         │
│   └─► MiddlewareClient.subscribe('post_deleted')  ← Novo │
│       └─► Envia: {type: "subscribe", topic: "post_*"}    │
│       └─► Aguarda ACK                                    │
│           └─► Broker registra subscribers                │
│           └─► Agora envia eventos para este cliente      │
│ }                                                         │
└──────────────────────────────────────────────────────────┘
```

---

### 4️⃣ Fluxo: Deletar um Post (NEW v2)

#### Sequência Completa (Happy Path)

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: Usuário clica "Delete Post"                           │
└─────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│ DELETE /api/posts/:id (HTTP)                                    │
└─────────────────────────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────────────────────┐
│ BACKEND: routes/posts.ts → router.delete('/:id')                 │
│                                                                   │
│ 1. Valida parâmetro id                                           │
│                                                                   │
│ 2. const post = await PostRepository.findById(id)                │
│    └─► Recupera dados ANTES de deletar (para event)              │
│                                                                   │
│ 3. const deleted = await PostRepository.delete(id)               │
│    └─► Prisma delete from posts where id=...                    │
│                                                                   │
│ 4. if (post) {                                                   │
│      EventService.publishPostDeleted({id, author, content, ...})│
│      └─► MiddlewareClient.publish('post_deleted', payload)       │
│          └─► Serializa para JSON                                 │
│          └─► Envia via TCP ao broker: ":9000"                    │
│              JSON: {                                             │
│                "type": "publish",                                │
│                "topic": "post_deleted",  ← Novo event type      │
│                "payload": {id, author, content, ...},            │
│                "req_id": "req_1234567890"                        │
│              }                                                   │
│                                                                   │
│ 5. Aguarda ACK do broker (timeout: 30s)                          │
│    └─► Broker retorna: {type: "ack", status: "delivered"}       │
│                                                                   │
│ 6. res.json({ success: true, message: "Post deleted" })          │
└──────────────────────────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────────────────────┐
│ MIDDLEWARE BROKER (Go): :9000                                    │
│                                                                   │
│ 1. Recebe mensagem de publish do backend                         │
│    {type: "publish", topic: "post_deleted", payload: {...}}     │
│                                                                   │
│ 2. Lookup topic "post_deleted" em topics map                     │
│    └─► if !exists: criar novo topic                             │
│                                                                   │
│ 3. Busca subscribers para "post_deleted"                         │
│    ├─► Encontra frontend subscribers                            │
│    │   └─► Envia a cada um: {type: "event", payload: {...}}    │
│    │                                                              │
│    └─► Retorna ACK: {type: "ack", status: "delivered"}          │
└──────────────────────────────────────────────────────────────────┘
              │
              ├─────────────────────────────┐
              │                             │
              ▼                             ▼
┌─────────────────────────────────┐  ┌──────────────────────────────┐
│ FRONTEND WebSocket Listener      │  │ BACKEND Listener             │
│                                  │  │ (Backend já subscrito)       │
│ socket.on('post:deleted')        │  │                              │
│                                  │  │ EventService.on('event')     │
│ 1. Recebe evento do broker       │  │ 1. Filtra topic=="post_del"  │
│    {data: post}                  │  │ 2. io.to('posts').emit(...)  │
│                                  │  │    └─► Retransmite para      │
│ 2. Callback: onPostChange()      │  │        subscribers           │
│    setPostsRefresh((p)=>p+1)     │  │                              │
│                                  │  │ Logs: "[Index] Broadcasting" │
│ 3. PostList.useEffect            │  │       event.topic            │
│    └─► Trigger refetch de posts │  │                              │
│        GET /api/posts           │  │                              │
│                                  │  │                              │
│ 4. UI atualiza: remove post      │  │                              │
└─────────────────────────────────┘  └──────────────────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│ FRONTEND: PostList re-renderiza  │
│                                  │
│ • Post removido da lista          │
│ • Animação de remoção opcional    │
│ • Notificação de sucesso         │
└─────────────────────────────────┘
```

**Diferenças vs Criação:**
- Primeiro: Retrieve dados do recurso deletado
- Depois: Deletar do banco
- Último: Publicar evento com dados do deletado
- Frontend dispara refresh (mesma funcionalidade que criação)

---

## 🛠️ Componentes Técnicos

### Backend Arquitetura

#### 1. **MiddlewareClient.ts**
Responsável pela comunicação TCP com o broker Go.

```typescript
class MiddlewareClient extends EventEmitter {
  // Conexão TCP
  private conn: net.Socket | null = null
  private brokers: string[] = ['localhost:9000']
  
  // Manage pending requests
  private pending = new Map<string, PendingRequest>()
  
  // Buffer para mensagens line-delimited
  private buffer = ''
  
  async connect()
    - Conecta ao broker
    - Setup listeners: 'data', 'error', 'close'
    - Retry automático (5s interval)
  
  async publish(topic, payload)
    - Cria req_id único
    - Envia JSON ao broker
    - Aguarda ACK (timeout 30s)
  
  async subscribe(topic)
    - Envia "subscribe" message
    - Registra subscription internally
    - Aguarda ACK
  
  private handleData(chunk)
    - Acumula bytes em buffer
    - Split por '\n' (JSON line-delimited)
    - Parse JSON, chama handleMessage()
  
  private handleMessage(msg)
    - Se type="ack": resolve pending request
    - Se type="event": emit('event', ...)
    - Se type="error": reject pending request
}
```

#### 2. **EventService.ts**
Camada de abstração para eventos da aplicação.

```typescript
class EventService extends EventEmitter {
  private client: MiddlewareClient
  
  async initialize()
    - Conecta ao middleware
    - Setup event listeners
  
  async publishPostCreated(postData)
    - client.publish('post_created', {...})
  
  async publishTopicCreated(topicData)
    - client.publish('topic_created', {...})
  
  async subscribeToPostCreated()
    - client.subscribe('post_created')
  
  async subscribeToTopicCreated()
    - client.subscribe('topic_created')
}
```

#### 3. **index.ts** (Server Entry Point)
Integração de HTTP, Socket.IO e Event Service.

```typescript
const server = http.createServer(app)
const io = new SocketIOServer(server, {cors: {...}})

// Listen for Socket.IO connections
io.on('connection', (socket) => {
  socket.on('subscribe:posts', () => {
    socket.join('posts')
    eventService.subscribeToPostCreated()
  })
  socket.on('subscribe:topics', () => {
    socket.join('topics')
    eventService.subscribeToTopicCreated()
  })
})

// Listen for Middleware events and broadcast
eventService.on('event', (event) => {
  if (event.topic === 'post_created') {
    io.to('posts').emit('post:created', event.data)
  }
  if (event.topic === 'topic_created') {
    io.to('topics').emit('topic:created', event.data)
  }
})
```

#### 4. **routes/posts.ts** e **routes/topics.ts**
Publicam eventos ao middleware quando recursos são criados.

```typescript
router.post('/', async (req, res, next) => {
  const post = await PostRepository.create({...})
  
  // Publish event
  const eventService = getEventService()
  if (eventService.isInitialized()) {
    await eventService.publishPostCreated({
      id: post.id,
      author: post.author,
      ...
    })
  }
  
  res.status(201).json(post)
})
```

---

### Frontend Arquitetura

#### 1. **WebSocketService.ts**
Cliente Socket.IO para comunicação com backend.

```typescript
class WebSocketService extends EventEmitter {
  private socket: Socket | null = null
  private connected = false
  private subscriptions = new Set<string>()
  
  async connect()
    - io('http://localhost:3000', {...})
    - Listeners: 'connect', 'disconnect', 'post:created', 'topic:created'
    - Retry com backoff exponencial
  
  subscribeToPosts()
    - socket.emit('subscribe:posts')
    - listeners.add('posts')
  
  subscribeToTopics()
    - socket.emit('subscribe:topics')
    - listeners.add('topics')
  
  on('post:created', callback)
    - Quando broker envia novo post
  
  on('topic:created', callback)
    - Quando broker envia novo tópico
}
```

#### 2. **hooks/useWebSocket.ts**
Hook React para integrar WebSocket na aplicação.

```typescript
function useWebSocket() {
  const [wsConnected, setWsConnected] = useState(false)
  const [middlewareConnected, setMiddlewareConnected] = useState(false)
  
  useEffect(() => {
    const ws = getWebSocketService()
    ws.on('connected', () => setWsConnected(true))
    ws.on('middleware:connected', () => setMiddlewareConnected(true))
    ws.connect().catch(...)
  }, [])
  
  const subscribeToPostEvents = (callback) => {
    ws.subscribeToPosts()
    ws.on('post:created', callback)
    return () => ws.removeListener(...)
  }
  
  return {wsConnected, middlewareConnected, subscribeToPostEvents, ...}
}
```

#### 3. **App.tsx**
Usa WebSocket para atualizar UI em tempo real.

```typescript
function App() {
  const {wsConnected, subscribeToPostEvents} = useWebSocket()
  
  useEffect(() => {
    if (wsConnected) {
      const unsubscribe = subscribeToPostEvents(() => {
        setPostsRefresh(p => p + 1)  // Trigger re-fetch
      })
      return unsubscribe
    }
  }, [wsConnected])
  
  return (
    <div>
      {wsConnected && <p>🔴 Real-time updates enabled</p>}
      <TopicList refreshTrigger={topicsRefresh} />
    </div>
  )
}
```

---

## 📦 Guia de Implementação

### Pré-requisitos
- Node.js 18+
- Go 1.21+ (middleware)
- PostgreSQL 12+

### Instalação Step-by-Step

#### 1. Backend
```bash
cd backend

# Instalar dependências (incluindo socket.io)
npm install

# Configurar .env
cat > .env << EOF
DATABASE_URL=postgresql://postgres:password@localhost:5432/publisher_db
MIDDLEWARE_BROKERS=localhost:9000
NODE_ENV=development
PORT=3000
EOF

# Iniciar servidor
npm run dev
```

**Saída esperada:**
```
API listening on port 3000
[Index] Event service initialized
[MiddlewareClient] Connecting to broker: localhost:9000
[MiddlewareClient] Connected to broker: localhost:9000
```

#### 2. Middleware (Go)
```bash
cd middleware

# Terminal A: Broker 1
go run ./cmd/broker -client-addr :9000 -peer-addr :9100 -peers localhost:9101

# Terminal B: Broker 2 (opcional, para mesh)
go run ./cmd/broker -client-addr :9001 -peer-addr :9101 -peers localhost:9100
```

**Saída esperada:**
```
Broker listening for clients on :9000
Broker listening for peers on :9100
```

#### 3. Frontend
```bash
cd frontend

# Instalar dependências (incluindo socket.io-client)
npm install

# Iniciar dev server
npm run dev
```

**Saída esperada:**
```
  VITE v5.1.0  ready in 234 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h + enter to show help
```

#### 4. Testar Fluxo Completo

```bash
# 1. Acessar frontend
open http://localhost:5173

# 2. Criar um tópico (POST /api/topics)
# Frontend: TopicForm → "Create New Topic"

# 3. Verificar logs
Backend console: "[EventService] Topic created event published: ok"
Middleware console: "client subscribed to topic_created"

# 4. Criar um post
# Frontend: PostList → "New Post in ..." → PublishPost

# 5. Observar atualizações em tempo real
# Novos posts devem aparecer instantaneamente (WebSocket event)
```

---

## 🔍 Message Protocol (JSON Line-Delimited)

### Cliente → Broker

#### Subscribe
```json
{
  "type": "subscribe",
  "topic": "post_created",
  "req_id": "req_1234567890"
}
```

#### Publish
```json
{
  "type": "publish",
  "topic": "post_created",
  "payload": {
    "id": "uuid",
    "author": "João",
    "content": "Hello",
    "topic_id": "uuid",
    "created_at": "2026-05-11T10:30:00Z"
  },
  "req_id": "req_1234567891"
}
```

#### Unsubscribe
```json
{
  "type": "unsubscribe",
  "topic": "post_created",
  "req_id": "req_1234567892"
}
```

### Broker → Cliente

#### ACK
```json
{
  "type": "ack",
  "action": "publish",
  "topic": "post_created",
  "status": "delivered",
  "req_id": "req_1234567891"
}
```

#### Event (para subscribers)
```json
{
  "type": "event",
  "topic": "post_created",
  "payload": {
    "id": "uuid",
    "author": "João",
    ...
  }
}
```

#### Error
```json
{
  "type": "error",
  "message": "Topic not found",
  "req_id": "req_1234567891"
}
```

---

## 🐛 Troubleshooting

### ❌ Backend não conecta ao Middleware

**Erro:**
```
[MiddlewareClient] Connection error: ECONNREFUSED
```

**Solução:**
1. Verificar se Go broker está rodando
   ```bash
   go run ./cmd/broker -client-addr :9000
   ```
2. Verificar porta
   ```bash
   lsof -i :9000  # macOS/Linux
   netstat -ano | findstr :9000  # Windows
   ```
3. Verificar MIDDLEWARE_BROKERS em .env
   ```
   MIDDLEWARE_BROKERS=localhost:9000
   ```

---

### ❌ Frontend não recebe eventos em tempo real

**Erro:**
```
[WebSocket] Not connected, cannot subscribe to posts
```

**Solução:**
1. Verificar WebSocket connection
   - Browser DevTools → Network → WS
   - Deve mostrar `ws://localhost:3000/socket.io/?...`
2. Verificar Backend logs
   ```
   [Socket.IO] Client connected: socket_id
   ```
3. Verificar cors em index.ts
   ```typescript
   origin: ['http://localhost:3001', 'http://127.0.0.1:3001']
   ```

---

### ❌ Posts criados mas não aparecem no broker

**Debug:**
```bash
# 1. Verificar logs do Backend
npm run dev

# 2. Verificar se EventService está inicializado
[Index] Event service initialized

# 3. Verificar conexão com broker
[MiddlewareClient] Connected to broker: localhost:9000

# 4. Testar manualmente
cd middleware
go run ./cmd/publisher -brokers localhost:9000 -topic post_created

# 5. Testar subscriber
go run ./cmd/subscriber -brokers localhost:9000 -topics post_created
```

---

### ⚠️ Performance: Muitos eventos

Se há muitos eventos por segundo:

1. **Aumentar buffer de mensagens**
   ```go
   // middleware/internal/broker/broker.go
   client.send = make(chan []byte, 1000)  // default: 100
   ```

2. **Batch processing no frontend**
   ```typescript
   // useWebSocket.ts
   const [eventBatch, setEventBatch] = useState<PostEvent[]>([])
   
   const timer = setInterval(() => {
     if (eventBatch.length > 0) {
       setPostsRefresh(p => p + 1)
       setEventBatch([])
     }
   }, 5000)  // Aguarda 5s antes de atualizar
   ```

3. **Compressão de mensagens**
   ```typescript
   // MiddlewareClient.ts
   socket.setEncoding('utf8')  // Já usa by default
   ```

---

### 📊 Monitoração

#### Healthcheck da integração

```bash
# Backend health
curl http://localhost:3000/api/health/check

# Middleware health (do Backend)
curl http://localhost:3000/api/health/middleware
# (não implementado por padrão, mas possível adicionar)
```

#### Logs estruturados

```typescript
// Backend
console.log('[MiddlewareClient]', message)
console.log('[EventService]', message)
console.log('[Socket.IO]', message)
console.log('[Index]', message)

// Frontend
console.log('[WebSocket]', message)
console.log('[useWebSocket]', message)
```

---

## 🚀 Próximas Melhorias

1. **Persistência de eventos**
   - Guardar eventos em queue se broker cair
   - Replay de eventos quando broker volta online

2. **Autenticação**
   - JWT token em Socket.IO handshake
   - Validar topics por usuário

3. **Compression**
   - gzip para payloads grandes
   - msgpack em vez de JSON

4. **Metrics**
   - Prometheus exporter
   - Dashboard Grafana

5. **Multi-tenant**
   - Isolamento de topics por workspace
   - Broadcast apenas para usuários autorizados

---

## 📝 Resumo

| Componente | Linguagem | Responsabilidade |
|-----------|-----------|------------------|
| **Frontend** | TypeScript/React | UI + WebSocket client |
| **Backend** | TypeScript/Node.js | API REST + WebSocket server + Middleware client |
| **Middleware** | Go | Broker Pub/Sub distribuído |
| **DB** | PostgreSQL | Persistência de dados |

**Fluxo Principal:**
```
User Action → Frontend → Backend API (REST) → PostgreSQL (persistência)
                            ↓
                      EventService.publish()
                            ↓
                      MiddlewareClient.publish() (TCP)
                            ↓
                      Broker Go (:9000)
                            ↓
                      EventService.subscribe() (listeners)
                            ↓
                      io.emit() → WebSocket
                            ↓
                      Frontend (WebSocket listener)
                            ↓
                      useEffect refresh + Re-render
```

---

**Desenvolvido com ❤️ para comunicação em tempo real de alta performance**
