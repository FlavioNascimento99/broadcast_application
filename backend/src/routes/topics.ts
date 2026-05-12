import { Router, Request, Response, NextFunction } from "express";
import TopicRepository from "../repositories/TopicRepository";
import { CreateTopicInput } from "../types/Topic";
import { getEventService } from "../services/EventService";

const router = Router();

// POST /api/topics - Create a new topic
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description } = req.body as CreateTopicInput;

    if (!name) {
      res.status(400).json({ error: "Topic name is required" });
      return;
    }

    const topic = await TopicRepository.create({ name, description });

    // Publish event to middleware
    try {
      const eventService = getEventService();
      if (eventService.isInitialized()) {
        await eventService.publishTopicCreated({
          id: topic.id,
          name: topic.name,
          description: topic.description,
          created_at: topic.created_at,
        });
      }
    } catch (err) {
      console.error("[topics route] Error publishing event:", err);
      // Continue anyway - event publishing is not critical
    }

    res.status(201).json(topic);
  } catch (err) {
    next(err);
  }
});

// GET /api/topics - List all topics
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const topics = await TopicRepository.findAll();
    res.json(topics);
  } catch (err) {
    next(err);
  }
});

// GET /api/topics/:id - Get a specific topic
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const topic = await TopicRepository.findById(id);

    if (!topic) {
      res.status(404).json({ error: "Topic not found" });
      return;
    }

    res.json(topic);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/topics/:id - Delete a topic
router.delete(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const deleted = await TopicRepository.delete(id);

      if (!deleted) {
        res.status(404).json({ error: "Topic not found" });
        return;
      }

      res.json({ success: true, message: "Topic deleted" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
