import { io, Socket } from 'socket.io-client'

// Simple EventEmitter para browser (Node.js EventEmitter não funciona em browser)
class SimpleEventEmitter {
  private events: Map<string, Set<(...args: any[]) => void>> = new Map()

  on(event: string, callback: (...args: any[]) => void) {
    if (!this.events.has(event)) {
      this.events.set(event, new Set())
    }
    this.events.get(event)!.add(callback)
  }

  emit(event: string, ...args: any[]) {
    if (this.events.has(event)) {
      this.events.get(event)!.forEach(callback => callback(...args))
    }
  }

  removeListener(event: string, callback: (...args: any[]) => void) {
    if (this.events.has(event)) {
      this.events.get(event)!.delete(callback)
    }
  }

  removeAllListeners(event?: string) {
    if (event) {
      this.events.delete(event)
    } else {
      this.events.clear()
    }
  }
}

export interface PostEvent {
  id: string
  author: string
  content: string
  topic_id: string
  created_at: string
}

export interface TopicEvent {
  id: string
  name: string
  description?: string
  created_at: string
}

export class WebSocketService extends SimpleEventEmitter {
  private socket: Socket | null = null
  private connected = false
  private subscriptions = new Set<string>()
  private connecting = false
  private connectTimeoutId: ReturnType<typeof setTimeout> | null = null

  constructor(private url: string = 'http://localhost:3000') {
    super()
  }

  async connect(): Promise<void> {
    // Se já está conectado ou conectando, não faz nada
    if (this.connected || this.connecting) {
      console.log('[WebSocket] Already connected or connecting')
      return
    }

    // Se já tem um socket, desconecta primeiro
    if (this.socket) {
      console.log('[WebSocket] Cleaning up old socket')
      this.socket.disconnect()
      this.socket = null
    }

    return new Promise((resolve, reject) => {
      try {
        this.connecting = true
        console.log('[WebSocket] Connecting to:', this.url)

        this.socket = io(this.url, {
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: Infinity,
          forceNew: false,
        })

        const onConnect = () => {
          console.log('[WebSocket] Connected')
          this.connected = true
          this.connecting = false
          
          // Limpar timeout
          if (this.connectTimeoutId) {
            clearTimeout(this.connectTimeoutId)
            this.connectTimeoutId = null
          }

          // Re-fazer subscriptions após reconectar
          this.resubscribe()
          
          this.emit('connected')
          resolve()
        }

        const onDisconnect = () => {
          console.log('[WebSocket] Disconnected')
          this.connected = false
          this.emit('disconnected')
        }

        this.socket.on('connect', onConnect)
        this.socket.on('disconnect', onDisconnect)

        this.socket.on('post:created', (data: PostEvent) => {
          console.log('[WebSocket] Post created:', data)
          this.emit('post:created', data)
        })

        this.socket.on('topic:created', (data: TopicEvent) => {
          console.log('[WebSocket] Topic created:', data)
          this.emit('topic:created', data)
        })

        this.socket.on('post:deleted', (data: PostEvent) => {
          console.log('[WebSocket] Post deleted:', data)
          this.emit('post:deleted', data)
        })

        this.socket.on('topic:deleted', (data: TopicEvent) => {
          console.log('[WebSocket] Topic deleted:', data)
          this.emit('topic:deleted', data)
        })

        this.socket.on('system:middleware-connected', () => {
          console.log('[WebSocket] Middleware connected')
          this.emit('middleware:connected')
        })

        this.socket.on('system:middleware-disconnected', () => {
          console.log('[WebSocket] Middleware disconnected')
          this.emit('middleware:disconnected')
        })

        this.socket.on('error', (error) => {
          console.error('[WebSocket] Error:', error)
          this.emit('error', error)
        })

        // Timeout para conexão inicial
        this.connectTimeoutId = setTimeout(() => {
          if (!this.connected && this.socket) {
            console.warn('[WebSocket] Connection timeout, disconnecting')
            this.socket.disconnect()
            this.connecting = false
            reject(new Error('Connection timeout'))
          }
        }, 10000)
      } catch (err) {
        this.connecting = false
        reject(err)
      }
    })
  }

  private resubscribe(): void {
    console.log('[WebSocket] Re-subscribing to', this.subscriptions.size, 'topics')
    if (this.subscriptions.has('posts')) {
      this.socket?.emit('subscribe:posts')
    }
    if (this.subscriptions.has('topics')) {
      this.socket?.emit('subscribe:topics')
    }
  }

  subscribeToPosts(): void {
    if (!this.socket || !this.connected) {
      console.warn('[WebSocket] Not connected, cannot subscribe to posts')
      return
    }

    if (this.subscriptions.has('posts')) {
      console.log('[WebSocket] Already subscribed to posts')
      return
    }

    console.log('[WebSocket] Subscribing to posts')
    this.socket.emit('subscribe:posts')
    this.subscriptions.add('posts')
  }

  subscribeToTopics(): void {
    if (!this.socket || !this.connected) {
      console.warn('[WebSocket] Not connected, cannot subscribe to topics')
      return
    }

    if (this.subscriptions.has('topics')) {
      console.log('[WebSocket] Already subscribed to topics')
      return
    }

    console.log('[WebSocket] Subscribing to topics')
    this.socket.emit('subscribe:topics')
    this.subscriptions.add('topics')
  }

  isConnected(): boolean {
    return this.connected
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.connected = false
      this.subscriptions.clear()
    }
  }
}

let wsInstance: WebSocketService | null = null

export function getWebSocketService(): WebSocketService {
  if (!wsInstance) {
    wsInstance = new WebSocketService()
  }
  return wsInstance
}
