#!/usr/bin/env python3
"""
代码优化 Agent 启动脚本
定时启动子 agent 检索可优化的代码并自动修改
支持自动修复部分问题
"""

import os
import sys
import subprocess
import re
from pathlib import Path
from datetime import datetime

# 项目配置
PROJECT_DIR = Path(__file__).parent.parent.parent
LOG_DIR = PROJECT_DIR / "logs"
LOG_FILE = LOG_DIR / "code_optimizer.log"
REPORT_DIR = PROJECT_DIR / "docs" / "optimization_reports"

# 扫描配置
SCAN_CONFIG = {
    "frontend_dir": str(PROJECT_DIR / "jushi_agent" / "src"),
    "backend_dir": str(PROJECT_DIR / "jushi_backend" / "app"),
}


def log(message: str, level: str = "INFO"):
    """记录日志"""
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_line = f"[{timestamp}] [{level}] {message}\n"
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(log_line)
    print(log_line.strip())


def check_claude_cli() -> bool:
    """检查 Claude CLI 是否可用"""
    try:
        result = subprocess.run(
            ["claude", "--version"],
            capture_output=True,
            text=True,
            timeout=5
        )
        return result.returncode == 0
    except:
        return False


def run_static_analysis() -> dict:
    """运行静态代码分析"""
    issues = []

    # 1. 检查 Python 代码
    log("检查 Python 代码...")
    backend_dir = Path(SCAN_CONFIG["backend_dir"])

    for py_file in backend_dir.rglob("*.py"):
        if "__pycache__" in str(py_file):
            continue
        try:
            with open(py_file, "r", encoding="utf-8") as f:
                code = f.read()
            compile(code, str(py_file), "exec")

            lines = code.split("\n")
            for i, line in enumerate(lines, 1):
                if len(line) > 120:
                    issues.append({
                        "file": str(py_file.relative_to(PROJECT_DIR)),
                        "line": i,
                        "type": "style",
                        "message": f"行过长 ({len(line)} > 120)",
                        "content": line
                    })

                # 检查可能的硬编码密码
                if "password" in line.lower() and "=" in line and '"' in line:
                    if "your_" not in line.lower() and "example" not in line.lower():
                        issues.append({
                            "file": str(py_file.relative_to(PROJECT_DIR)),
                            "line": i,
                            "type": "security",
                            "message": "可能的硬编码密码",
                            "content": line
                        })
        except SyntaxError as e:
            issues.append({
                "file": str(py_file.relative_to(PROJECT_DIR)),
                "line": e.lineno or 0,
                "type": "error",
                "message": f"语法错误: {e.msg}"
            })

    # 2. 检查 TypeScript 代码
    log("检查 TypeScript 代码...")
    frontend_dir = Path(SCAN_CONFIG["frontend_dir"])

    for ts_file in frontend_dir.rglob("*.ts*"):
        if "node_modules" in str(ts_file) or ".next" in str(ts_file):
            continue
        try:
            with open(ts_file, "r", encoding="utf-8") as f:
                code = f.read()
            lines = code.split("\n")
            for i, line in enumerate(lines, 1):
                if len(line) > 120:
                    issues.append({
                        "file": str(ts_file.relative_to(PROJECT_DIR)),
                        "line": i,
                        "type": "style",
                        "message": f"行过长 ({len(line)} > 120)",
                        "content": line
                    })

                # 检查 console.log
                if "console.log" in line and "debug" not in line.lower():
                    issues.append({
                        "file": str(ts_file.relative_to(PROJECT_DIR)),
                        "line": i,
                        "type": "warning",
                        "message": "存在 console.log 调试代码",
                        "content": line
                    })

                # 检查 setInterval/setTimeout 没有清理
                if "setInterval" in line or "setTimeout" in line:
                    # 检查是否在 useEffect 中且返回了清理函数
                    issues.append({
                        "file": str(ts_file.relative_to(PROJECT_DIR)),
                        "line": i,
                        "type": "warning",
                        "message": "检查定时器是否有清理机制",
                        "content": line
                    })
        except Exception as e:
            pass

    return {"issues": issues, "total": len(issues)}


def fix_console_log(file_path: Path, line_num: int, content: str) -> bool:
    """修复 console.log - 添加环境判断"""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            code = f.read()
            lines = code.split("\n")

        if line_num - 1 >= len(lines):
            return False

        original_line = lines[line_num - 1]

        # 检查是否已经有环境判断（检查前面几行）
        for i in range(max(0, line_num - 5), line_num):
            if "process.env.NODE_ENV" in lines[i]:
                return False  # 已经有环境判断，跳过

        indent = len(original_line) - len(original_line.lstrip())
        indent_str = original_line[:indent]

        # 添加环境判断（保持正确的缩进）
        new_lines = [
            f'{indent_str}if (process.env.NODE_ENV === "development") {{',
            original_line,
            f'{indent_str}}}'
        ]

        lines[line_num - 1] = "\n".join(new_lines)

        with open(file_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

        return True
    except Exception as e:
        log(f"修复 console.log 失败: {e}", "ERROR")
        return False


def fix_long_line(file_path: Path, line_num: int, content: str, is_typescript: bool = False) -> bool:
    """修复过长行 - 尝试智能换行"""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        if line_num - 1 >= len(lines):
            return False

        original_line = lines[line_num - 1]
        indent = len(original_line) - len(original_line.lstrip())
        indent_str = original_line[:indent]

        # 根据语言选择换行策略
        if is_typescript:
            # TypeScript: 尝试在逗号、括号处换行
            split_chars = [",", "&&", "||", "+", "?", ":"]
        else:
            # Python: 尝试在逗号、括号处换行
            split_chars = [",", "and", "or", "+"]

        for split_char in split_chars:
            if split_char in content and len(content) > 80:
                parts = content.split(split_char)
                if len(parts) > 1:
                    # 重新组装，每行不超过 100 字符
                    new_lines = []
                    current_line = indent_str + parts[0].strip()
                    for part in parts[1:]:
                        test_line = current_line + split_char + " " + part.strip()
                        if len(test_line) <= 100:
                            current_line = test_line
                        else:
                            new_lines.append(current_line + split_char + "\n")
                            current_line = indent_str + "    " + part.strip()
                    new_lines.append(current_line + "\n")

                    if len(new_lines) > 1:
                        lines[line_num - 1] = "".join(new_lines)
                        with open(file_path, "w", encoding="utf-8") as f:
                            f.writelines(lines)
                        return True

        return False
    except Exception as e:
        log(f"修复过长行失败: {e}", "ERROR")
        return False


def fix_hardcoded_password(file_path: Path, line_num: int, content: str) -> bool:
    """修复硬编码密码 - 添加注释警告"""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        if line_num - 1 >= len(lines):
            return False

        original_line = lines[line_num - 1]
        indent = len(original_line) - len(original_line.lstrip())
        indent_str = original_line[:indent]

        # 添加警告注释
        warning_comment = f'{indent_str}# TODO: 安全警告 - 请确认这不是硬编码密码\n'
        lines.insert(line_num - 1, warning_comment)

        with open(file_path, "w", encoding="utf-8") as f:
            f.writelines(lines)
        return True
    except Exception as e:
        log(f"修复硬编码密码失败: {e}", "ERROR")
        return False


def run_auto_fix(issues: list) -> dict:
    """自动修复问题"""
    fixed = []
    failed = []
    fixed_files_lines = set()  # 记录已修复的文件和行号，避免重复修复

    log("开始自动修复...")

    for issue in issues:
        if issue["type"] == "error":
            continue  # 语法错误不自动修复

        file_path = PROJECT_DIR / issue["file"]
        if not file_path.exists():
            continue

        # 检查是否已经修复过这一行
        fix_key = f"{issue['file']}:{issue['line']}"
        if fix_key in fixed_files_lines:
            continue

        is_typescript = issue["file"].endswith((".ts", ".tsx"))

        try:
            success = False

            if issue["type"] == "warning" and "console.log" in issue.get("content", ""):
                # 修复 console.log
                success = fix_console_log(file_path, issue["line"], issue.get("content", ""))
                if success:
                    fixed.append({**issue, "fix": "添加环境判断"})
                    fixed_files_lines.add(fix_key)

            elif issue["type"] == "style" and "行过长" in issue["message"]:
                # 修复过长行
                success = fix_long_line(file_path, issue["line"], issue.get("content", ""), is_typescript)
                if success:
                    fixed.append({**issue, "fix": "自动换行"})
                    fixed_files_lines.add(fix_key)

            elif issue["type"] == "security" and "硬编码密码" in issue["message"]:
                # 修复硬编码密码
                success = fix_hardcoded_password(file_path, issue["line"], issue.get("content", ""))
                if success:
                    fixed.append({**issue, "fix": "添加安全警告注释"})
                    fixed_files_lines.add(fix_key)

            if not success and issue["type"] in ("warning", "style"):
                failed.append(issue)

        except Exception as e:
            failed.append(issue)

    log(f"修复完成: {len(fixed)} 个成功, {len(failed)} 个失败")
    return {"fixed": fixed, "failed": failed}


def run_claude_agent() -> dict:
    """使用 Claude CLI 运行代码优化 Agent"""
    prompt = f"""
你是一个代码优化专家。请快速扫描以下项目并修复发现的问题：

- 前端目录: {SCAN_CONFIG['frontend_dir']}
- 后端目录: {SCAN_CONFIG['backend_dir']}

请检查并修复：
1. 安全问题（硬编码密钥、XSS风险）
2. console.log 调试代码（添加环境判断）
3. 性能问题（定时器清理）

修复规则：
- 只修改项目目录下的文件
- 保留原有代码逻辑
- 添加必要的注释说明修复原因

完成后输出修复摘要。
"""

    try:
        result = subprocess.run(
            ["claude", "-p", prompt],
            capture_output=True,
            text=True,
            timeout=300,
            cwd=str(PROJECT_DIR)
        )

        if result.returncode == 0:
            return {"success": True, "output": result.stdout}
        else:
            return {"success": False, "error": result.stderr}
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "执行超时"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def generate_report(issues: list, fixed: list, claude_output: str = None) -> str:
    """生成优化报告"""
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_file = REPORT_DIR / f"optimization_{timestamp}.md"

    with open(report_file, "w", encoding="utf-8") as f:
        f.write("# 代码优化报告\n\n")
        f.write(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")

        # 统计
        error_count = len([i for i in issues if i["type"] == "error"])
        security_count = len([i for i in issues if i["type"] == "security"])
        warning_count = len([i for i in issues if i["type"] == "warning"])
        style_count = len([i for i in issues if i["type"] == "style"])

        f.write("## 统计摘要\n\n")
        f.write(f"| 类型 | 数量 | 已修复 |\n")
        f.write(f"|------|------|--------|\n")
        f.write(f"| 🔴 错误 | {error_count} | 0 |\n")
        f.write(f"| 🔒 安全 | {security_count} | {len([i for i in fixed if i['type']=='security'])} |\n")
        f.write(f"| ⚠️ 警告 | {warning_count} | {len([i for i in fixed if i['type']=='warning'])} |\n")
        f.write(f"| 💅 样式 | {style_count} | {len([i for i in fixed if i['type']=='style'])} |\n")
        f.write(f"| **总计** | {len(issues)} | **{len(fixed)}** |\n\n")

        # 已修复的问题
        if fixed:
            f.write("## ✅ 已修复的问题\n\n")
            for item in fixed[:30]:
                type_emoji = {"error": "🔴", "security": "🔒", "warning": "⚠️", "style": "💅"}.get(item["type"], "❓")
                f.write(f"- {type_emoji} **{item['file']}**:{item['line']}\n")
                f.write(f"  - {item['message']}\n")
                f.write(f"  - 修复: {item.get('fix', 'N/A')}\n\n")
            if len(fixed) > 30:
                f.write(f"\n*...还有 {len(fixed) - 30} 个已修复问题*\n\n")

        # 未修复的问题
        f.write("## ⚠️ 待处理的问题\n\n")
        unfixed = [i for i in issues if i not in fixed][:30]
        for issue in unfixed:
            type_emoji = {"error": "🔴", "security": "🔒", "warning": "⚠️", "style": "💅"}.get(issue["type"], "❓")
            f.write(f"- {type_emoji} **{issue['file']}**:{issue['line']}\n")
            f.write(f"  - {issue['message']}\n\n")

        if len(issues) - len(fixed) > 30:
            f.write(f"\n*...还有 {len(issues) - len(fixed) - 30} 个待处理问题*\n\n")

        # Claude 输出
        if claude_output:
            f.write("## Claude Agent 分析\n\n")
            f.write("```\n")
            f.write(claude_output[:3000])
            f.write("\n```\n")

    return str(report_file)


def main():
    """主函数"""
    log("=" * 50)
    log("代码优化定时任务启动")
    log("=" * 50)

    # 运行静态分析
    log("运行静态代码分析...")
    analysis_result = run_static_analysis()
    issues = analysis_result["issues"]
    log(f"发现 {len(issues)} 个问题")

    # 自动修复
    fix_result = run_auto_fix(issues)
    fixed = fix_result["fixed"]
    log(f"自动修复了 {len(fixed)} 个问题")

    # 尝试使用 Claude CLI 进行深度修复
    claude_output = None
    if check_claude_cli():
        log("检测到 Claude CLI，启动 Agent 深度修复...")
        claude_result = run_claude_agent()
        if claude_result["success"]:
            claude_output = claude_result["output"]
            log("✅ Claude Agent 深度修复完成")
        else:
            log(f"Claude Agent 执行失败: {claude_result.get('error')}", "WARNING")
    else:
        log("Claude CLI 不可用，跳过 Agent 修复", "WARNING")

    # 生成报告
    report_file = generate_report(issues, fixed, claude_output)
    log(f"📄 报告已保存: {report_file}")

    log("=" * 50)
    log(f"✅ 代码优化任务完成 (修复 {len(fixed)}/{len(issues)})")
    log("=" * 50)

    return 0


if __name__ == "__main__":
    sys.exit(main())
