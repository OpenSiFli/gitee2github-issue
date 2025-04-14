// Cloudflare Worker环境类型
export interface Env {
  DB: D1Database;
  GITHUB_TOKEN: string;
  GITEE_TOKEN: string;
  GITHUB_API_BASE_URL: string;
  GITEE_WEBHOOK_SECRET: string;
  GITHUB_WEBHOOK_SECRET: string;
  ADMIN_PASSWORD: string;  // 管理界面访问密码
  ASSETS: { fetch: (request: Request) => Promise<Response> }; // 静态资源绑定
}

// 仓库映射类型
export interface RepositoryMapping {
  id: number;
  gitee_owner: string;
  gitee_repo: string;
  github_owner: string;
  github_repo: string;
  created_at: string;
}

// Issue映射类型
export interface IssueMapping {
  id: number;
  gitee_issue_id: number;
  github_issue_number: number;
  repository_id: number;
  gitee_url: string;
  github_url: string;
  created_at: string;
}

// 评论映射类型
export interface CommentMapping {
  id: number;
  gitee_comment_id: number | null;
  github_comment_id: number | null;
  issue_id: number;
  created_at: string;
}

// Webhook事件类型
export interface WebhookEvent {
  id: number;
  event_id: string;
  event_type: string;
  source: 'gitee' | 'github';
  processed_at: string;
}

// Gitee Issue类型
export interface GiteeIssue {
  id: number;
  number: string;
  title: string;
  body: string;
  state: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  user: {
    id: number;
    login: string;
    name: string;
    avatar_url: string;
  };
  repository: {
    id: number;
    full_name: string;
    namespace: string;
    path: string;
  };
}

// Gitee Comment类型
export interface GiteeComment {
  id: number;
  body: string;
  user: {
    id: number;
    login: string;
    name: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
}

// Gitee Webhook事件类型
export interface GiteeWebhookEvent {
  action: string;
  hook_id: number;
  hook_name: string;
  timestamp: string;
  password?: string;
  issue?: GiteeIssue;
  comment?: GiteeComment;
  repository: {
    id: number;
    full_name: string;
    namespace: string;
    path: string;
    owner: {
      id: number;
      login: string;
      name: string;
      avatar_url: string;
    };
  };
}

// 操作结果
export interface Result<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}