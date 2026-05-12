export interface Topic {
  id: string;
  name: string;
  description: string;
  created_at: Date;
}

export interface CreateTopicInput {
  name: string;
  description: string;
}
