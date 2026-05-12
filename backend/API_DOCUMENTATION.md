# API Documentation

Documentação completa da API Publisher Node.js para gerenciamento de tópicos e publicações.

## Table of Contents

- [Autenticação](#autenticação)
- [Tipos de Dados](#tipos-de-dados)
- [Health & Status](#health--status)
- [Topics (Tópicos)](#topics-tópicos)
- [Posts (Publicações)](#posts-publicações)
- [Real-time Updates](#real-time-updates)
- [Tratamento de Erros](#tratamento-de-erros)

---

## Autenticação

❌ **Não há autenticação requerida**. A API é aberta ao público. Use o campo `author` na criação de posts para identificar o autor.

---

## Tipos de Dados

### Topic

```json
{
  "id": "uuid",
  "name": "string",
  "description": "string | null",
  "createdAt": "ISO 8601 timestamp",
  "posts": "Post[]"
}
```

### Post

```json
{
  "id": "uuid",
  "author": "string",
  "content": "string",
  "topicId": "uuid",
  "topic": "Topic",
  "createdAt": "ISO 8601 timestamp"
}
```

---

## Health & Status

### Health Check

Verifica se a API está respondendo.

```
GET /api/health
```

**Response (200 OK)**

```json
{
  "status": "ok",
  "timestamp": "2026-05-11T10:30:00.000Z"
}
```

### Database Connectivity

Verifica se a conexão com PostgreSQL está funcionando.

```
GET /api/db/ping
```

**Response (200 OK)**

```json
{
  "ok": true,
  "now": "2026-05-11T10:30:00.000Z"
}
```

---

## Topics (Tópicos)

### Criar um Tópico

Cria um novo tópico para classificação de publicações.

```
POST /api/topics
Content-Type: application/json
```

**Request Body**

```json
{
  "name": "Technology",
  "description": "Latest technology trends and news"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| name | string | ✅ Sim | Nome do tópico (máx. 255 caracteres) |
| description | string | ❌ Não | Descrição do tópico |

**Response (201 Created)**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Technology",
  "description": "Latest technology trends and news",
  "createdAt": "2026-05-11T10:30:00.000Z",
  "posts": []
}
```

**Error Responses**

- `400 Bad Request` — Campo `name` não fornecido ou inválido
- `500 Internal Server Error` — Erro no servidor

---

### Listar Todos os Tópicos

Obtém uma lista de todos os tópicos existentes (ordenados por data de criação descrescente).

```
GET /api/topics
```

**Response (200 OK)**

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Technology",
    "description": "Latest technology trends and news",
    "createdAt": "2026-05-11T10:30:00.000Z",
    "posts": [...]
  },
  {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "name": "Science",
    "description": null,
    "createdAt": "2026-05-11T10:25:00.000Z",
    "posts": []
  }
]
```

---

### Obter um Tópico Específico

Obtém detalhes de um tópico específico incluindo todas as suas publicações.

```
GET /api/topics/:id
```

**Parameters**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| id | uuid | ID do tópico |

**Response (200 OK)**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Technology",
  "description": "Latest technology trends and news",
  "createdAt": "2026-05-11T10:30:00.000Z",
  "posts": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "author": "John Doe",
      "content": "TypeScript is awesome!",
      "topicId": "550e8400-e29b-41d4-a716-446655440000",
      "createdAt": "2026-05-11T10:35:00.000Z"
    }
  ]
}
```

**Error Responses**

- `404 Not Found` — Tópico com ID fornecido não encontrado

---

### Deletar um Tópico

Remove um tópico e todas as suas publicações associadas (cascata).

```
DELETE /api/topics/:id
```

**Parameters**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| id | uuid | ID do tópico |

**Response (200 OK)**

```json
{
  "success": true,
  "message": "Topic deleted"
}
```

**Real-time Event**

Quando um tópico é deletado, um evento `topic:deleted` é publicado via WebSocket para todos os clientes conectados (ver [Real-time Updates](#real-time-updates)).

**Error Responses**

- `404 Not Found` — Tópico não encontrado

---

## Posts (Publicações)

### Criar uma Publicação

Cria uma nova publicação associada a um tópico.

```
POST /api/posts
Content-Type: application/json
```

**Request Body**

```json
{
  "author": "Alice Smith",
  "content": "This is my first post about TypeScript and its benefits for large-scale projects.",
  "topic_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| author | string | ✅ Sim | Nome do autor (máx. 255 caracteres) |
| content | string | ✅ Sim | Conteúdo da publicação |
| topic_id | uuid | ✅ Sim | ID do tópico ao qual a publicação pertence |

**Response (201 Created)**

```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "author": "Alice Smith",
  "content": "This is my first post about TypeScript...",
  "topicId": "550e8400-e29b-41d4-a716-446655440000",
  "topic": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Technology",
    "description": "Latest technology trends and news",
    "createdAt": "2026-05-11T10:30:00.000Z"
  },
  "createdAt": "2026-05-11T11:00:00.000Z"
}
```

**Error Responses**

- `400 Bad Request` — Campos obrigatórios ausentes
- `500 Internal Server Error` — Erro ao inserir no banco (ex: topic_id inválido)

---

### Listar Todas as Publicações

Obtém todas as publicações (ordenadas por data de criação descrescente).

```
GET /api/posts
```

**Response (200 OK)**

```json
[
  {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "author": "Alice Smith",
    "content": "This is my first post about TypeScript...",
    "topicId": "550e8400-e29b-41d4-a716-446655440000",
    "topic": {...},
    "createdAt": "2026-05-11T11:00:00.000Z"
  },
  {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "author": "Bob Johnson",
    "content": "Using Prisma makes database interactions easier...",
    "topicId": "550e8400-e29b-41d4-a716-446655440000",
    "topic": {...},
    "createdAt": "2026-05-11T10:55:00.000Z"
  }
]
```

---

### Obter uma Publicação Específica

Obtém detalhes de uma publicação específica.

```
GET /api/posts/:id
```

**Parameters**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| id | uuid | ID da publicação |

**Response (200 OK)**

```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "author": "Alice Smith",
  "content": "This is my first post about TypeScript...",
  "topicId": "550e8400-e29b-41d4-a716-446655440000",
  "topic": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Technology",
    "description": "Latest technology trends and news",
    "createdAt": "2026-05-11T10:30:00.000Z"
  },
  "createdAt": "2026-05-11T11:00:00.000Z"
}
```

**Error Responses**

- `404 Not Found` — Publicação não encontrada

---

### Listar Publicações por Tópico

Obtém todas as publicações de um tópico específico.

```
GET /api/posts/topic/:topicId
```

**Parameters**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| topicId | uuid | ID do tópico |

**Response (200 OK)**

```json
[
  {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "author": "Alice Smith",
    "content": "This is my first post about TypeScript...",
    "topicId": "550e8400-e29b-41d4-a716-446655440000",
    "topic": {...},
    "createdAt": "2026-05-11T11:00:00.000Z"
  }
]
```

**Nota:** Se não há publicações, a resposta será um array vazio `[]`.

---

### Deletar uma Publicação

Remove uma publicação específica.

```
DELETE /api/posts/:id
```

**Parameters**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| id | uuid | ID da publicação |

**Response (200 OK)**

```json
{
  "success": true,
  "message": "Post deleted"
}
```

**Real-time Event**

Quando uma publicação é deletada, um evento `post:deleted` é publicado via WebSocket para todos os clientes conectados (ver [Real-time Updates](#real-time-updates)).

**Error Responses**

- `404 Not Found` — Publicação não encontrada

---

## Real-time Updates

A API suporta atualizações em tempo real via WebSocket. Quando qualquer cliente cria ou deleta um recurso, todos os outros clientes conectados recebem notificações instantaneamente.

### Eventos Disponíveis

#### `post:created`
Dispara quando um novo post é criado.

```javascript
interface PostEvent {
  id: string
  author: string
  content: string
  topic_id: string
  created_at: string
}

socket.on('post:created', (post: PostEvent) => {
  console.log(`${post.author} criou um novo post`);
})
```

#### `post:deleted`
Dispara quando um post é deletado.

```javascript
socket.on('post:deleted', (post: PostEvent) => {
  console.log(`Post de ${post.author} foi removido`);
})
```

#### `topic:created`
Dispara quando um novo tópico é criado.

```javascript
interface TopicEvent {
  id: string
  name: string
  description?: string
  created_at: string
}

socket.on('topic:created', (topic: TopicEvent) => {
  console.log(`Novo tópico: ${topic.name}`);
})
```

#### `topic:deleted`
Dispara quando um tópico é deletado.

```javascript
socket.on('topic:deleted', (topic: TopicEvent) => {
  console.log(`Tópico ${topic.name} foi removido`);
})
```

### Como Usar

```javascript
import { io } from 'socket.io-client'

const socket = io('http://localhost:3000')

socket.on('connect', () => {
  console.log('Connected to backend')
  
  // Subscribe to posts updates
  socket.emit('subscribe:posts')
  
  // Subscribe to topics updates
  socket.emit('subscribe:topics')
})

socket.on('post:created', (post) => {
  console.log('Novo post:', post)
})

socket.on('post:deleted', (post) => {
  console.log('Post deletado:', post.id)
})

socket.on('topic:created', (topic) => {
  console.log('Novo tópico:', topic)
})

socket.on('topic:deleted', (topic) => {
  console.log('Tópico deletado:', topic.id)
})
```

---

## Tratamento de Erros

A API retorna erros no seguinte formato:

```json
{
  "error": "Mensagem descritiva do erro"
}
```

### Códigos de Status HTTP

| Código | Significado |
|--------|-------------|
| 200 | OK — Requisição bem-sucedida |
| 201 | Created — Recurso criado com sucesso |
| 400 | Bad Request — Requisição inválida |
| 404 | Not Found — Recurso não encontrado |
| 500 | Internal Server Error — Erro no servidor |

---

## Exemplos com cURL

### Criar um tópico

```bash
curl -X POST http://localhost:3000/api/topics \
  -H "Content-Type: application/json" \
  -d '{"name":"Tech News","description":"Latest in technology"}'
```

### Listar todos os tópicos

```bash
curl http://localhost:3000/api/topics
```

### Criar uma publicação

```bash
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -d '{"author":"Jane Doe","content":"Great article!","topic_id":"<TOPIC_UUID>"}'
```

### Listar publicações de um tópico

```bash
curl http://localhost:3000/api/posts/topic/<TOPIC_UUID>
```

### Deletar uma publicação

```bash
curl -X DELETE http://localhost:3000/api/posts/<POST_UUID>
```

---

## Rate Limiting

Atualmente, não há rate limiting implementado. Para produção, considere adicionar middleware como `express-rate-limit`.

## CORS

CORS não está habilitado por padrão. Para habilitar, adicione middleware cors ao `src/app.ts`:

```typescript
import cors from "cors";

app.use(cors());
```
