-- 创建管理员账户
-- 用户名: admin
-- 密码: Admin@2024 (SHA-256 hash with prefix)

INSERT OR IGNORE INTO users (
    id,
    username,
    password_hash,
    role,
    name,
    created_at
) VALUES (
    'admin-001',
    'admin',
    '$sha256$ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f',
    'admin',
    '系统管理员',
    (strftime('%s', 'now') * 1000)
);

-- 创建测试教师账户
INSERT OR IGNORE INTO users (
    id,
    username,
    password_hash,
    role,
    name,
    created_at
) VALUES (
    'teacher-001',
    'teacher',
    '$sha256$ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f',
    'teacher',
    '测试教师',
    (strftime('%s', 'now') * 1000)
);

-- 创建测试学生账户
INSERT OR IGNORE INTO users (
    id,
    username,
    password_hash,
    role,
    name,
    created_at
) VALUES (
    'student-001',
    'student',
    '$sha256$ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f',
    'student',
    '测试学生',
    (strftime('%s', 'now') * 1000)
);
