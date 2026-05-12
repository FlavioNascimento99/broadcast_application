import { useEffect, useState } from 'react'

export default function ConsoleLogger() {
  const [logs, setLogs] = useState<Array<{id: number, message: string, level: 'log' | 'error' | 'warn', time: string}>>([])
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    let logCounter = 0

    // Intercept console methods
    const originalLog = console.log
    const originalError = console.error
    const originalWarn = console.warn

    console.log = (...args: any[]) => {
      originalLog(...args)
      const message = args.map(arg => {
        if (typeof arg === 'object') {
          return JSON.stringify(arg)
        }
        return String(arg)
      }).join(' ')

      if (message.includes('[')) {
        setLogs(prev => [...prev.slice(-49), {
          id: ++logCounter,
          message,
          level: 'log',
          time: new Date().toLocaleTimeString()
        }])
      }
    }

    console.error = (...args: any[]) => {
      originalError(...args)
      const message = args.map(arg => {
        if (typeof arg === 'object') {
          return JSON.stringify(arg)
        }
        return String(arg)
      }).join(' ')

      setLogs(prev => [...prev.slice(-49), {
        id: ++logCounter,
        message,
        level: 'error',
        time: new Date().toLocaleTimeString()
      }])
    }

    console.warn = (...args: any[]) => {
      originalWarn(...args)
      const message = args.map(arg => {
        if (typeof arg === 'object') {
          return JSON.stringify(arg)
        }
        return String(arg)
      }).join(' ')

      setLogs(prev => [...prev.slice(-49), {
        id: ++logCounter,
        message,
        level: 'warn',
        time: new Date().toLocaleTimeString()
      }])
    }

    return () => {
      console.log = originalLog
      console.error = originalError
      console.warn = originalWarn
    }
  }, [])

  return (
    <div className="fixed bottom-6 left-6 w-96 z-40">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full neobrutalist-button mb-2 text-neon-yellow border-neon-yellow text-xs uppercase"
      >
        {isExpanded ? '▼ Hide' : '▶ Show'} Console ({logs.length})
      </button>

      {isExpanded && (
        <div className="neobrutalist-card bg-brutalist-black border-neon-yellow border-3 max-h-64 overflow-y-auto font-mono text-xs">
          {logs.length === 0 ? (
            <p className="text-neon-cyan p-2">Aguardando logs...</p>
          ) : (
            logs.map(log => (
              <div
                key={log.id}
                className={`p-1 border-b border-brutalist-gray ${
                  log.level === 'error'
                    ? 'text-red-400'
                    : log.level === 'warn'
                    ? 'text-neon-yellow'
                    : 'text-neon-cyan'
                }`}
              >
                <span className="text-neon-pink mr-2">[{log.time}]</span>
                <span className="break-words">{log.message}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
