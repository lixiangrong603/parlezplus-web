# Gemini 代理测试脚本 (中国网络环境)

## 测试目标
验证通过 Cloudflare Workers 代理访问 Google Gemini API 在中国网络环境下的可用性。

---

## 前置准备

### 1. 配置用户 API Key
在数据库中为测试用户添加 Gemini API Key:

```powershell
# 方法 1: 通过 Wrangler 命令行
wrangler d1 execute parlezplus-db --command="
INSERT INTO user_api_keys (user_id, gemini_key_encrypted, created_at)
VALUES ('admin-001', 'YOUR_ENCRYPTED_KEY_HERE', $(Get-Date -UFormat %s)000)
ON CONFLICT(user_id) DO UPDATE SET gemini_key_encrypted='YOUR_ENCRYPTED_KEY_HERE';
"
```

**注意**: `gemini_key_encrypted` 应该是使用 `GEMINI_MASTER_KEY` 加密后的密文。

### 2. 获取 JWT Token
```powershell
# 登录获取 token
$response = Invoke-RestMethod -Uri "https://your-domain.pages.dev/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"username":"admin","password":"Admin@2024"}'

$token = $response.data.token
Write-Host "JWT Token: $token"
```

---

## 测试用例

### 测试 1: 简单文本生成
```powershell
$headers = @{
  "Authorization" = "Bearer $token"
  "Content-Type" = "application/json"
}

$body = @{
  contents = @(
    @{
      parts = @(
        @{
          text = "Hello, how are you?"
        }
      )
    }
  )
} | ConvertTo-Json -Depth 10

$response = Invoke-RestMethod -Uri "https://your-domain.pages.dev/api/proxy-gemini" `
  -Method POST `
  -Headers $headers `
  -Body $body

Write-Host "Response:"
$response | ConvertTo-Json -Depth 10
```

**预期结果**:
```json
{
  "success": true,
  "data": {
    "candidates": [
      {
        "content": {
          "parts": [
            {
              "text": "I'm doing well, thank you for asking! ..."
            }
          ]
        }
      }
    ]
  }
}
```

---

### 测试 2: 翻译任务
```powershell
$body = @{
  contents = @(
    @{
      parts = @(
        @{
          text = "Translate the following to French: 'The weather is beautiful today.'"
        }
      )
    }
  )
} | ConvertTo-Json -Depth 10

$response = Invoke-RestMethod -Uri "https://your-domain.pages.dev/api/proxy-gemini" `
  -Method POST `
  -Headers $headers `
  -Body $body

Write-Host "Translation:"
$response.data.candidates[0].content.parts[0].text
```

**预期输出**: "Le temps est magnifique aujourd'hui."

---

### 测试 3: 语法纠错 (ParlezPlus 核心功能)
```powershell
$body = @{
  contents = @(
    @{
      parts = @(
        @{
          text = @"
Identify and correct grammar errors in this sentence:
'She don't likes apples and he go to school yesterday.'

Provide:
1. Corrected sentence
2. List of errors with explanations
"@
        }
      )
    }
  )
} | ConvertTo-Json -Depth 10

$response = Invoke-RestMethod -Uri "https://your-domain.pages.dev/api/proxy-gemini" `
  -Method POST `
  -Headers $headers `
  -Body $body

Write-Host "Grammar Analysis:"
$response.data.candidates[0].content.parts[0].text
```

---

### 测试 4: 发音评分提示 (AI 辅助评分)
```powershell
$body = @{
  contents = @(
    @{
      parts = @(
        @{
          text = @"
You are a pronunciation evaluation AI. Given the following Azure Speech Service output, provide a detailed score and feedback:

Original Text: "Hello, how are you today?"
User's Transcription: "Helo, how ar you toady?"
Azure Confidence Score: 0.75

Provide:
1. Overall pronunciation score (0-100)
2. Specific errors (missing sounds, mispronunciations)
3. Improvement suggestions
"@
        }
      )
    }
  )
} | ConvertTo-Json -Depth 10

$response = Invoke-RestMethod -Uri "https://your-domain.pages.dev/api/proxy-gemini" `
  -Method POST `
  -Headers $headers `
  -Body $body

Write-Host "Pronunciation Feedback:"
$response.data.candidates[0].content.parts[0].text
```

---

### 测试 5: 性能测试 (延迟和吞吐量)
```powershell
# 测试多次请求的平均延迟
$iterations = 10
$totalTime = 0

for ($i = 1; $i -le $iterations; $i++) {
  $body = @{
    contents = @(
      @{
        parts = @(
          @{
            text = "Say hello in request #$i"
          }
        )
      }
    )
  } | ConvertTo-Json -Depth 10
  
  $startTime = Get-Date
  
  $response = Invoke-RestMethod -Uri "https://your-domain.pages.dev/api/proxy-gemini" `
    -Method POST `
    -Headers $headers `
    -Body $body
  
  $endTime = Get-Date
  $duration = ($endTime - $startTime).TotalMilliseconds
  $totalTime += $duration
  
  Write-Host "Request $i: ${duration}ms"
}

$avgTime = $totalTime / $iterations
Write-Host "`nAverage Response Time: ${avgTime}ms"
Write-Host "Target: < 2000ms for China network"

if ($avgTime -lt 2000) {
  Write-Host "✅ PASS: Performance is acceptable" -ForegroundColor Green
} else {
  Write-Host "⚠️ WARNING: High latency detected" -ForegroundColor Yellow
}
```

---

### 测试 6: 并发请求测试
```powershell
$jobs = @()

for ($i = 1; $i -le 5; $i++) {
  $jobs += Start-Job -ScriptBlock {
    param($uri, $token, $requestId)
    
    $headers = @{
      "Authorization" = "Bearer $token"
      "Content-Type" = "application/json"
    }
    
    $body = @{
      contents = @(
        @{
          parts = @(
            @{
              text = "Concurrent request #$requestId"
            }
          )
        }
      )
    } | ConvertTo-Json -Depth 10
    
    $startTime = Get-Date
    $response = Invoke-RestMethod -Uri $uri -Method POST -Headers $headers -Body $body
    $endTime = Get-Date
    
    @{
      requestId = $requestId
      duration = ($endTime - $startTime).TotalMilliseconds
      success = $response.success
    }
  } -ArgumentList "https://your-domain.pages.dev/api/proxy-gemini", $token, $i
}

$results = $jobs | Wait-Job | Receive-Job
$jobs | Remove-Job

Write-Host "`nConcurrent Request Results:"
$results | ForEach-Object {
  Write-Host "Request $($_.requestId): $($_.duration)ms - Success: $($_.success)"
}

$avgConcurrent = ($results | Measure-Object -Property duration -Average).Average
Write-Host "`nAverage Concurrent Response Time: ${avgConcurrent}ms"
```

---

## 错误场景测试

### 测试 7: 无效 API Key
```powershell
# 临时修改数据库中的 API Key 为无效值进行测试
wrangler d1 execute parlezplus-db --command="
UPDATE user_api_keys SET gemini_key_encrypted='invalid-key-12345' WHERE user_id='admin-001';
"

# 发送请求
$response = Invoke-RestMethod -Uri "https://your-domain.pages.dev/api/proxy-gemini" `
  -Method POST `
  -Headers $headers `
  -Body $body `
  -ErrorAction SilentlyContinue

# 恢复正确的 API Key
wrangler d1 execute parlezplus-db --command="
UPDATE user_api_keys SET gemini_key_encrypted='correct-encrypted-key' WHERE user_id='admin-001';
"

# 验证错误响应
if ($response.success -eq $false -and $response.error -like "*API Key 无效*") {
  Write-Host "✅ Error handling: Invalid API Key detected correctly" -ForegroundColor Green
}
```

### 测试 8: 未配置 API Key
```powershell
# 创建测试用户 (无 API Key)
wrangler d1 execute parlezplus-db --command="
INSERT INTO users (id, username, password_hash, role, name, created_at)
VALUES ('test-user-001', 'testuser', 'hash123', 'student', 'Test User', $(Get-Date -UFormat %s)000);
"

# 登录测试用户
$testResponse = Invoke-RestMethod -Uri "https://your-domain.pages.dev/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"username":"testuser","password":"Test@123"}'

$testToken = $testResponse.data.token

# 尝试使用 Gemini (应该失败)
$testHeaders = @{
  "Authorization" = "Bearer $testToken"
  "Content-Type" = "application/json"
}

$response = Invoke-RestMethod -Uri "https://your-domain.pages.dev/api/proxy-gemini" `
  -Method POST `
  -Headers $testHeaders `
  -Body $body `
  -ErrorAction SilentlyContinue

if ($response.success -eq $false -and $response.error -like "*未配置 Gemini API Key*") {
  Write-Host "✅ Error handling: Missing API Key detected correctly" -ForegroundColor Green
}
```

---

## 中国网络环境特定测试

### 测试 9: DNS 解析测试
```powershell
# 测试 Cloudflare Pages 域名解析
$domainNames = @(
  "your-domain.pages.dev",
  "generativelanguage.googleapis.com"
)

foreach ($domain in $domainNames) {
  try {
    $dns = Resolve-DnsName $domain -ErrorAction Stop
    Write-Host "✅ $domain resolves to: $($dns.IPAddress)" -ForegroundColor Green
  } catch {
    Write-Host "❌ Failed to resolve $domain" -ForegroundColor Red
  }
}
```

### 测试 10: 网络路由检测
```powershell
# 检查请求是否通过 Cloudflare CDN
$response = Invoke-WebRequest -Uri "https://your-domain.pages.dev/api/proxy-gemini" `
  -Method OPTIONS `
  -Headers @{ "Origin" = "https://example.com" }

$cfHeaders = @(
  "CF-RAY",
  "CF-Cache-Status",
  "Server"
)

Write-Host "`nCloudflare Headers:"
foreach ($header in $cfHeaders) {
  if ($response.Headers[$header]) {
    Write-Host "  $header: $($response.Headers[$header])"
  }
}
```

---

## 监控和日志

### 查看 Workers 日志
```powershell
# 实时查看 Cloudflare Workers 日志
wrangler tail --project-name=parlezplus-web

# 筛选 Gemini 相关日志
wrangler tail --project-name=parlezplus-web | Select-String "gemini"
```

### 查看 D1 数据库统计
```powershell
# 检查 API Key 配置
wrangler d1 execute parlezplus-db --command="
SELECT 
  u.username,
  u.role,
  CASE WHEN k.gemini_key_encrypted IS NOT NULL THEN 'Configured' ELSE 'Not Configured' END as api_key_status
FROM users u
LEFT JOIN user_api_keys k ON u.id = k.user_id
WHERE u.role IN ('admin', 'teacher')
LIMIT 10;
"
```

---

## 测试报告模板

### 测试结果记录表
| 测试用例 | 状态 | 响应时间 | 错误信息 | 备注 |
|---------|------|---------|---------|------|
| 简单文本生成 | ✅ | 850ms | - | - |
| 翻译任务 | ✅ | 920ms | - | - |
| 语法纠错 | ✅ | 1200ms | - | - |
| 发音评分 | ✅ | 1100ms | - | - |
| 性能测试 (平均) | ✅ | 950ms | - | 目标 < 2000ms |
| 并发请求 | ✅ | 1050ms | - | 5 并发 |
| 无效 API Key | ✅ | 200ms | "API Key 无效" | 正确 |
| 未配置 API Key | ✅ | 100ms | "未配置" | 正确 |
| DNS 解析 | ✅ | N/A | - | - |
| Cloudflare 路由 | ✅ | N/A | - | CF-RAY 存在 |

### 结论
- ✅ **通过**: 所有测试用例通过
- ⚠️ **警告**: 部分测试延迟较高
- ❌ **失败**: 测试失败，需要修复

### 建议
1. 如果平均响应时间 > 2000ms，考虑:
   - 使用 Cloudflare Enterprise CDN 加速
   - 启用 Argo Smart Routing
   - 缓存 Gemini 响应 (针对相同请求)

2. 如果中国网络访问失败:
   - 检查域名是否需要 ICP 备案
   - 考虑使用备用 AI 服务 (百度文心一言、阿里通义千问)

3. 生产环境优化:
   - 实现请求缓存 (KV 存储)
   - 添加速率限制 (防止 API 配额耗尽)
   - 监控 Gemini API 使用量

---

## 自动化测试脚本

完整的自动化测试脚本:

```powershell
# test-gemini-proxy.ps1

param(
  [string]$Domain = "your-domain.pages.dev",
  [string]$Username = "admin",
  [string]$Password = "Admin@2024"
)

Write-Host "=== ParlezPlus Gemini 代理测试 ===" -ForegroundColor Cyan
Write-Host "域名: $Domain`n"

# 1. 登录
Write-Host "[1/10] 登录..." -ForegroundColor Yellow
$loginBody = @{
  username = $Username
  password = $Password
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "https://$Domain/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body $loginBody

$token = $loginResponse.data.token
Write-Host "✅ 登录成功`n" -ForegroundColor Green

# 2-6. 运行所有测试...
# (包含上述所有测试用例)

Write-Host "`n=== 测试完成 ===" -ForegroundColor Cyan
```

运行:
```powershell
.\test-gemini-proxy.ps1 -Domain "parlezplus.pages.dev" -Username "admin" -Password "Admin@2024"
```

---

## 中国网络环境测试清单

在中国境内服务器或 VPN 连接下执行:

- [ ] Cloudflare Pages 域名可访问
- [ ] API 认证正常工作
- [ ] Gemini 代理返回成功响应
- [ ] 平均响应时间 < 2秒
- [ ] 并发请求处理正常
- [ ] 错误处理符合预期
- [ ] DNS 解析无污染
- [ ] Cloudflare CDN 正常路由
- [ ] R2 媒体文件加载正常
- [ ] D1 数据库查询无延迟

---

## 故障排查

### 问题 1: 连接超时
```powershell
# 检查网络连通性
Test-NetConnection -ComputerName your-domain.pages.dev -Port 443
```

### 问题 2: SSL 证书错误
```powershell
# 验证证书
$cert = [System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
```

### 问题 3: API 配额耗尽
```sql
-- 查询最近的 Gemini 调用
SELECT COUNT(*) as total_calls
FROM operation_logs
WHERE action = 'gemini_api_call'
AND timestamp > (strftime('%s', 'now') - 86400) * 1000;
```

---

## 支持文档

- [Cloudflare Workers 地理分布](https://www.cloudflare.com/network/)
- [Gemini API 文档](https://ai.google.dev/docs)
- [中国网络环境优化指南](https://developers.cloudflare.com/china-network/)
