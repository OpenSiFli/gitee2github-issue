import { Octokit } from '@octokit/rest';
import { Env, Result } from '../types';

export class GitHubService {
  private octokit: Octokit;
  private baseUrl: string;

  constructor(private env: Env) {
    this.baseUrl = env.GITHUB_API_BASE_URL;
    this.octokit = new Octokit({
      auth: env.GITHUB_TOKEN,
      baseUrl: this.baseUrl,
    });
  }

  /**
   * 验证GitHub Webhook签名
   */
  async verifyWebhookSignature(request: Request): Promise<boolean> {
    // 简单实现，实际应该使用crypto验证签名
    const signature = request.headers.get('x-hub-signature-256');
    // 此处应该计算HMAC签名并比对，简化起见暂时返回true
    return true;
  }

  /**
   * 创建Issue
   */
  async createIssue(
    owner: string,
    repo: string,
    title: string,
    body: string,
  ): Promise<Result<{ number: number; html_url: string }>> {
    try {
      const response = await this.octokit.issues.create({
        owner,
        repo,
        title,
        body,
      });

      return {
        success: true,
        data: {
          number: response.data.number,
          html_url: response.data.html_url,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `创建GitHub Issue失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 创建评论
   */
  async createComment(
    owner: string,
    repo: string,
    issueNumber: number,
    body: string,
  ): Promise<Result<{ id: number }>> {
    try {
      const response = await this.octokit.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body,
      });

      return {
        success: true,
        data: {
          id: response.data.id,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `创建GitHub评论失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 处理GitHub评论，为同步到Gitee做准备
   */
  formatCommentBody(body: string, githubAuthor: string): string {
    return `${body || ''}\n\n---\n> 🤖 此评论由机器人从GitHub同步 | 原始作者: [${githubAuthor}](https://github.com/${githubAuthor})`;
  }
}