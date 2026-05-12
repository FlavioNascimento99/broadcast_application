import { useState, useEffect } from 'react'
import TopicForm from './components/TopicForm'
import TopicList from './components/TopicList'
import PostForm from './components/PostForm'
import PostList from './components/PostList'
import StatusDashboard from './components/StatusDashboard'
import ConsoleLogger from './components/ConsoleLogger'
import { healthAPI } from './services/api'
import { useWebSocket } from './hooks/useWebSocket'
import './index.css'

interface Topic {
  id: string
  name: string
  description?: string
  createdAt: string
  posts?: any[]
}

function App() {
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null)
  const [topicsRefresh, setTopicsRefresh] = useState(0)
  const [postsRefresh, setPostsRefresh] = useState(0)
  const [status, setStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>(
    'checking'
  )
  const { wsConnected, middlewareConnected, subscribeToPostEvents, subscribeToTopicEvents } = useWebSocket()

  useEffect(() => {
    checkConnection()
  }, [])

  // Subscribe to real-time events
  useEffect(() => {
    if (wsConnected) {
      const unsubscribePost = subscribeToPostEvents(() => {
        setPostsRefresh((prev) => prev + 1)
      })

      const unsubscribeTopic = subscribeToTopicEvents(() => {
        setTopicsRefresh((prev) => prev + 1)
      })

      return () => {
        unsubscribePost()
        unsubscribeTopic()
      }
    }
  }, [wsConnected, subscribeToPostEvents, subscribeToTopicEvents])

  const checkConnection = async () => {
    setStatus('checking')
    try {
      await healthAPI.check()
      await healthAPI.ping()
      setStatus('connected')
    } catch (err) {
      setStatus('error')
      console.error('Connection error:', err)
    }
  }

  const handleTopicCreated = () => {
    setTopicsRefresh((prev) => prev + 1)
  }

  const handlePostCreated = () => {
    setPostsRefresh((prev) => prev + 1)
  }

  return (
    <div className="min-h-screen bg-brutalist-black">
      {/* Header */}
      <header className="border-b-5 border-neon-pink bg-brutalist-black sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="neobrutalist-heading mb-2">PUBLISHER</h1>
              <p className="text-neon-cyan font-bold text-sm uppercase tracking-wider">
                Neo-Brutalist Messaging Platform
              </p>
            </div>

            <div className="text-right">
              <div className="flex items-center gap-4 mb-2">
                {/* API Status */}
                <div className="flex items-center gap-2">
                  <div
                    className={`w-4 h-4 border-2 ${
                      status === 'connected'
                        ? 'bg-neon-green border-neon-green'
                        : status === 'error'
                          ? 'bg-red-500 border-red-500'
                          : 'bg-neon-yellow border-neon-yellow'
                    }`}
                  />
                  <span className="font-bold text-sm uppercase">
                    {status === 'connected'
                      ? 'API'
                      : status === 'error'
                        ? 'Offline'
                        : 'Checking...'}
                  </span>
                </div>

                {/* WebSocket Status */}
                <div className="flex items-center gap-2">
                  <div
                    className={`w-4 h-4 border-2 ${
                      wsConnected
                        ? 'bg-neon-cyan border-neon-cyan'
                        : 'bg-neon-pink border-neon-pink'
                    }`}
                  />
                  <span className="font-bold text-sm uppercase">
                    {wsConnected ? 'WS' : 'Offline'}
                  </span>
                </div>

                {/* Middleware Status */}
                {wsConnected && (
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 border-2 ${
                        middlewareConnected
                          ? 'bg-neon-green border-neon-green'
                          : 'bg-neon-yellow border-neon-yellow'
                      }`}
                    />
                    <span className="font-bold text-sm uppercase text-neon-yellow">
                      {middlewareConnected ? 'Broker' : 'Broker...'}
                    </span>
                  </div>
                )}
              </div>
              {status === 'error' && (
                <button
                  onClick={checkConnection}
                  className="text-neon-pink font-bold text-xs uppercase hover:text-neon-cyan transition"
                >
                  Retry Connection
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {status === 'error' && (
          <div className="neobrutalist-card mb-8 border-red-500 bg-red-900/20">
            <h2 className="text-red-400 font-bold text-xl mb-2">⚠ Connection Error</h2>
            <p className="text-red-100 mb-4">
              Cannot connect to backend at localhost:3000. Make sure the API server is running.
            </p>
            <button
              onClick={checkConnection}
              className="neobrutalist-button"
            >
              Try Again
            </button>
          </div>
        )}

        {!selectedTopic ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Create Topic Section */}
            <div className="lg:col-span-1">
              <TopicForm onTopicCreated={handleTopicCreated} />
            </div>

            {/* Topics List Section */}
            <div className="lg:col-span-2">
              <div className="mb-6">
                <h2 className="neobrutalist-heading mb-6">Topics</h2>
                {wsConnected && (
                  <p className="text-neon-cyan font-bold text-xs mb-4">🔴 Real-time updates enabled</p>
                )}
              </div>
              <TopicList
                onTopicSelected={setSelectedTopic}
                refreshTrigger={topicsRefresh}
              />
            </div>
          </div>
        ) : (
          <div>
            {/* Selected Topic Header */}
            <div className="mb-8 flex items-center justify-between">
              <div>
                <button
                  onClick={() => setSelectedTopic(null)}
                  className="text-neon-cyan font-bold text-lg mb-2 hover:text-neon-pink transition uppercase"
                >
                  ← Back to Topics
                </button>
                <h2 className="neobrutalist-heading">{selectedTopic.name}</h2>
                {selectedTopic.description && (
                  <p className="text-brutalist-white mt-2">
                    {selectedTopic.description}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Create Post Section */}
              <div className="lg:col-span-1">
                <PostForm
                  topicId={selectedTopic.id}
                  topicName={selectedTopic.name}
                  onPostCreated={handlePostCreated}
                  onCancel={() => setSelectedTopic(null)}
                />
              </div>

              {/* Posts List Section */}
              <div className="lg:col-span-2">
                <h3 className="neobrutalist-subheading mb-6">Posts</h3>
                {wsConnected && (
                  <p className="text-neon-cyan font-bold text-xs mb-4">🔴 Real-time updates enabled</p>
                )}
                <PostList topicId={selectedTopic.id} refreshTrigger={postsRefresh} />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t-5 border-neon-pink mt-16 py-8 bg-brutalist-gray">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-neon-cyan font-bold uppercase text-sm">
            Built with React + Tailwind + Neo-Brutalism + Socket.IO + Go Middleware
          </p>
        </div>
      </footer>

      {/* Status Dashboard */}
      <StatusDashboard />

      {/* Console Logger */}
      <ConsoleLogger />
    </div>
  )
}

export default App
