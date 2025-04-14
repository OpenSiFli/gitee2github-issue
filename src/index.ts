import { SyncService } from './services/sync-service';
import { Env } from './types';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // 处理静态资源
    // 如果请求路径是 /admin，返回 admin.html 页面
    if (path === '/admin' || path === '/admin/') {
      return env.ASSETS.fetch(new Request('https://placeholder/admin.html', request));
    }

    // 创建同步服务实例
    const syncService = new SyncService(env);

    try {
      // 验证管理员访问
      if (path === '/api/auth' && request.method === 'POST') {
        const data = await request.json() as any;
        // 简单的密码验证，生产环境应使用更安全的方式
        const isValid = data.password === env.ADMIN_PASSWORD;
        
        return new Response(JSON.stringify({
          success: isValid,
          error: isValid ? null : '密码错误'
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 获取所有仓库映射
      if (path === '/api/repository-mappings' && request.method === 'GET') {
        const mappings = await syncService.getAllRepositoryMappings();
        return new Response(JSON.stringify({
          success: true,
          data: mappings
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 删除仓库映射
      if (path.match(/^\/api\/repository-mapping\/\d+$/) && request.method === 'DELETE') {
        const id = parseInt(path.split('/').pop() || '0', 10);
        const result = await syncService.deleteRepositoryMapping(id);
        
        return new Response(JSON.stringify({
          success: result.success,
          error: result.error
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 处理Gitee Webhook
      if (path === '/webhook/gitee' && request.method === 'POST') {
        const result = await syncService.handleGiteeWebhook(request.clone());
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
          status: result.success ? 200 : 400
        });
      }

      // 处理GitHub Webhook
      if (path === '/webhook/github' && request.method === 'POST') {
        const result = await syncService.handleGitHubWebhook(request.clone());
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
          status: result.success ? 200 : 400
        });
      }

      // 健康检查接口
      if (path === '/health' || path === '/') {
        return new Response(JSON.stringify({ status: 'ok', version: '1.0.0' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 添加仓库映射关系接口
      if (path === '/api/repository-mapping' && request.method === 'POST') {
        const data = await request.json() as any;
        const { gitee_owner, gitee_repo, github_owner, github_repo } = data;
        
        if (!gitee_owner || !gitee_repo || !github_owner || !github_repo) {
          return new Response(JSON.stringify({
            success: false,
            error: '参数不完整'
          }), {
            headers: { 'Content-Type': 'application/json' },
            status: 400
          });
        }

        const mappingId = await syncService.saveRepositoryMapping({
          gitee_owner,
          gitee_repo,
          github_owner,
          github_repo
        });

        return new Response(JSON.stringify({
          success: true,
          data: { id: mappingId }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 未找到接口
      return new Response('Not Found', { status: 404 });
    } catch (error) {
      // 错误处理
      console.error('Error handling request:', error);
      
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
  },
} satisfies ExportedHandler<Env>;
