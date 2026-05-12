import { useEffect, useState, useCallback, useRef } from 'react'
import { getWebSocketService, PostEvent, TopicEvent } from '../services/WebSocketService'

export function useWebSocket() {
  const [wsConnected, setWsConnected] = useState(false)
  const [middlewareConnected, setMiddlewareConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const subscriptionsRef = useRef<{ posts?: boolean; topics?: boolean }>({})

  useEffect(() => {
    const ws = getWebSocketService()

    const handleConnected = () => {
      console.log('[useWebSocket] Connected')
      setWsConnected(true)
      setError(null)
    }

    const handleDisconnected = () => {
      console.log('[useWebSocket] Disconnected')
      setWsConnected(false)
    }

    const handleMiddlewareConnected = () => {
      console.log('[useWebSocket] Middleware connected')
      setMiddlewareConnected(true)
    }

    const handleMiddlewareDisconnected = () => {
      console.log('[useWebSocket] Middleware disconnected')
      setMiddlewareConnected(false)
    }

    const handleError = (err: any) => {
      console.error('[useWebSocket] Error:', err)
      setError(err.message || 'WebSocket error')
    }

    ws.on('connected', handleConnected)
    ws.on('disconnected', handleDisconnected)
    ws.on('middleware:connected', handleMiddlewareConnected)
    ws.on('middleware:disconnected', handleMiddlewareDisconnected)
    ws.on('error', handleError)

    // Try to connect
    ws.connect().catch((err) => {
      console.error('[useWebSocket] Connection failed:', err)
      setError(err.message || 'Failed to connect')
    })

    return () => {
      ws.removeListener('connected', handleConnected)
      ws.removeListener('disconnected', handleDisconnected)
      ws.removeListener('middleware:connected', handleMiddlewareConnected)
      ws.removeListener('middleware:disconnected', handleMiddlewareDisconnected)
      ws.removeListener('error', handleError)
    }
  }, [])

  const subscribeToPostEvents = useCallback((onPostCreated: (post: PostEvent) => void) => {
    const ws = getWebSocketService()
    subscriptionsRef.current.posts = true
    ws.subscribeToPosts()
    ws.on('post:created', onPostCreated)

    return () => {
      ws.removeListener('post:created', onPostCreated)
    }
  }, [])

  const subscribeToTopicEvents = useCallback((onTopicCreated: (topic: TopicEvent) => void) => {
    const ws = getWebSocketService()
    subscriptionsRef.current.topics = true
    ws.subscribeToTopics()
    ws.on('topic:created', onTopicCreated)

    return () => {
      ws.removeListener('topic:created', onTopicCreated)
    }
  }, [])

  return {
    wsConnected,
    middlewareConnected,
    error,
    subscribeToPostEvents,
    subscribeToTopicEvents,
  }
}
