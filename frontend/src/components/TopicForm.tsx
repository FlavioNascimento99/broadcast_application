import { useState } from 'react'
import { topicsAPI } from '../services/api'

interface TopicFormProps {
  onTopicCreated: () => void
}

export default function TopicForm({ onTopicCreated }: TopicFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await topicsAPI.create(name, description)
      setName('')
      setDescription('')
      onTopicCreated()
    } catch (err) {
      setError('Failed to create topic')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="neobrutalist-card mb-8">
      <h2 className="neobrutalist-subheading mb-6">Create New Topic</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-neon-cyan font-bold mb-2 uppercase text-sm">
            Topic Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter topic name..."
            className="neobrutalist-input w-full"
            required
          />
        </div>

        <div>
          <label className="block text-neon-cyan font-bold mb-2 uppercase text-sm">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter topic description (optional)..."
            className="neobrutalist-input w-full h-20 resize-none"
          />
        </div>

        {error && (
          <div className="bg-red-900 border-3 border-red-500 p-3 text-red-100 font-bold">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`neobrutalist-button w-full ${
            loading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {loading ? 'Creating...' : 'Create Topic'}
        </button>
      </div>
    </form>
  )
}
