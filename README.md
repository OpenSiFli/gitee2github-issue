# Gitee to GitHub Issue Sync

![Gitee](https://img.shields.io/badge/Gitee-C71D23?style=for-the-badge&logo=gitee&logoColor=white)
![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)

一个自动化工具，用于在Gitee和GitHub之间同步Issues和评论。当Gitee仓库中创建了新的Issue或添加了评论，它们会自动同步到对应的GitHub仓库，反之亦然。

## 📝 功能特点

- **双向同步**：在Gitee上创建的Issue会自动同步到GitHub，GitHub上的评论会自动同步回Gitee
- **评论追踪**：保持两个平台上的评论同步，便于跨平台协作
- **易于配置**：提供直观的Web管理界面，可视化管理仓库映射关系
- **安全可靠**：使用Cloudflare Workers和D1数据库，确保高可用性和数据安全
- **明确标注**：清晰标注原始作者和来源平台，避免混淆

## 🚀 快速开始

### 部署前提

- [Node.js](https://nodejs.org/) (推荐 v16+)
- [Cloudflare账号](https://dash.cloudflare.com/sign-up)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

### 安装步骤

1. 克隆仓库
```bash
git clone https://github.com/OpenSiFli/gitee2github-issue.git
cd gitee2github-issue
```

2. 安装依赖
```bash
npm install
```

3. 登录Cloudflare
```bash
npx wrangler login
```

4. 创建D1数据库
```bash
npx wrangler d1 create gitee2github_db
```

5. 更新`wrangler.jsonc`文件中的数据库ID
```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "gitee2github_db",
      "database_id": "<复制步骤4中生成的ID>"
    }
  ]
}
```

6. 应用数据库结构
```bash
npx wrangler d1 execute gitee2github_db --remote --file=./migrations/schema.sql
```

7. 设置必要的密钥（选择使用个人令牌或GitHub App）

   **方式一：使用个人访问令牌（传统方式）**
   ```bash
   # GitHub API令牌
   npx wrangler secret put GITHUB_TOKEN

   # Gitee API令牌
   npx wrangler secret put GITEE_TOKEN

   # Gitee Webhook密钥
   npx wrangler secret put GITEE_WEBHOOK_SECRET

   # GitHub Webhook密钥
   npx wrangler secret put GITHUB_WEBHOOK_SECRET

   # 管理界面访问密码
   npx wrangler secret put ADMIN_PASSWORD
   ```

   **方式二：使用GitHub App（推荐方式）**
   ```bash
   # GitHub App ID
   npx wrangler secret put GITHUB_APP_ID

   # GitHub App 私钥（注意处理多行私钥）
   npx wrangler secret put GITHUB_PRIVATE_KEY

   # GitHub App 安装ID
   npx wrangler secret put GITHUB_INSTALLATION_ID

   # Gitee API令牌
   npx wrangler secret put GITEE_TOKEN

   # Gitee Webhook密钥
   npx wrangler secret put GITEE_WEBHOOK_SECRET

   # GitHub Webhook密钥
   npx wrangler secret put GITHUB_WEBHOOK_SECRET

   # 管理界面访问密码
   npx wrangler secret put ADMIN_PASSWORD
   ```

8. 部署Worker
   ```bash
   npx wrangler deploy
   ```

## ⚙️ 配置

### 环境变量

本项目需要配置以下环境变量（密钥）：

| 环境变量 | 说明 | 获取方式 |
|----------|------|---------|
| GitHub 认证 - 二选一 | | |
| `GITHUB_TOKEN` | GitHub API访问令牌(个人令牌方式) | 在GitHub [Personal access tokens](https://github.com/settings/tokens) 页面创建，需要`repo`权限 |
| `GITHUB_APP_ID` | GitHub App ID (推荐) | 创建GitHub App后获取的ID |
| `GITHUB_PRIVATE_KEY` | GitHub App 私钥 (推荐) | 创建GitHub App时生成的私钥 |
| `GITHUB_INSTALLATION_ID` | GitHub App 安装ID (推荐) | 将GitHub App安装到组织或仓库后获得的安装ID |
| 其他配置 | | |
| `GITEE_TOKEN` | Gitee API访问令牌 | 在Gitee [设置-私人令牌](https://gitee.com/profile/personal_access_tokens) 创建，需要`issues`和`notes`权限 |
| `GITEE_WEBHOOK_SECRET` | Gitee webhook的密钥 | 自定义密码，与在Gitee仓库中配置Webhook时使用的密码相同 |
| `GITHUB_WEBHOOK_SECRET` | GitHub webhook的secret | 自定义密码，与在GitHub仓库中配置Webhook时使用的secret相同 |
| `ADMIN_PASSWORD` | 管理界面访问密码 | 自定义密码，用于访问Web管理界面 |

### 配置Webhook

#### Gitee仓库配置

1. 访问Gitee仓库 -> 管理 -> Webhooks -> 添加webhook
2. URL设置为: `https://<your-worker-url>/webhook/gitee`
3. 添加密码（与`GITEE_WEBHOOK_SECRET`相同）
4. 选择触发事件: Issues、Note（评论）

#### GitHub仓库配置

1. 访问GitHub仓库 -> Settings -> Webhooks -> Add webhook
2. Payload URL设置为: `https://<your-worker-url>/webhook/github`
3. Content type选择: `application/json`
4. Secret设置为与`GITHUB_WEBHOOK_SECRET`相同的值
5. 选择事件: Issues、Issue comments

### 设置GitHub App（推荐）

使用GitHub App比个人访问令牌有更多优势，包括更精细的权限控制和更好的安全性。以下是创建和配置GitHub App的步骤：

1. **创建GitHub App**:
   - 访问 [GitHub Developer Settings](https://github.com/settings/apps) > New GitHub App
   - 填写App名称（如 "Gitee-GitHub Sync"）
   - 主页URL：您的项目或组织网站
   - Webhook URL：`https://<your-worker-url>/webhook/github`
   - Webhook secret：与`GITHUB_WEBHOOK_SECRET`相同的值
   - 权限设置：
     - Repository permissions:
       - Issues: Read & write
       - Metadata: Read-only
   - 事件订阅：
     - Issues
     - Issue comment

2. **生成私钥**:
   - 创建完App后，滚动到页面底部
   - 点击"Generate a private key"生成并下载私钥文件

3. **安装App到您的组织或仓库**:
   - 点击左侧的"Install App"
   - 选择要安装的组织或用户账户
   - 选择要授权访问的仓库
   - 点击"Install"

4. **获取必要的信息**:
   - App ID: 在App设置页面顶部可以找到
   - 安装ID: 安装App后，您可以在以下URL查找安装ID：
     `https://github.com/settings/installations/<installation-id>`
   - 私钥: 之前下载的私钥文件，需要读取内容（**注意格式要求**）

5. **私钥格式转换**:
   GitHub App 要求使用 **PKCS#8** 格式的私钥，但 GitHub 默认下载的是 **PKCS#1** 格式，需要进行转换：

   ```bash
   # 将 PKCS#1 格式的私钥转换为 PKCS#8 格式
   # 确保私钥文件已下载并位于合适的目录
   openssl pkcs8 -topk8 -inform PEM -outform PEM -in 原始私钥文件.pem -out 转换后私钥文件.pem -nocrypt
   ```
   
   如果不进行转换，可能会遇到以下错误：
   `[universal-github-app-jwt] Private Key is in PKCS#1 format, but only PKCS#8 is supported.`

6. **配置环境变量**:
   使用以下命令设置必要的密钥：

   ```bash
   # 设置GitHub App ID
   npx wrangler secret put GITHUB_APP_ID
   
   # 设置GitHub App私钥（使用转换后的PKCS#8格式私钥）
   # 确保所有换行符被替换为"\n"
   cat 转换后私钥文件.pem | tr '\n' 'Z' | sed 's/Z/\\n/g' | npx wrangler secret put GITHUB_PRIVATE_KEY
   
   # 设置GitHub App安装ID
   npx wrangler secret put GITHUB_INSTALLATION_ID
   ```

## 💻 管理仓库映射

### Web管理界面

最简单的管理方式是使用内置的Web管理界面：

1. 访问 `https://<your-worker-url>/admin`
2. 使用您设置的`ADMIN_PASSWORD`登录
3. 在界面上添加、查看或删除仓库映射

### API接口

也可以通过API添加仓库映射：

```bash
curl -X POST https://<your-worker-url>/api/repository-mapping \
  -H "Authorization: Bearer YOUR_ADMIN_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{
    "gitee_owner": "your-gitee-owner", 
    "gitee_repo": "your-gitee-repo", 
    "github_owner": "your-github-owner", 
    "github_repo": "your-github-repo"
  }'
```

## 🔍 关键数据表

本项目使用以下数据表来存储必要信息：

### 仓库映射表 (repository_mappings)

存储Gitee和GitHub仓库之间的映射关系。

| 字段名 | 说明 |
|--------|------|
| id | 主键 |
| gitee_owner | Gitee仓库拥有者 |
| gitee_repo | Gitee仓库名称 |
| github_owner | GitHub仓库拥有者 |
| github_repo | GitHub仓库名称 |
| created_at | 创建时间 |

### Issue映射表 (issue_mappings)

存储Gitee和GitHub的Issue之间的映射关系。

| 字段名 | 说明 |
|--------|------|
| id | 主键 |
| gitee_issue_id | Gitee Issue ID |
| github_issue_number | GitHub Issue编号 |
| repository_id | 关联的仓库映射ID |
| gitee_url | Gitee Issue URL |
| github_url | GitHub Issue URL |
| created_at | 创建时间 |
| gitee_issue_number | Gitee Issue编号 |

### 评论映射表 (comment_mappings)

存储评论之间的映射关系。

| 字段名 | 说明 |
|--------|------|
| id | 主键 |
| gitee_comment_id | Gitee评论ID |
| github_comment_id | GitHub评论ID |
| issue_id | 关联的Issue映射ID |
| created_at | 创建时间 |

## 🛠️ 维护指南

### 添加新的仓库映射

1. 访问管理界面: `https://<your-worker-url>/admin`
2. 登录后，填写表单添加新的仓库映射:
   - Gitee仓库拥有者: 如 `openeuler`
   - Gitee仓库名称: 如 `community`
   - GitHub仓库拥有者: 如 `open-source-alliance`
   - GitHub仓库名称: 如 `community-mirror`
3. 点击"添加映射"按钮

### 更新环境变量

如果需要更新任何环境变量(例如TOKEN过期)：

```bash
# 更新GitHub TOKEN（个人令牌方式）
npx wrangler secret put GITHUB_TOKEN

# 更新GitHub App相关参数（App方式）
npx wrangler secret put GITHUB_APP_ID
npx wrangler secret put GITHUB_PRIVATE_KEY
npx wrangler secret put GITHUB_INSTALLATION_ID

# 更新Gitee TOKEN
npx wrangler secret put GITEE_TOKEN

# 更新管理界面密码
npx wrangler secret put ADMIN_PASSWORD
```

### GitHub App 私钥处理

如果使用 GitHub App 方式授权，需要特别注意私钥的格式和处理：

1. **格式要求**：GitHub App 认证要求使用 PKCS#8 格式的私钥，但 GitHub 下载的默认是 PKCS#1 格式

2. **格式转换**：
   ```bash
   # 转换私钥格式从 PKCS#1 到 PKCS#8
   openssl pkcs8 -topk8 -inform PEM -outform PEM -in 下载的私钥.pem -out 转换后私钥.pem -nocrypt
   ```

3. **处理换行符**：环境变量不支持多行内容，需要将私钥处理为单行
   ```bash
   # 在macOS/Linux上，可以使用以下命令将多行私钥转换为单行并设置为环境变量
   cat 转换后私钥.pem | tr '\n' 'Z' | sed 's/Z/\\n/g' | npx wrangler secret put GITHUB_PRIVATE_KEY
   ```

4. **常见错误**：如果看到以下错误，说明您需要转换私钥格式
   ```
   [universal-github-app-jwt] Private Key is in PKCS#1 format, but only PKCS#8 is supported.
   ```

### 应用数据库更改

如果修改了数据库结构：

```bash
npx wrangler d1 execute gitee2github_db --remote --file=./migrations/your-new-migration.sql
```

### 常见问题排查

- **Issue同步失败**: 检查仓库映射和API令牌
- **Webhook不触发**: 验证Webhook URL和密钥配置
- **无法访问管理界面**: 确认`ADMIN_PASSWORD`正确设置

## 📦 项目结构

```txt
gitee2github-issue/
├── migrations/
│   └── schema.sql           # 数据库表结构
├── src/
│   ├── index.ts             # 主入口文件
│   ├── services/
│   │   ├── gitee-service.ts # Gitee API服务
│   │   ├── github-service.ts # GitHub API服务（支持个人令牌和GitHub App两种认证方式）
│   │   └── sync-service.ts  # 同步核心逻辑
│   ├── static/
│   │   └── admin.html       # 管理界面
│   └── types/
│       └── index.ts         # 类型定义
├── test/                    # 测试文件
├── package.json
└── wrangler.jsonc           # Cloudflare Workers配置
```

## 📋 API端点参考

| 端点 | 方法 | 说明 | 授权要求 |
|------|------|------|----------|
| `/` | `GET` | 健康检查 | 不需要 |
| `/webhook/gitee` | `POST` | 接收Gitee webhook事件 | 请求体中需包含Gitee webhook密钥 |
| `/webhook/github` | `POST` | 接收GitHub webhook事件 | 需GitHub webhook签名验证 |
| `/admin` | `GET` | 管理界面 | 通过UI登录验证 |
| `/api/auth` | `POST` | 管理界面验证 | 不需要 |
| `/api/repository-mapping` | `POST` | 创建仓库映射 | Bearer Token验证 |
| `/api/repository-mappings` | `GET` | 获取所有仓库映射 | Bearer Token验证 |
| `/api/repository-mapping/:id` | `DELETE` | 删除仓库映射 | Bearer Token验证 |

## 📄 许可证

Apache-2.0 License