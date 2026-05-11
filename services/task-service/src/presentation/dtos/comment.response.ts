// src/presentation/dtos/comment.response.ts

export class CommentResponse {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  content: string;
  parentId: string | null;
  mentions: string[];
  isEdited: boolean;
  isDeleted: boolean;
  reactionCount: number;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: {
    id: string;
    taskId: string;
    authorId: string;
    authorName: string;
    authorAvatarUrl?: string;
    content: string;
    parentId: string | null;
    mentions: string[];
    isEdited: boolean;
    isDeleted: boolean;
    reactionCount: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = data.id;
    this.taskId = data.taskId;
    this.authorId = data.authorId;
    this.authorName = data.authorName;
    this.authorAvatarUrl = data.authorAvatarUrl;
    this.content = data.content;
    this.parentId = data.parentId;
    this.mentions = data.mentions;
    this.isEdited = data.isEdited;
    this.isDeleted = data.isDeleted;
    this.reactionCount = data.reactionCount;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }
}

export class GetCommentsResponse {
  comments: CommentResponse[];
  total: number;
  skip: number;
  limit: number;

  constructor(data: {
    comments: CommentResponse[];
    total: number;
    skip: number;
    limit: number;
  }) {
    this.comments = data.comments;
    this.total = data.total;
    this.skip = data.skip;
    this.limit = data.limit;
  }
}
