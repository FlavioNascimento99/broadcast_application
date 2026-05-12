# Test API Endpoints

## Health Check

```bash
curl http://localhost:3000/api/health
```

## Database Connectivity

```bash
curl http://localhost:3000/api/db/ping
```

## Topics

### Create a topic

```bash
curl -X POST http://localhost:3000/api/topics \
  -H "Content-Type: application/json" \
  -d '{"name":"Tech News","description":"Latest technology updates"}'
```

### List all topics

```bash
curl http://localhost:3000/api/topics
```

### Get a specific topic

Replace `{topic_id}` with an actual UUID:

```bash
curl http://localhost:3000/api/topics/{topic_id}
```

### Delete a topic

```bash
curl -X DELETE http://localhost:3000/api/topics/{topic_id}
```

## Posts

### Create a post

Replace `{topic_id}` with an actual UUID from a created topic:

```bash
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -d '{"author":"John Doe","content":"This is an interesting article about TypeScript","topic_id":"{topic_id}"}'
```

### List all posts

```bash
curl http://localhost:3000/api/posts
```

### Get posts by topic

```bash
curl http://localhost:3000/api/posts/topic/{topic_id}
```

### Get a specific post

```bash
curl http://localhost:3000/api/posts/{post_id}
```

### Delete a post

```bash
curl -X DELETE http://localhost:3000/api/posts/{post_id}
```

## Example Flow

1. Create a topic:

```bash
curl -X POST http://localhost:3000/api/topics \
  -H "Content-Type: application/json" \
  -d '{"name":"JavaScript","description":"JavaScript and Node.js topics"}' | jq .id
```

Copy the returned `id` and use it in the next step.

2. Create a post in that topic:

```bash
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -d '{"author":"Alice","content":"TypeScript is great!","topic_id":"<paste-topic-id-here>"}'
```

3. List posts in that topic:

```bash
curl http://localhost:3000/api/posts/topic/<paste-topic-id-here>
```
