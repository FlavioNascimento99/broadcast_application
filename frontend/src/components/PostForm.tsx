import { useState } from 'react'
import { postsAPI } from '../services/api'

interface PostFormProps {
  topicId: string
  topicName: string
  onPostCreated: () => void
  onCancel: () => void
}

export default function PostForm({
  topicId,
  topicName,
  onPostCreated,
  onCancel,
}: PostFormProps) {
  const [author, setAuthor] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await postsAPI.create(author, content, topicId)
      setAuthor('')
      setContent('')
      onPostCreated()
    } catch (err) {
      setError('Failed to create post')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="neobrutalist-card mb-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="neobrutalist-subheading">New Post in "{topicName}"</h2>
        <button
          type="button"
          onClick={onCancel}
          className="text-neon-yellow font-bold text-2xl hover:text-neon-cyan transition"
        >
          ✕
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-neon-cyan font-bold mb-2 uppercase text-sm">
            Your Name *
          </label>
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Enter your name..."
            className="neobrutalist-input w-full"
            required
          />
        </div>

        <div>
          <label className="block text-neon-cyan font-bold mb-2 uppercase text-sm">
            Post Content *
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your post..."
            className="neobrutalist-input w-full h-32 resize-none"
            required
          />
        </div>

        {error && (
          <div className="bg-red-900 border-3 border-red-500 p-3 text-red-100 font-bold">
            {error}
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className={`flex-1 neobrutalist-button ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {loading ? 'Posting...' : 'Publish Post'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="neobrutalist-button bg-brutalist-gray text-neon-cyan border-neon-cyan 
                       hover:bg-brutalist-black"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  )
}
