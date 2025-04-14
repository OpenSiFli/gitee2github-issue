import { Env, Result, GiteeWebhookEvent, RepositoryMapping, IssueMapping } from '../types';
import { GiteeService } from './gitee-service';
import { GitHubService } from './github-service';

export class SyncService {
  private giteeService: GiteeService;
  private githubService: GitHubService;

  constructor(private env: Env) {
    this.giteeService = new GiteeService(env);
    this.githubService = new GitHubService(env);
  }

  /**
   * 处理Gitee的Webhook事件
   */
  async handleGiteeWebhook(request: Request): Promise<Result<string>> {
    try {
      // 验证Webhook签名
      const isValid = await this.giteeService.verifyWebhookSignature(request.clone());
      if (!isValid) {
        return { success: false, error: 'Gitee Webhook签名验证失败' };
      }

      const event = await request.json() as GiteeWebhookEvent;
      const eventId = `gitee-${event.hook_id}-${Date.now()}`;

      // 检查是否已处理过此事件
      const eventExists = await this.checkWebhookEventExists(eventId, 'gitee');
      if (eventExists) {
        return { success: true, data: '事件已处理过，跳过' };
      }

      // 根据事件类型处理
      if (event.hook_name === 'issue_hooks' && event.action === 'open') {
        // 处理新建Issue事件
        return await this.handleGiteeNewIssue(event, eventId);
      } else if ((event.hook_name === 'issue_hooks' || event.hook_name === 'note_hooks') && event.action === 'comment') {
        // 处理Issue评论事件
        return await this.handleGiteeNewComment(event, eventId);
      }

      return { success: true, data: `不支持的事件类型: ${event.hook_name} ${event.action}` };
    } catch (error) {
      return { success: false, error: `处理Gitee Webhook异常: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * 处理GitHub的Webhook事件
   */
  async handleGitHubWebhook(request: Request): Promise<Result<string>> {
    try {
      // 验证Webhook签名
      const isValid = await this.githubService.verifyWebhookSignature(request.clone());
      if (!isValid) {
        return { success: false, error: 'GitHub Webhook签名验证失败' };
      }

      const event = await request.json() as any; // 使用octokit类型处理
      const eventType = request.headers.get('x-github-event') || 'unknown';
      const eventId = request.headers.get('x-github-delivery') || `github-${Date.now()}`;

      // 检查是否已处理过此事件
      const eventExists = await this.checkWebhookEventExists(eventId, 'github');
      if (eventExists) {
        return { success: true, data: '事件已处理过，跳过' };
      }

      // 根据事件类型处理
      if (eventType === 'issues' && event.action === 'opened') {
        // 不处理GitHub新建Issue，因为我们专注于Gitee到GitHub的同步
        return { success: true, data: '不处理GitHub新建Issue事件' };
      } else if (eventType === 'issue_comment' && event.action === 'created') {
        // 处理Issue评论事件
        return await this.handleGitHubNewComment(event, eventId);
      }

      return { success: true, data: `不支持的事件类型: ${eventType} ${event.action}` };
    } catch (error) {
      return { success: false, error: `处理GitHub Webhook异常: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * 处理Gitee新建Issue事件
   */
  private async handleGiteeNewIssue(event: GiteeWebhookEvent, eventId: string): Promise<Result<string>> {
    try {
      if (!event.issue) {
        return { success: false, error: 'Issue信息不存在' };
      }

      // 从仓库路径解析owner和repo
      const [giteeOwner, giteeRepo] = event.repository.full_name.split('/');
      if (!giteeOwner || !giteeRepo) {
        return { success: false, error: `无效的仓库路径: ${event.repository.full_name}` };
      }

      // 查找仓库映射关系
      const repoMapping = await this.getRepositoryMapping(giteeOwner, giteeRepo);
      if (!repoMapping) {
        return { success: false, error: `找不到仓库映射关系: ${giteeOwner}/${giteeRepo}` };
      }

      const issueId = event.issue.id;
      const issueNumber = event.issue.number; // 这是Gitee的issue编号，如I123AB
      const issueTitle = event.issue.title;
      const issueBody = event.issue.body;
      const issueUrl = event.issue.html_url;
      const authorName = event.issue.user.login;

      // 格式化Issue内容
      const formattedBody = this.giteeService.formatIssueBody(
        issueBody,
        issueUrl,
        authorName
      );

      // 在GitHub上创建对应的Issue
      const createResult = await this.githubService.createIssue(
        repoMapping.github_owner,
        repoMapping.github_repo,
        issueTitle,
        formattedBody
      );

      if (!createResult.success) {
        return { success: false, error: createResult.error };
      }

      // 保存Issue映射关系，添加gitee_issue_number字段
      await this.saveIssueMapping({
        gitee_issue_id: issueId,
        gitee_issue_number: issueNumber, // 保存实际的issue编号
        github_issue_number: createResult.data!.number,
        repository_id: repoMapping.id,
        gitee_url: issueUrl,
        github_url: createResult.data!.html_url
      });

      // 记录已处理的事件
      await this.saveWebhookEvent(eventId, 'issue_open', 'gitee');

      return { success: true, data: `成功同步Issue到GitHub: ${createResult.data!.html_url}` };
    } catch (error) {
      return { success: false, error: `处理Gitee新建Issue异常: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * 处理Gitee新评论事件
   */
  private async handleGiteeNewComment(event: GiteeWebhookEvent, eventId: string): Promise<Result<string>> {
    try {
      if (!event.issue || !event.comment) {
        return { success: false, error: 'Issue或评论信息不存在' };
      }

      // 从仓库路径解析owner和repo
      const [giteeOwner, giteeRepo] = event.repository.full_name.split('/');
      if (!giteeOwner || !giteeRepo) {
        return { success: false, error: `无效的仓库路径: ${event.repository.full_name}` };
      }

      // 查找仓库映射关系
      const repoMapping = await this.getRepositoryMapping(giteeOwner, giteeRepo);
      if (!repoMapping) {
        return { success: false, error: `找不到仓库映射关系: ${giteeOwner}/${giteeRepo}` };
      }

      // 查找Issue映射关系
      const issueMapping = await this.getIssueMapping(event.issue.id, repoMapping.id);
      if (!issueMapping) {
        return { success: false, error: `找不到Issue映射关系: ${event.issue.id}` };
      }

      const commentId = event.comment.id;
      const commentBody = event.comment.body;
      const authorName = event.comment.user.login;

      // 格式化评论内容
      const formattedBody = this.giteeService.formatCommentBody(commentBody, authorName);

      // 在GitHub上创建对应的评论
      const createResult = await this.githubService.createComment(
        repoMapping.github_owner,
        repoMapping.github_repo,
        issueMapping.github_issue_number,
        formattedBody
      );

      if (!createResult.success) {
        return { success: false, error: createResult.error };
      }

      // 保存评论映射关系
      await this.saveCommentMapping({
        gitee_comment_id: commentId,
        github_comment_id: createResult.data!.id,
        issue_id: issueMapping.id,
      });

      // 记录已处理的事件
      await this.saveWebhookEvent(eventId, 'comment_create', 'gitee');

      return { success: true, data: `成功同步Gitee评论到GitHub` };
    } catch (error) {
      return { success: false, error: `处理Gitee新评论异常: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * 处理GitHub新评论事件
   */
  private async handleGitHubNewComment(event: any, eventId: string): Promise<Result<string>> {
    try {
      const issueNumber = event.issue.number;
      const commentId = event.comment.id;
      const commentBody = event.comment.body;
      const authorName = event.comment.user.login;
      const [githubOwner, githubRepo] = event.repository.full_name.split('/');

      // 查找仓库映射关系
      const repoMapping = await this.getRepositoryMappingByGithub(githubOwner, githubRepo);
      if (!repoMapping) {
        return { success: false, error: `找不到仓库映射关系: ${githubOwner}/${githubRepo}` };
      }

      // 查找Issue映射关系
      const issueMapping = await this.getIssueMappingByGithub(issueNumber, repoMapping.id);
      if (!issueMapping) {
        return { success: false, error: `找不到Issue映射关系: ${issueNumber}` };
      }

      // 格式化评论内容
      const formattedBody = this.githubService.formatCommentBody(commentBody, authorName);

      // 在Gitee上创建对应的评论
      // 修改：使用gitee_issue_number而不是gitee_issue_id
      if (!issueMapping.gitee_issue_number) {
        return { success: false, error: `找不到对应的Gitee Issue编号` };
      }

      const giteeIssueNumber = issueMapping.gitee_issue_number; // 使用正确的issue编号
      const createResult = await this.giteeService.createComment(
        repoMapping.gitee_owner,
        repoMapping.gitee_repo,
        giteeIssueNumber,
        formattedBody
      );

      if (!createResult.success) {
        return { success: false, error: createResult.error };
      }

      // 保存评论映射关系
      await this.saveCommentMapping({
        gitee_comment_id: createResult.data!.id,
        github_comment_id: commentId,
        issue_id: issueMapping.id,
      });

      // 记录已处理的事件
      await this.saveWebhookEvent(eventId, 'comment_create', 'github');

      return { success: true, data: `成功同步GitHub评论到Gitee` };
    } catch (error) {
      return { success: false, error: `处理GitHub新评论异常: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  //==========================
  // 数据库操作方法
  //==========================

  /**
   * 检查Webhook事件是否已处理
   */
  private async checkWebhookEventExists(eventId: string, source: 'gitee' | 'github'): Promise<boolean> {
    try {
      const result = await this.env.DB.prepare(
        `SELECT id FROM webhook_events WHERE event_id = ? AND source = ?`
      )
        .bind(eventId, source)
        .first<{ id: number }>();
      return !!result;
    } catch {
      return false;
    }
  }

  /**
   * 保存Webhook事件处理记录
   */
  private async saveWebhookEvent(eventId: string, eventType: string, source: 'gitee' | 'github'): Promise<void> {
    await this.env.DB.prepare(
      `INSERT INTO webhook_events (event_id, event_type, source) VALUES (?, ?, ?)`
    )
      .bind(eventId, eventType, source)
      .run();
  }

  /**
   * 获取仓库映射
   */
  private async getRepositoryMapping(giteeOwner: string, giteeRepo: string): Promise<RepositoryMapping | null> {
    try {
      const result = await this.env.DB.prepare(
        `SELECT * FROM repository_mappings WHERE gitee_owner = ? AND gitee_repo = ?`
      )
        .bind(giteeOwner, giteeRepo)
        .first<RepositoryMapping>();
      return result || null;
    } catch {
      return null;
    }
  }

  /**
   * 根据GitHub仓库信息获取仓库映射
   */
  private async getRepositoryMappingByGithub(githubOwner: string, githubRepo: string): Promise<RepositoryMapping | null> {
    try {
      const result = await this.env.DB.prepare(
        `SELECT * FROM repository_mappings WHERE github_owner = ? AND github_repo = ?`
      )
        .bind(githubOwner, githubRepo)
        .first<RepositoryMapping>();
      return result || null;
    } catch {
      return null;
    }
  }

  /**
   * 保存仓库映射
   */
  async saveRepositoryMapping(mapping: Omit<RepositoryMapping, 'id' | 'created_at'>): Promise<number> {
    const result = await this.env.DB.prepare(
      `INSERT INTO repository_mappings (gitee_owner, gitee_repo, github_owner, github_repo)
       VALUES (?, ?, ?, ?)
       RETURNING id`
    )
      .bind(mapping.gitee_owner, mapping.gitee_repo, mapping.github_owner, mapping.github_repo)
      .first<{ id: number }>();
    
    return result?.id || 0;
  }

  /**
   * 获取Issue映射
   */
  private async getIssueMapping(giteeIssueId: number, repositoryId: number): Promise<IssueMapping | null> {
    try {
      const result = await this.env.DB.prepare(
        `SELECT * FROM issue_mappings WHERE gitee_issue_id = ? AND repository_id = ?`
      )
        .bind(giteeIssueId, repositoryId)
        .first<IssueMapping>();
      return result || null;
    } catch {
      return null;
    }
  }

  /**
   * 根据GitHub Issue获取Issue映射
   */
  private async getIssueMappingByGithub(githubIssueNumber: number, repositoryId: number): Promise<IssueMapping | null> {
    try {
      const result = await this.env.DB.prepare(
        `SELECT * FROM issue_mappings WHERE github_issue_number = ? AND repository_id = ?`
      )
        .bind(githubIssueNumber, repositoryId)
        .first<IssueMapping>();
      return result || null;
    } catch {
      return null;
    }
  }

  /**
   * 保存Issue映射
   */
  private async saveIssueMapping(mapping: Omit<IssueMapping, 'id' | 'created_at'>): Promise<number> {
    const result = await this.env.DB.prepare(
      `INSERT INTO issue_mappings (gitee_issue_id, gitee_issue_number, github_issue_number, repository_id, gitee_url, github_url)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING id`
    )
      .bind(
        mapping.gitee_issue_id,
        mapping.gitee_issue_number,
        mapping.github_issue_number,
        mapping.repository_id,
        mapping.gitee_url,
        mapping.github_url
      )
      .first<{ id: number }>();
    
    return result?.id || 0;
  }

  /**
   * 保存评论映射
   */
  private async saveCommentMapping(mapping: {
    gitee_comment_id: number | null;
    github_comment_id: number | null;
    issue_id: number;
  }): Promise<void> {
    await this.env.DB.prepare(
      `INSERT INTO comment_mappings (gitee_comment_id, github_comment_id, issue_id)
       VALUES (?, ?, ?)`
    )
      .bind(mapping.gitee_comment_id, mapping.github_comment_id, mapping.issue_id)
      .run();
  }

  /**
   * 获取所有仓库映射
   */
  async getAllRepositoryMappings(): Promise<RepositoryMapping[]> {
    try {
      const result = await this.env.DB.prepare(
        `SELECT * FROM repository_mappings ORDER BY id DESC`
      ).all<RepositoryMapping>();
      
      return result.results || [];
    } catch (error) {
      console.error('获取仓库映射失败:', error);
      return [];
    }
  }

  /**
   * 删除仓库映射
   */
  async deleteRepositoryMapping(id: number): Promise<Result<boolean>> {
    try {
      // 查找是否有关联的issue映射
      const issueMapping = await this.env.DB.prepare(
        `SELECT id FROM issue_mappings WHERE repository_id = ? LIMIT 1`
      )
        .bind(id)
        .first<{ id: number }>();

      if (issueMapping) {
        return { 
          success: false, 
          error: '无法删除：此仓库映射已关联issue，删除可能会破坏同步功能' 
        };
      }

      // 如果没有关联issue，可以安全删除
      await this.env.DB.prepare(
        `DELETE FROM repository_mappings WHERE id = ?`
      ).bind(id).run();

      return { success: true, data: true };
    } catch (error) {
      return { 
        success: false, 
        error: `删除仓库映射失败: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }
}