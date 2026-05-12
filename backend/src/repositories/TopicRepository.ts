import prisma from "../db";
import { CreateTopicInput } from "../types/Topic";

class TopicRepository {
  async create(input: CreateTopicInput) {
    return await prisma.topic.create({
      data: {
        name: input.name,
        description: input.description,
      },
    });
  }

  async findAll() {
    return await prisma.topic.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        posts: true,
      },
    });
  }

  async findById(id: string) {
    return await prisma.topic.findUnique({
      where: { id },
      include: {
        posts: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });
  }

  async delete(id: string) {
    const result = await prisma.topic.delete({
      where: { id },
    });
    return !!result;
  }
}

export default new TopicRepository();

