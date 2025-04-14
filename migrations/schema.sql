-- 存储仓库映射关系
CREATE TABLE IF NOT EXISTS repository_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gitee_owner TEXT NOT NULL,
    gitee_repo TEXT NOT NULL,
    github_owner TEXT NOT NULL,
    github_repo TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(gitee_owner, gitee_repo)
);

-- 存储issue映射关系
CREATE TABLE IF NOT EXISTS issue_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gitee_issue_id INTEGER NOT NULL,
    github_issue_number INTEGER NOT NULL,
    repository_id INTEGER NOT NULL,
    gitee_url TEXT NOT NULL,
    github_url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(gitee_issue_id, repository_id),
    FOREIGN KEY(repository_id) REFERENCES repository_mappings(id)
);

-- 存储评论映射关系
CREATE TABLE IF NOT EXISTS comment_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gitee_comment_id INTEGER,
    github_comment_id INTEGER,
    issue_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(gitee_comment_id, github_comment_id, issue_id),
    FOREIGN KEY(issue_id) REFERENCES issue_mappings(id)
);

-- 存储webhook事件处理记录，防止重复处理
CREATE TABLE IF NOT EXISTS webhook_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    source TEXT NOT NULL, -- 'gitee' 或 'github'
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, source)
);