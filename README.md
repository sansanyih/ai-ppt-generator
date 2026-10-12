# AI 对话 / PPT 生成工具

一个基于大模型的 Web 应用前端：**用自然语言生成可下载的 PPT**，并支持文档解析、图表生成的多轮 AI 对话。

> 在线体验：<待部署后补充>　·　技术栈：Vue3 + Vite + Element Plus + ECharts + pptxgenjs + OpenAI SDK(DeepSeek)

---

## 功能

| 模块 | 说明 |
| --- | --- |
| **AI 对话** | 多会话管理（新建 / 重命名 / 删除 / 切换）、流式输出、Markdown 渲染、代码块高亮 |
| **一键生成 PPT** | 输入主题 → 流式生成 `{标题, 章节, 要点}` 大纲 → 选择模板 → 用 pptxgenjs 在浏览器端逐页生成并下载 `.pptx`（封面 / 内容页 / 尾页） |
| **文档解析** | 上传 Word(.docx) / PDF / Excel，用 mammoth、pdfjs-dist、xlsx 解析成文本作为对话与生成上下文 |
| **图表生成** | 自然语言 → ECharts 柱状 / 折线 / 饼图，支持导出图片与 PDF |
| **导出** | jsPDF + html2canvas 导出 PDF / 图片；jszip 打包下载 |
| **其他** | 移动端适配（mobile-detect）、余额查询、模板选择器 |

## 技术栈

```
前端框架   Vue 3 + Vue Router + Vite
UI         Element Plus + @element-plus/icons-vue
大模型     openai（OpenAI 兼容 SDK，对接 DeepSeek deepseek-chat）
PPT        pptxgenjs
图表       ECharts 5
文档解析   mammoth（docx）/ pdfjs-dist（pdf）/ xlsx、read-excel-file（excel）/ docx2html
导出       jsPDF + html2canvas + jszip
渲染       vue3-markdown-it
```

---

## 快速开始

要求 Node 18+（建议 20/22）。

```bash
# 1. 安装依赖
npm install

# 2. 配置密钥（只在服务端使用，不会进前端包）
cp .env.example .env.local
# 然后编辑 .env.local，填入你自己的 DeepSeek Key：
#   DEEPSEEK_API_KEY=sk-xxxxxxxx

# 3. 启动
npm run dev
```

打开 `http://localhost:5173`。登录页是**纯前端演示逻辑**，用户名 `wangxiaoming`、密码 `123456`。

### 本地如何做到「密钥不进浏览器」

`vite.config.js` 里配置了开发代理：浏览器只请求 `/api/**`，由 Vite 的 Node 进程补上 `Authorization` 头再转发到 `https://api.deepseek.com`。所以前端代码和构建产物里**搜不到任何 `sk-` 开头的字符串**。

---

## 架构：密钥为什么不放在前端

```
浏览器  ──POST /api/chat/completions──▶  ┌─ 本地：vite.config.js server.proxy（Node 进程注入 Key）
（不含 Key）                              └─ 线上：api/[...path].js（Vercel Edge Function 注入 Key）
                                                    │
                                                    ▼
                                          https://api.deepseek.com
```

- `api/[...path].js`：Vercel Serverless Function，把 `/api/**` 透传到 DeepSeek，并**原样流式回传** SSE，服务端读环境变量 `DEEPSEEK_API_KEY`；
- 前端 `baseURL` 固定为 `/api`，SDK 的 `apiKey` 只是占位值；
- 早期版本曾把 Key 用 `VITE_` 前缀打进前端包（`dangerouslyAllowBrowser` + `import.meta.env`），已重构为服务端代理。

## 部署到 Vercel

1. 把本目录推到 GitHub 仓库；
2. Vercel → New Project → 导入该仓库（框架自动识别为 Vite，构建命令 `npm run build`，产物目录 `dist`）；
3. 在 **Settings → Environment Variables** 添加 `DEEPSEEK_API_KEY = sk-xxxx`；
4. Deploy。`vercel.json` 已配置 SPA 回退，刷新子路由不会 404。

> 注意：**不要**在 Vercel 里配置任何带 `VITE_` 前缀的密钥变量——那类变量会被打进前端产物。

---

## 目录结构

```
.
├── api/
│   └── [...path].js              # Vercel Edge Function：DeepSeek 流式代理（服务端持有密钥）
├── public/
│   ├── config.js                 # 运行时配置（业务接口地址 / 大模型代理地址）
│   └── server.js                 # 把 window.config 导出成模块
├── src/
│   ├── api/
│   │   ├── request.js            # Axios 实例与拦截器
│   │   └── modules/deepseek.js   # 余额查询等大模型相关接口
│   ├── views/deepseek/
│   │   ├── index.vue             # 对话主页面（流式渲染 + 会话管理 + PPT 生成入口）
│   │   └── components/
│   │       ├── messageComp.vue          # 消息气泡（Markdown 渲染）
│   │       ├── PPTGenerator.vue         # pptxgenjs 生成 PPT
│   │       ├── PPTTemplateSelector.vue  # 模板选择
│   │       ├── ChartGenerator.vue       # ECharts 图表生成
│   │       ├── ReadingAnalyzer.vue      # Word / PDF / Excel 文档解析
│   │       └── LoginComp.vue            # 演示登录
│   └── router/
├── vercel.json                   # SPA 回退
└── .env.example                  # 环境变量模板（真实值放 .env.local，已被忽略）
```

---

## 说明与已知限制

- **登录是前端演示逻辑**（`LoginComp.vue` 里硬编码校验），没有真实鉴权，不能当生产权限系统用；
- `public/config.js` 里的 `baseUrl` 指向本地 Node 服务（`127.0.0.1:3000`），该服务未包含在本仓库，因此依赖它的少数业务接口在线上不可用；大模型相关功能不受影响；
- 工程骨架基于 MIT 许可的开源模板二次开发（原版权声明见 `LICENSE`），业务功能、界面与交互由本人实现与改造；
- 待办：会话历史持久化、导出进度条、错误重试与超时兜底。

## 性能优化：首屏体积

重依赖（ECharts、pdfjs-dist、xlsx、pptxgenjs、jsPDF、JSZip）原先都是**静态 import**，会被打进「进入首页就要下载」的那个 chunk：

| | 优化前 | 优化后 |
| --- | --- | --- |
| 首页路由 chunk | **4,126 KB** | **1,411 KB** |
| 首屏 JS 合计（入口 + 首页路由） | ≈ 5.1 MB | ≈ 2.4 MB（**↓ 53%**） |

做法：

- `ChartGenerator` 的 ECharts / jsPDF、`ReadingAnalyzer` 的 pdfjs-dist / mammoth / xlsx / JSZip、`PPTGenerator` 与对话页的 pptxgenjs，全部改成**函数内 `await import()` 按需加载**，只有用户真正用到对应功能时才下载；
- 顺带删掉 `ChartGenerator` 里**只 import、从未使用**的 `html2canvas`；
- ECharts 的 `use([...])` 组件注册移进懒加载函数，保证注册先于 `init()` 执行。

效果：首次打开只下载「入口 + 首页路由」两个 chunk，其余按需——文档解析 379 KB、表格解析 429 KB、PPT 生成 275 KB、PDF 导出 358 KB、图表 ~430 KB。
