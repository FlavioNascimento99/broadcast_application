import { Router, Request, Response, NextFunction } from "express";
import PostRepository from "../repositories/PostRepository";
import { CreatePostInput } from "../types/Post";
import { getEventService } from "../services/EventService";

const router = Router();

// POST /api/posts - Create a new post
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { author, content, topic_id } = req.body as CreatePostInput;

    if (!author || !content || !topic_id) {
      res.status(400).json({
        error: "Author, content, and topic_id are required",
      });
      return;
    }

    const post = await PostRepository.create({
      author,
      content,
      topic_id,
    });

    // Publish event to middleware
    try {
      const eventService = getEventService();
      if (eventService.isInitialized()) {
        await eventService.publishPostCreated({
          id: post.id,
          author: post.author,
          content: post.content,
          topic_id: post.topicId,
          created_at: post.createdAt,
        });
      }
    } catch (err) {
      console.error("[posts route] Error publishing event:", err);
      // Continue anyway - event publishing is not critical
    }

    res.status(201).json(post);
  } catch (err) {
    next(err);
  }
});

// GET /api/posts - List all posts
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const posts = await PostRepository.findAll();
    res.json(posts);
  } catch (err) {
    next(err);
  }
});

// GET /api/posts/:id - Get a specific post
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const post = await PostRepository.findById(id);

    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    res.json(post);
  } catch (err) {
    next(err);
  }
});

// GET /api/posts/topic/:topicId - Get posts by topic
router.get(
  "/topic/:topicId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { topicId } = req.params;
      const posts = await PostRepository.findByTopicId(topicId);
      res.json(posts);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/posts/:id - Delete a post
router.delete(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      // Get post data before deleting (for the event)
      const post = await PostRepository.findById(id);
      
      const deleted = await PostRepository.delete(id);

      if (!deleted) {
        res.status(404).json({ error: "Post not found" });
        return;
      }

      // Publish event to middleware
      if (post) {
        try {
          const eventService = getEventService();
          if (eventService.isInitialized()) {
            await eventService.publishPostDeleted({
              id: post.id,
              author: post.author,
              content: post.content,
              topic_id: post.topicId,
            });
          }
        } catch (err) {
          console.error("[posts route] Error publishing deletion event:", err);
          // Continue anyway - event publishing is not critical
        }
      }

      res.json({ success: true, message: "Post deleted" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
