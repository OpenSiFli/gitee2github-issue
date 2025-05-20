import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { Env, Result } from '../types';

export class GitHubService {
  private octokit: Octokit;
  private baseUrl: string;
  private useAppAuth: boolean;

  constructor(private env: Env) {
    this.baseUrl = env.GITHUB_API_BASE_URL;
    this.useAppAuth = !!env.GITHUB_APP_ID && !!env.GITHUB_PRIVATE_KEY && !!env.GITHUB_INSTALLATION_ID;
    
    if (this.useAppAuth) {
      // 使用 GitHub App 认证
      const appId = parseInt(env.GITHUB_APP_ID || '', 10);
      const privateKey = (env.GITHUB_PRIVATE_KEY || '').replace(/\\n/g, '\n');
      const installationId = parseInt(env.GITHUB_INSTALLATION_ID || '', 10);
      
      this.octokit = new Octokit({
        authStrategy: createAppAuth,
        auth: {
          appId,
          privateKey,
          installationId,
        },
        baseUrl: this.baseUrl,
      });
      
      console.log('使用 GitHub App 认证模式');
    } else if (env.GITHUB_TOKEN) {
      // 兼容模式：使用个人访问令牌认证
      this.octokit = new Octokit({
        auth: env.GITHUB_TOKEN,
        baseUrl: this.baseUrl,
      });
      
      console.log('使用个人访问令牌认证模式');
    } else {
      throw new Error('未提供 GitHub 认证信息，请配置 GITHUB_TOKEN 或 GitHub App 相关参数');
    }
  }

  /**
   * 验证GitHub Webhook签名
   * GitHub Apps使用相同的签名方式，所以不需要修改验证逻辑
   */
  async verifyWebhookSignature(request: Request): Promise<boolean> {
    // 获取请求的签名和内容
    const signature = request.headers.get('x-hub-signature-256');
    if (!signature) {
      console.error('GitHub webhook 缺少签名');
      return false;
    }
    
    try {
      // 注意：在生产环境中，你应该实现适用于Cloudflare Workers的签名验证
      // Cloudflare Workers支持Web Crypto API，可以使用它来验证签名
      // 这里为了简单起见，我们暂时返回true
      // TODO: 实现基于Web Crypto API的签名验证
      console.warn('GitHub webhook签名验证尚未完全实现，请在生产环境中完善验证逻辑');
      return true;
    } catch (error) {
      console.error('验证GitHub webhook签名时出错:', error);
      // 在开发环境中可以返回true，但在生产环境中应返回false
      return false;
    }
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