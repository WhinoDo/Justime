# 定时任务说明文档

## 📋 任务列表

| 任务 | 频率 | 时间 | 脚本 | 说明 |
|------|------|------|------|------|
| 健康检查 | 每 5 分钟 | `*/5 * * * *` | `health_check.py` | 检查后端、数据库、磁盘状态 |
| 数据库备份 | 每天 | `0 2 * * *` | `backup_db.py` | 备份 MongoDB 数据 |
| 临时文件清理 | 每天 | `0 3 * * *` | `cleanup_temp.py` | 清理缓存、临时文件 |
| 日志压缩 | 每周日 | `0 4 * * 0` | 系统命令 | 压缩 30 天前的日志 |
| 代码优化 Agent | 每 30 分钟 | `*/30 * * * *` | `code_optimizer_agent.py` | 扫描并优化代码 |
| 代码深度优化 | 每周一 | `0 5 * * 1` | `code_optimizer_agent.py --deep` | 深度代码扫描 |
| Multica Issue 监控 | 每 10 分钟 | `*/10 * * * *` | `multica_issue_monitor.sh` | 监控守护进程与 Issue 推进状态 |
| 磁盘监控 | 每小时 | `0 * * * *` | 系统命令 | 磁盘空间告警 |
| 内存监控 | 每小时 | `5 * * * *` | 系统命令 | 内存使用监控 |

## 🚀 安装方法

```bash
# 进入脚本目录
cd /Users/zhuyuxuan/Desktop/Code/justime/scripts/cron

# 添加执行权限
chmod +x install_crontab.sh

# 运行安装脚本
./install_crontab.sh
```

## 📁 目录结构

```
scripts/cron/
├── health_check.py          # 健康检查脚本
├── backup_db.py             # 数据库备份脚本
├── cleanup_temp.py          # 临时文件清理脚本
├── code_optimizer_agent.py  # 代码优化 Agent
├── multica_issue_monitor.sh # Multica Issue 监控脚本
├── crontab.example          # Crontab 配置示例
├── install_crontab.sh       # 安装脚本
└── README.md                # 本文件
```

## 📊 日志位置

所有日志存放在项目根目录的 `logs/` 文件夹：

```
logs/
├── health_check.log         # 健康检查日志
├── backup.log               # 备份日志
├── cleanup.log              # 清理日志
├── code_optimizer.log       # 代码优化日志
├── multica_monitor.log      # Multica 监控日志
├── disk_monitor.log         # 磁盘监控日志
└── memory_monitor.log       # 内存监控日志
```

## 🔧 手动执行

```bash
# 手动运行健康检查
python3 scripts/cron/health_check.py

# 手动备份数据库
python3 scripts/cron/backup_db.py

# 手动清理临时文件
python3 scripts/cron/cleanup_temp.py

# 手动运行代码优化 Agent
python3 scripts/cron/code_optimizer_agent.py

# 手动运行 Multica Issue 监控
bash scripts/cron/multica_issue_monitor.sh
```

## 🤖 代码优化 Agent

代码优化 Agent 会执行以下任务：

### 扫描类型
- **性能优化**: N+1 查询、不必要的重渲染、内存泄漏
- **安全问题**: SQL 注入、XSS 漏洞、硬编码密钥
- **代码质量**: 重复代码、过长函数、深层嵌套
- **最佳实践**: TypeScript 类型、React Hooks 规范、Python 风格

### 工作流程
1. 扫描前端代码 (`justime_agent/src/`)
2. 扫描后端代码 (`justime_backend/app/`)
3. 识别问题并评估严重程度
4. 自动修复发现的问题
5. 生成优化报告到 `docs/optimization_reports/`

### 报告位置
```
docs/optimization_reports/
├── optimization_report_20260423_040000.md
├── optimization_report_20260424_040000.md
└── ...
```

## 🔁 Multica Issue 监控

`multica_issue_monitor.sh` 每 10 分钟自动执行，确保 Multica Agent 持续推进 Issue：

### 检查项
1. **守护进程存活** — 检测 `multica daemon` 是否运行，若停止则自动重启
2. **Issue 状态扫描** — 通过 `multica issue list` 获取当前 Issue 列表
3. **停滞检测** — 对比前后两次检查的 Issue 状态哈希，若超过 30 分钟无变化则告警
4. **未分配 Issue 提醒** — 发现 queued/pending 状态的 Issue 时记录告警

### 前置条件
```bash
# 安装 Multica CLI
brew install multica-ai/tap/multica

# 完成初始配置
multica setup
```

## ⚙️ 修改任务

```bash
# 编辑 crontab
crontab -e

# 查看当前 crontab
crontab -l

# 移除所有定时任务
crontab -r
```

## 🔔 告警配置

健康检查脚本返回非零退出码时，可配合监控工具（如 Nagios、Zabbix）发送告警。

建议配置：
- 后端服务宕机 → 立即告警
- 数据库连接失败 → 立即告警
- 磁盘使用 > 80% → 警告
- 磁盘使用 > 90% → 严重告警

## 📝 注意事项

1. **备份保留**: 数据库备份默认保留 7 天
2. **日志轮转**: 30 天前的日志会自动压缩
3. **代码优化**: 自动修改代码，建议配合 Git 使用
4. **执行时间**: 建议在凌晨低峰期执行重任务

## 🐛 故障排查

```bash
# 查看 cron 服务状态
sudo systemctl status cron  # Linux
# 或
launchctl list | grep cron  # macOS

# 查看 cron 日志
grep CRON /var/log/syslog  # Linux
# 或
log show --predicate 'process == "cron"' --info  # macOS
```
