/**
 * Value Object: truncated comment text for notification previews.
 */
export class CommentPreview {
  private constructor(readonly value: string) {}

  static fromContent(content: string, maxLength = 50): CommentPreview {
    const trimmed = content.length > maxLength ? `${content.substring(0, maxLength)}...` : content;
    return new CommentPreview(trimmed);
  }

  toString(): string {
    return this.value;
  }
}
