import { useState, useEffect } from 'react'
import { postsAPI } from '../services/api'

interface Post {
  id: string
  author: string
  content: string
  createdAt: string
}

interface PostListProps {
  topicId: string
  refreshTrigger: number
}

export default function PostList({ topicId, refreshTrigger }: PostListProps) {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchPosts()
  }, [topicId, refreshTrigger])

  const fetchPosts = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await postsAPI.getByTopicId(topicId)
      setPosts(data)
    } catch (err) {
      setError('Failed to fetch posts')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Delete this post?')) {
      try {
        await postsAPI.delete(id)
        fetchPosts()
      } catch (err) {
        setError('Failed to delete post')
        console.error(err)
      }
    }
  }

  if (loading) {
    return <p className="text-neon-yellow font-bold">Loading posts...</p>
  }

  if (error) {
    return (
      <div className="bg-red-900 border-4 border-red-500 p-4 font-bold text-red-100">
        {error}
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="neobrutalist-card text-center py-8">
        <p className="text-brutalist-white font-bold">No posts yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <div
          key={post.id}
          className="neobrutalist-card hover:border-neon-cyan transition-all duration-200"
        >
          <div className="flex justify-between items-start mb-3">
            <h4 className="text-neon-pink font-bold text-lg">{post.author}</h4>
            <button
              onClick={() => handleDelete(post.id)}
              className="text-red-400 hover:text-red-300 font-bold text-xl"
            >
              ✕
            </button>
          </div>
          <p className="text-brutalist-white mb-3 leading-relaxed">
            {post.content}
          </p>
          <p className="text-neon-yellow text-sm font-bold">
            {new Date(post.createdAt).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  )
}
