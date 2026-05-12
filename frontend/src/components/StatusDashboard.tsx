import { useEffect, useState } from 'react'
import { getWebSocketService } from '../services/WebSocketService'

export default function StatusDashboard() {
  const [wsConnected, setWsConnected] = useState(false)
  const [middlewareConnected, setMiddlewareConnected] = useState(false)
  const [lastEventTime, setLastEventTime] = useState<string | null>(null)
  const [eventCount, setEventCount] = useState(0)
  const [brokerStatus, setBrokerStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')

  useEffect(() => {
    const ws = getWebSocketService()

    const handleWsConnected = () => {
      console.log('[StatusDashboard] WebSocket connected')
      setWsConnected(true)
    }

    const handleWsDisconnected = () => {
      console.log('[StatusDashboard] WebSocket disconnected')
      setWsConnected(false)
      setBrokerStatus('disconnected')
    }

    const handleMiddlewareConnected = () => {
      console.log('[StatusDashboard] Middleware connected')
      setMiddlewareConnected(true)
      setBrokerStatus('connected')
    }

    const handleMiddlewareDisconnected = () => {
      console.log('[StatusDashboard] Middleware disconnected')
      setMiddlewareConnected(false)
      setBrokerStatus('disconnected')
    }

    const handleEvent = () => {
      console.log('[StatusDashboard] Event received')
      setEventCount(prev => prev + 1)
      setLastEventTime(new Date().toLocaleTimeString())
    }

    ws.on('connected', handleWsConnected)
    ws.on('disconnected', handleWsDisconnected)
    ws.on('middleware:connected', handleMiddlewareConnected)
    ws.on('middleware:disconnected', handleMiddlewareDisconnected)
    ws.on('post:created', handleEvent)
    ws.on('topic:created', handleEvent)

    // Set fallback timeout only if still not connected
    const fallbackTimeout = setTimeout(() => {
      if (!wsConnected && brokerStatus === 'connecting') {
        console.warn('[StatusDashboard] Timeout waiting for connection')
        setBrokerStatus('disconnected')
      }
    }, 8000)

    return () => {
      clearTimeout(fallbackTimeout)
      ws.removeListener('connected', handleWsConnected)
      ws.removeListener('disconnected', handleWsDisconnected)
      ws.removeListener('middleware:connected', handleMiddlewareConnected)
      ws.removeListener('middleware:disconnected', handleMiddlewareDisconnected)
      ws.removeListener('post:created', handleEvent)
      ws.removeListener('topic:created', handleEvent)
    }
  }, [])

  return (
    <div className="fixed bottom-6 right-6 w-96 neobrutalist-card bg-brutalist-black border-neon-cyan border-3 p-4 z-40">
      {/* Header */}
      <h3 className="neobrutalist-subheading text-neon-cyan mb-4 uppercase">🔍 Middleware Status</h3>

      {/* WebSocket Status */}
      <div className="mb-4 pb-4 border-b-2 border-neon-pink">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-neon-cyan">WebSocket</span>
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 border-2 rounded-full ${
                wsConnected
                  ? 'bg-neon-green border-neon-green animate-pulse'
                  : 'bg-neon-pink border-neon-pink'
              }`}
            />
            <span className={`text-xs font-bold uppercase ${wsConnected ? 'text-neon-green' : 'text-neon-pink'}`}>
              {wsConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
        <p className="text-xs text-neon-cyan">Backend connection: ws://localhost:3000</p>
      </div>

      {/* Middleware (Broker) Status */}
      <div className="mb-4 pb-4 border-b-2 border-neon-pink">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-neon-cyan">Middleware Broker</span>
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 border-2 rounded-full ${
                middlewareConnected
                  ? 'bg-neon-green border-neon-green animate-pulse'
                  : brokerStatus === 'connecting'
                  ? 'bg-neon-yellow border-neon-yellow animate-pulse'
                  : 'bg-neon-pink border-neon-pink'
              }`}
            />
            <span
              className={`text-xs font-bold uppercase ${
                middlewareConnected
                  ? 'text-neon-green'
                  : brokerStatus === 'connecting'
                  ? 'text-neon-yellow'
                  : 'text-neon-pink'
              }`}
            >
              {middlewareConnected ? 'Online' : brokerStatus === 'connecting' ? 'Connecting...' : 'Offline'}
            </span>
          </div>
        </div>
        <p className="text-xs text-neon-cyan">Go Broker: localhost:9000</p>
      </div>

      {/* Events Counter */}
      <div className="mb-4 pb-4 border-b-2 border-neon-pink">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-neon-cyan">Real-time Events</span>
          <span className="text-lg font-bold text-neon-green">{eventCount}</span>
        </div>
        {lastEventTime && (
          <p className="text-xs text-neon-cyan">Last event: {lastEventTime}</p>
        )}
      </div>

      {/* System Status */}
      <div className="p-3 bg-brutalist-gray border-2 border-neon-cyan rounded-sm">
        <div className="flex items-center gap-2 mb-2">
          <div
            className={`w-2 h-2 ${
              wsConnected && middlewareConnected ? 'bg-neon-green' : wsConnected ? 'bg-neon-yellow' : 'bg-neon-pink'
            }`}
          />
          <span className="text-xs font-bold uppercase text-neon-cyan">
            {wsConnected && middlewareConnected
              ? '✅ Everything OK'
              : wsConnected
              ? '⚠️ Middleware offline'
              : '❌ Backend disconnected'}
          </span>
        </div>
      </div>

      {/* Debug Info */}
      <div className="mt-4 text-xs text-neon-pink font-mono">
        <p>📍 Frontend: http://localhost:5173</p>
        <p>🔗 Backend: http://localhost:3000</p>
        <p>🎯 Broker: localhost:9000</p>
      </div>
    </div>
  )
}
