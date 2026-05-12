import { useState, useEffect } from 'react'
import { topicsAPI } from '../services/api'

interface Topic {
  id: string
  name: string
  description?: string
  createdAt: string
  posts?: any[]
}

interface TopicListProps {
  onTopicSelected: (topic: Topic) => void
  refreshTrigger: number
}

export default function TopicList({
  onTopicSelected,
  refreshTrigger,
}: TopicListProps) {
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchTopics()
  }, [refreshTrigger])

  const fetchTopics = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await topicsAPI.getAll()
      setTopics(data)
    } catch (err) {
      setError('Failed to fetch topics')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this topic?')) {
      try {
        await topicsAPI.delete(id)
        fetchTopics()
      } catch (err) {
        setError('Failed to delete topic')
        console.error(err)
      }
    }
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-neon-yellow font-bold text-xl">Loading topics...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900 border-4 border-red-500 p-4 font-bold text-red-100">
        {error}
      </div>
    )
  }

  if (topics.length === 0) {
    return (
      <div className="neobrutalist-card text-center py-12">
        <p className="text-brutalist-white font-bold text-lg">
          No topics yet. Create one to get started!
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {topics.map((topic) => (
        <div
          key={topic.id}
          className="neobrutalist-card group hover:border-neon-cyan transition-all duration-200"
        >
          <h3 className="text-neon-pink font-bold text-xl mb-2 uppercase">
            {topic.name}
          </h3>
          {topic.description && (
            <p className="text-brutalist-white mb-4">{topic.description}</p>
          )}
          <p className="text-neon-yellow text-sm mb-4 font-bold">
            {topic.posts?.length || 0} posts
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => onTopicSelected(topic)}
              className="flex-1 neobrutalist-button text-sm"
            >
              View Posts
            </button>
            <button
              onClick={() => handleDelete(topic.id)}
              className="bg-red-900 border-3 border-red-500 text-red-100 font-bold py-3 px-6 
                         hover:bg-red-800 transition-all duration-200 cursor-pointer"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
