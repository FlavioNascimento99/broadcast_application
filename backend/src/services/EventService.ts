import { MiddlewareClient, getMiddlewareClient } from './MiddlewareClient'
import { EventEmitter } from 'events'

export interface EventPayload {
  type: 'post_created' | 'topic_created'
  data: any
}

class EventService extends EventEmitter {
  private client: MiddlewareClient
  private initialized = false

  constructor() {
    super()
    this.client = getMiddlewareClient()
    this.setupListeners()
  }

  private setupListeners() {
    this.client.on('connected', () => {
      console.log('[EventService] Middleware connected')
      this.emit('middleware:connected')
    })

    this.client.on('disconnected', () => {
      console.log('[EventService] Middleware disconnected')
      this.emit('middleware:disconnected')
    })

    this.client.on('event', (event: any) => {
      console.log('[EventService] Event received:', event.topic)
      try {
        const payload = typeof event.payload === 'string' 
          ? JSON.parse(event.payload) 
          : event.payload
        
        this.emit('event', {
          topic: event.topic,
          data: payload,
        })
      } catch (err) {
        console.error('[EventService] Error parsing event:', err)
      }
    })

    this.client.on('error', (err: Error) => {
      console.error('[EventService] Middleware error:', err)
      this.emit('middleware:error', err)
    })
  }

  async initialize(): Promise<void> {
    if (this.initialized) return
    
    try {
      await this.client.connect()
      console.log('[EventService] Initialized and connected')
      this.initialized = true
    } catch (err) {
      console.error('[EventService] Failed to initialize:', err)
      throw err
    }
  }

  async publishPostCreated(postData: any): Promise<void> {
    try {
      const result = await this.client.publish('post_created', {
        type: 'post_created',
        data: postData,
        timestamp: new Date().toISOString(),
      })
      console.log('[EventService] Post created event published:', result)
    } catch (err) {
      console.error('[EventService] Failed to publish post created event:', err)
    }
  }

  async publishTopicCreated(topicData: any): Promise<void> {
    try {
      const result = await this.client.publish('topic_created', {
        type: 'topic_created',
        data: topicData,
        timestamp: new Date().toISOString(),
      })
      console.log('[EventService] Topic created event published:', result)
    } catch (err) {
      console.error('[EventService] Failed to publish topic created event:', err)
    }
  }

  async subscribeToPostCreated(): Promise<void> {
    try {
      await this.client.subscribe('post_created')
      console.log('[EventService] Subscribed to post_created')
    } catch (err) {
      console.error('[EventService] Failed to subscribe to post_created:', err)
    }
  }

  async subscribeToTopicCreated(): Promise<void> {
    try {
      await this.client.subscribe('topic_created')
      console.log('[EventService] Subscribed to topic_created')
    } catch (err) {
      console.error('[EventService] Failed to subscribe to topic_created:', err)
    }
  }

  isInitialized(): boolean {
    return this.initialized
  }

  isConnected(): boolean {
    return this.client.getIsConnected()
  }

  close(): void {
    this.client.close()
    this.initialized = false
  }
}

let eventServiceInstance: EventService | null = null

export function getEventService(): EventService {
  if (!eventServiceInstance) {
    eventServiceInstance = new EventService()
  }
  return eventServiceInstance
}
