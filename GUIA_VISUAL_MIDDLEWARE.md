# 🔍 Guia Visual: Verificar se o Middleware está Funcionando

## 📍 Indicadores Visuais - Frontend

Quando você abrir `http://localhost:5173`, haverá 3 indicadores no canto inferior direito:

### 1️⃣ **Status Dashboard** (canto inferior direito)

```
┌─────────────────────────────────────┐
│  🔍 Middleware Status               │
├─────────────────────────────────────┤
│                                     │
│ WebSocket: ● Connected              │
│ localhost:3000                      │
│                                     │
│ Middleware Broker: ● Online         │
│ localhost:9000                      │
│                                     │
│ Real-time Events: 0                 │
│ Last event: -                       │
│                                     │
│ ✅ Everything OK                    │
│                                     │
│ 📍 Frontend: localhost:5173         │
│ 🔗 Backend: localhost:3000          │
│ 🎯 Broker: localhost:9000           │
└─────────────────────────────────────┘
```

### 2️⃣ **Console Logger** (canto inferior esquerdo)

```
┌─────────────────────────────────────┐
│ ▼ Show Console (5)                  │
├─────────────────────────────────────┤
│ [10:30:45] [WebSocket] Connecting   │
│ [10:30:46] [WebSocket] Connected    │
│ [10:30:47] [useWebSocket] Connected │
│ [10:30:50] [WebSocket] Subscribed   │
│ [10:30:52] [WebSocket] Event: post  │
└─────────────────────────────────────┘
```

---

## 🎨 Cores e Estados

### WebSocket Status (Backend Connection)
| Cor | Estado | Significado |
|-----|--------|-------------|
| 🟢 Verde com pulse | Connected | Backend respondendo |
| 🔴 Rosa | Disconnected | Backend offline |

### Middleware Status (Broker Connection)
| Cor | Estado | Significado |
|-----|--------|-------------|
| 🟢 Verde com pulse | Online | Broker Go rodando |
| 🟡 Amarelo com pulse | Connecting... | Tentando conectar |
| 🔴 Rosa | Offline | Broker não respondendo |

### Overall Status
| Emoji | Status | Significado |
|-------|--------|-------------|
| ✅ | Everything OK | Tudo funcionando |
| ⚠️ | Middleware offline | Backend ok, mas broker caiu |
| ❌ | Backend disconnected | Frontend não consegue alcançar backend |

---

## 🧪 Teste Passo a Passo

### Setup Inicial
```bash
# Terminal 1: Middleware
cd middleware
go run ./cmd/broker -client-addr :9000

# Terminal 2: Backend
cd backend
npm run dev

# Terminal 3: Frontend
cd frontend
npm run dev

# Abrir browser
open http://localhost:5173
```

### O que observar:

#### Segundos 0-5
```
Status Dashboard deve mostrar:
❌ WebSocket: Disconnected
⚠️ Middleware Broker: Connecting...
```

#### Segundos 5-10
```
Status Dashboard deve mostrar:
✅ WebSocket: Connected (animação de pulse)
```

#### Segundos 10-15
```
Status Dashboard deve mostrar:
✅ Middleware Broker: Online (animação de pulse)
✅ Everything OK
```

#### Console Logger deve mostrar:
```
[HH:MM:SS] [WebSocket] Connecting to: http://localhost:3000
[HH:MM:SS] [WebSocket] Connected
[HH:MM:SS] [useWebSocket] Connected
[HH:MM:SS] [MiddlewareClient] Connecting to broker: localhost:9000
[HH:MM:SS] [MiddlewareClient] Connected to broker: localhost:9000
[HH:MM:SS] [EventService] Subscribed to post_created
[HH:MM:SS] [EventService] Subscribed to topic_created
```

---

## ✅ Teste: Criar um Tópico

### Ação
Frontend → TopicForm → Digite "test-topic" → Clique "Create Topic"

### O que observar em tempo real:

**Status Dashboard:**
- `Real-time Events` incrementa de 0 → 1
- `Last event` mostra hora atual

**Console Logger:**
```
[HH:MM:SS] [EventService] Topic created event published: ok
[HH:MM:SS] [Index] Broadcasting event: topic_created
[HH:MM:SS] [WebSocket] Topic created: {id: "...", name: "test-topic"}
[HH:MM:SS] [useWebSocket] Connected
```

**Visual:**
- Tópico aparece na lista **instantaneamente** ✅
- Sem refresh manual necessário

---

## ✅ Teste: Criar um Post

### Ação
1. Clique no tópico criado
2. TopicForm → Digite author e content → Clique "Publish Post"

### O que observar:

**Status Dashboard:**
- `Real-time Events` incrementa novamente
- `Last event` atualiza

**Console Logger:**
```
[HH:MM:SS] [EventService] Post created event published: ok
[HH:MM:SS] [Index] Broadcasting event: post_created
[HH:MM:SS] [WebSocket] Post created: {id: "...", author: "João"}
```

**Visual:**
- Post aparece na lista **em < 200ms** ✅
- Animação pode piscar (indicando atualização)

---

## 🔗 Teste: Multi-cliente (Abrir 2 abas)

### Ação
1. Aba A: `http://localhost:5173` (aberta)
2. Aba B: `http://localhost:5173` (nova aba)
3. Aba A: Criar novo post
4. Aba B: Verificar se aparece

### Esperado:
- Post criado em Aba A aparece em Aba B **instantaneamente** ✅
- Sem polling necessário
- Ambas mostram mesmo `Real-time Events` count

---

## ❌ Troubleshooting Visual

### Cenário 1: WebSocket conectado, mas Middleware offline

```
Status: WebSocket ✅ Connected
        Middleware ⚠️ Connecting...

Console: [WebSocket] Connected
         [MiddlewareClient] Connection error: ECONNREFUSED

Solução: Verificar se Go broker está rodando
cd middleware
go run ./cmd/broker -client-addr :9000
```

### Cenário 2: Nenhum WebSocket

```
Status: WebSocket ❌ Disconnected
        Middleware ❌ Offline

Console: [WebSocket] Connection error: ERR_CONNECTION_REFUSED

Solução: Verificar se backend está rodando
cd backend
npm run dev
```

### Cenário 3: Evento não chega no frontend

```
Status: Tudo verde ✅

Console mostra:
[EventService] Topic created event published: discarded

Significado: Ninguém subscrito no broker

Solução: Verificar se frontend clicou em "Create Post" (isso faz subscribe)
```

---

## 📊 Exemplo de Logs Completos

### Session Bem-sucedida
```
[10:30:45] [WebSocket] Connecting to: http://localhost:3000
[10:30:46] [WebSocket] Connected
[10:30:46] [useWebSocket] Connected
[10:30:47] [MiddlewareClient] Connecting to broker: localhost:9000
[10:30:47] [MiddlewareClient] Connected to broker: localhost:9000
[10:30:48] [EventService] Subscribed to post_created
[10:30:48] [EventService] Subscribed to topic_created

[10:31:00] [EventService] Topic created event published: ok
[10:31:00] [Index] Broadcasting event: topic_created
[10:31:00] [WebSocket] Topic created: {id: "uuid", name: "test"}

[10:31:10] [EventService] Post created event published: ok
[10:31:10] [Index] Broadcasting event: post_created
[10:31:10] [WebSocket] Post created: {id: "uuid", author: "João"}
```

### Session com Erro
```
[10:30:45] [WebSocket] Connecting to: http://localhost:3000
[10:30:46] [WebSocket] Connected
[10:30:46] [useWebSocket] Connected
[10:30:47] [MiddlewareClient] Connecting to broker: localhost:9000
[10:30:48] [MiddlewareClient] Connection error: ECONNREFUSED
[10:35:00] [MiddlewareClient] Connecting to broker: localhost:9000
[10:35:01] [MiddlewareClient] Connected to broker: localhost:9000
```
(Retry automático a cada 5 segundos)

---

## 🎯 Checklist Final

- [ ] Status Dashboard mostra no canto inferior direito
- [ ] Console Logger mostra no canto inferior esquerdo
- [ ] Ambos têm indicadores visuais (cores, animações)
- [ ] Criar tópico → aparece em < 500ms
- [ ] Criar post → aparece em < 200ms
- [ ] Abrir 2 abas → eventos sincronizam automaticamente
- [ ] Console mostra logs estruturados com timestamps
- [ ] Sem erros de conexão no console

**Tudo checado? Middleware está funcionando perfeitamente!** ✅🚀

---

## 🔗 Refs Rápidas

- **Status Dashboard:** `frontend/src/components/StatusDashboard.tsx`
- **Console Logger:** `frontend/src/components/ConsoleLogger.tsx`
- **WebSocket Service:** `frontend/src/services/WebSocketService.ts`
- **App Integration:** `frontend/src/App.tsx`
