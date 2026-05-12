import net from 'net'
import { EventEmitter } from 'events'

interface WireMessage {
  type: string
  topic?: string
  payload?: any
  req_id?: string
  action?: string
  status?: string
  info?: string
  message?: string
}

interface PendingRequest {
  resolve: (value: any) => void
  reject: (reason?: any) => void
  timeout: NodeJS.Timeout
}

export class MiddlewareClient extends EventEmitter {
  private conn: net.Socket | null = null
  private brokers: string[]
  private currentBrokerIndex = 0
  private buffer = ''
  private pending = new Map<string, PendingRequest>()
  private reqCounter = 0
  private subscriptions = new Map<string, boolean>()
  private isConnected = false
  private reconnectInterval = 5000
  private reconnectTimer: NodeJS.Timeout | null = null

  constructor(brokers: string[] = ['localhost:9000']) {
    super()
    this.brokers = brokers.filter(b => b && b.trim() !== '')
    if (this.brokers.length === 0) {
      this.brokers = ['localhost:9000']
    }
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => {
          if (!this.isConnected) {
            reject(new Error('Connection timeout'))
            this.scheduleReconnect()
          }
        },
        10000
      )

      const attemptConnect = () => {
        if (this.currentBrokerIndex >= this.brokers.length) {
          this.currentBrokerIndex = 0
        }

        const broker = this.brokers[this.currentBrokerIndex]
        const [host, port] = broker.split(':')

        console.log(`[MiddlewareClient] Connecting to broker: ${broker}`)
        this.conn = net.createConnection(
          { host, port: parseInt(port) || 9000 },
          () => {
            clearTimeout(timeout)
            this.isConnected = true
            console.log(`[MiddlewareClient] Connected to broker: ${broker}`)
            this.emit('connected')
            resolve()
          }
        )

        this.conn.on('data', (chunk) => this.handleData(chunk))
        this.conn.on('error', (err) => {
          console.error(`[MiddlewareClient] Connection error: ${err.message}`)
          this.isConnected = false
          this.emit('error', err)
          if (!this.isConnected) {
            this.currentBrokerIndex++
            attemptConnect()
          }
        })
        this.conn.on('close', () => {
          console.log('[MiddlewareClient] Connection closed')
          this.isConnected = false
          this.emit('disconnected')
          this.scheduleReconnect()
        })
      }

      attemptConnect()
    })
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    console.log(`[MiddlewareClient] Scheduling reconnect in ${this.reconnectInterval}ms`)
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null
      try {
        await this.connect()
        // Resubscribe to all topics
        for (const topic of this.subscriptions.keys()) {
          await this.subscribe(topic)
        }
      } catch (err) {
        console.error('[MiddlewareClient] Reconnect failed:', err)
      }
    }, this.reconnectInterval)
  }

  private handleData(chunk: Buffer) {
    this.buffer += chunk.toString()
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const msg: WireMessage = JSON.parse(line)
        this.handleMessage(msg)
      } catch (err) {
        console.error('[MiddlewareClient] Parse error:', err)
      }
    }
  }

  private handleMessage(msg: WireMessage) {
    if (msg.type === 'ack') {
      const pending = this.pending.get(msg.req_id || '')
      if (pending) {
        clearTimeout(pending.timeout)
        this.pending.delete(msg.req_id || '')
        pending.resolve({
          status: msg.status,
          info: msg.info,
        })
      }
    } else if (msg.type === 'event') {
      this.emit('event', {
        topic: msg.topic,
        payload: msg.payload,
      })
    } else if (msg.type === 'error') {
      const pending = this.pending.get(msg.req_id || '')
      if (pending) {
        clearTimeout(pending.timeout)
        this.pending.delete(msg.req_id || '')
        pending.reject(new Error(msg.message || 'Unknown error'))
      } else {
        this.emit('error', new Error(msg.message || 'Unknown error'))
      }
    }
  }

  async publish(topic: string, payload: any): Promise<string> {
    if (!this.isConnected || !this.conn) {
      throw new Error('Not connected to middleware')
    }

    if (!topic) {
      throw new Error('Topic is required')
    }

    const req_id = this.nextReqId()
    const msg: WireMessage = {
      type: 'publish',
      topic,
      payload,
      req_id,
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(req_id)
        reject(new Error('Publish timeout'))
      }, 30000)

      this.pending.set(req_id, { resolve, reject, timeout })
      this.sendMessage(msg)

      // Wait for response
      const checkResponse = setInterval(() => {
        const pending = this.pending.get(req_id)
        if (!pending) {
          clearInterval(checkResponse)
        }
      }, 100)
    })
  }

  async subscribe(topic: string): Promise<void> {
    if (!this.isConnected || !this.conn) {
      throw new Error('Not connected to middleware')
    }

    if (!topic) {
      throw new Error('Topic is required')
    }

    const req_id = this.nextReqId()
    const msg: WireMessage = {
      type: 'subscribe',
      topic,
      req_id,
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(req_id)
        reject(new Error('Subscribe timeout'))
      }, 30000)

      this.pending.set(req_id, {
        resolve: () => {
          this.subscriptions.set(topic, true)
          resolve()
        },
        reject,
        timeout,
      })
      this.sendMessage(msg)
    })
  }

  async unsubscribe(topic: string): Promise<void> {
    if (!this.isConnected || !this.conn) {
      throw new Error('Not connected to middleware')
    }

    if (!topic) {
      throw new Error('Topic is required')
    }

    const req_id = this.nextReqId()
    const msg: WireMessage = {
      type: 'unsubscribe',
      topic,
      req_id,
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(req_id)
        reject(new Error('Unsubscribe timeout'))
      }, 30000)

      this.pending.set(req_id, {
        resolve: () => {
          this.subscriptions.delete(topic)
          resolve()
        },
        reject,
        timeout,
      })
      this.sendMessage(msg)
    })
  }

  private sendMessage(msg: WireMessage) {
    if (!this.conn) return
    const line = JSON.stringify(msg) + '\n'
    this.conn.write(line, (err) => {
      if (err) {
        console.error('[MiddlewareClient] Send error:', err)
      }
    })
  }

  private nextReqId(): string {
    return `req_${++this.reqCounter}_${Date.now()}`
  }

  close() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timeout)
    }
    this.pending.clear()
    if (this.conn) {
      this.conn.destroy()
      this.conn = null
    }
    this.isConnected = false
  }

  getIsConnected(): boolean {
    return this.isConnected
  }
}

let instance: MiddlewareClient | null = null

export function getMiddlewareClient(): MiddlewareClient {
  if (!instance) {
    const brokers = (process.env.MIDDLEWARE_BROKERS || 'localhost:9000').split(',')
    instance = new MiddlewareClient(brokers)
  }
  return instance
}
