export interface Post {
  id:             string;
  author:         string;
  content:        string;
  topic_id:       string;
  created_at:     Date;
}

export interface CreatePostInput {
  author:         string;
  content:        string;
  topic_id:       string;
}
