import prisma from "../db";
import { CreatePostInput } from "../types/Post";

class PostRepository {
  async create(input: CreatePostInput) {
    return await prisma.post.create({
      data: {
        author: input.author,
        content: input.content,
        topicId: input.topic_id,
      },
      include: {
        topic: true,
      },
    });
  }

  async findAll() {
    return await prisma.post.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        topic: true,
      },
    });
  }

  async findById(id: string) {
    return await prisma.post.findUnique({
      where: { id },
      include: {
        topic: true,
      },
    });
  }

  async findByTopicId(topicId: string) {
    return await prisma.post.findMany({
      where: { topicId },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        topic: true,
      },
    });
  }

  async delete(id: string) {
    const result = await prisma.post.delete({
      where: { id },
    });
    return !!result;
  }
}

export default new PostRepository();
