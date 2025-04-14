import { Env, Result, GiteeIssue, GiteeComment } from '../types';

export class GiteeService {
  private token: string;

  constructor(private env: Env) {
    this.token = env.GITEE_TOKEN;
  }

  /**
   * 验证Gitee Webhook签名
   */
  async verifyWebhookSignature(request: Request): Promise<boolean> {
    // Gitee使用简单的密码验证方式
    const data = await request.json() as any;
    return data.password === this.env.GITEE_WEBHOOK_SECRET;
  }

  /**
   * 从Gitee获取Issue详情
   */
  async getIssue(owner: string, repo: string, issueNumber: string): Promise<Result<GiteeIssue>> {
    try {
      const response = await fetch(
        `https://gitee.com/api/v5/repos/${owner}/${repo}/issues/${issueNumber}`,
        {
          headers: {
            'Authorization': `token ${this.token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `获取Gitee Issue失败: ${error}` };
      }

      const issue = await response.json();
      return { success: true, data: issue as GiteeIssue };
    } catch (error) {
      return { success: false, error: `获取Gitee Issue异常: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * 创建评论
   */
  async createComment(owner: string, repo: string, issueNumber: string, body: string): Promise<Result<GiteeComment>> {
    try {
      const response = await fetch(
        `https://gitee.com/api/v5/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
        {
          method: 'POST',
          headers: {
            'Authorization': `token ${this.token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ body }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `创建Gitee评论失败: ${error}` };
      }

      const comment = await response.json();
      return { success: true, data: comment as GiteeComment };
    } catch (error) {
      return { success: false, error: `创建Gitee评论异常: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * 处理Gitee Issue正文，为同步到GitHub做准备
   */
  formatIssueBody(body: string, giteeIssueUrl: string, giteeAuthor: string): string {
    return `${body || ''}\n\n---\n> 🤖 此Issue由机器人从Gitee同步 | 原始作者: [${giteeAuthor}](https://gitee.com/${giteeAuthor}) | 原始链接: ${giteeIssueUrl}`;
  }

  /**
   * 处理Gitee评论，为同步到GitHub做准备
   */
  formatCommentBody(body: string, giteeAuthor: string): string {
    return `${body || ''}\n\n---\n> 🤖 此评论由机器人从Gitee同步 | 原始作者: [${giteeAuthor}](https://gitee.com/${giteeAuthor})`;
  }
}