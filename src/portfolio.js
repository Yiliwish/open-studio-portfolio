const printFigureMedia = [
  { type: 'image', src: '/works/print/figures.webp', label: '宙斯、赫拉与雅典娜造型', alt: '三位希腊神祇的低多边形棋子设计' },
  { type: 'image', src: '/works/print/print-preview.webp', label: '打印尺寸预览', alt: '三枚约 40 毫米高的棋子打印预览' },
  { type: 'model', src: '/works/print/zeus.stl', label: '旋转查看宙斯模型', alt: '宙斯棋子 STL 三维模型' },
];

export const works = [
  {
    id: 'printer',
    name: '3D 打印',
    title: '希腊神话棋子与棋盘',
    category: 'AI 建模 · 3D 打印',
    description: '从神祇造型探索出发，把 AI 建模结果整理成有明确尺寸、结构和打印用途的实体模型。',
    parts: [
      {
        label: '神话棋子',
        title: '三位神祇，统一成可打印棋子',
        intro: '以宙斯、赫拉和雅典娜为主题迭代造型，再统一底座比例与高度，形成一组约 40 毫米高的桌面棋子。',
        steps: [
          { title: '造型探索', text: '围绕神祇特征尝试抽象、低多边形与平衡风格。' },
          { title: '模型整理', text: '统一三枚棋子的高度和底座比例，检查模型网格。' },
          { title: '打印交付', text: '整理独立 STL、组合 3MF 和打印预览，便于继续制作。' },
        ],
        tags: ['宙斯 / 赫拉 / 雅典娜', '约 40 mm', 'STL · 3MF'],
        note: '目前目录提供数字模型与打印预览；若补充实物照片，可再加入成品效果。',
        media: printFigureMedia,
        actions: [
          { label: '下载棋子打印文件包', href: '/works/print/figure-pack.zip', download: true },
          { label: '下载三神组合 3MF', href: '/works/print/figures.3mf', download: true },
        ],
      },
      {
        label: '蕾丝棋盘',
        title: '把棋盘做成可折叠的蕾丝观赏件',
        intro: '棋盘采用连续镂空纹样与中心折线，约 228 毫米见方。它是一件与薄纱结合的观赏模型，不承载棋子。',
        steps: [
          { title: '结构设计', text: '围绕 8 × 8 棋格规划连续纹样和边缘留量。' },
          { title: '打印约束', text: '按 0.4 毫米喷嘴与约 0.8–1.0 毫米线宽整理细节。' },
          { title: '样片验证', text: '先打印 40 × 40 毫米小样，再确认薄壁与折线表现。' },
        ],
        tags: ['228 × 228 mm', '连续镂空', '观赏用途'],
        note: '结构说明建议与模型一起阅读；该棋盘不适合承载棋子或频繁折叠。',
        media: [
          { type: 'image', src: '/works/print/board-structure.webp', label: '棋盘结构示意', alt: '蕾丝棋盘纹样、折叠方式和打印约束示意图' },
          { type: 'image', src: '/works/print/board-preview.webp', label: '棋盘打印预览', alt: '希腊神话蕾丝棋盘打印模型预览' },
        ],
        actions: [
          { label: '下载棋盘 3MF', href: '/works/print/lace-board.3mf', download: true },
        ],
      },
    ],
  },
  {
    id: 'game-board',
    name: '游戏 Demo',
    title: 'Sanctuary 神殿探索',
    category: 'AI 建模 · 游戏场景',
    description: '把 AI 建模资产放进实时游览场景，通过可行走空间、神殿构件与路线设计验证模型在游戏中的表现。',
    parts: [
      {
        label: 'Sanctuary',
        title: '在神殿中探索空间与路线',
        intro: '第三人称神殿探索原型。场景截图和实机录像展示空间尺度、路径引导与游览过程。',
        steps: [
          { title: '场景资产', text: '用建筑构件、雕像和道具建立统一的神殿视觉。' },
          { title: '空间组织', text: '通过中轴、台阶和地面图案引导玩家前往祭坛。' },
          { title: '游戏验证', text: '在运行场景中观察模型比例、可读性和行走路线。' },
        ],
        tags: ['第三人称探索', '神殿场景', 'Windows Demo'],
        note: '可在详情页旋转、缩放神殿场景模型；Windows Demo 与实机录像用于查看游戏中的实际效果。',
        media: [
          { type: 'model', src: '/models/sanctuary-scene.glb', poster: '/works/game/sanctuary-temple.webp', label: '旋转查看神殿场景', alt: 'Sanctuary 神殿场景三维模型，可拖动旋转并缩放查看' },
          { type: 'image', src: '/works/game/sanctuary-ritual.webp', label: '神殿路线与交互', alt: 'Sanctuary 游戏中的神殿地面路线和玩家角色' },
          { type: 'image', src: '/works/game/sanctuary-temple.webp', label: '神像祭坛场景', alt: 'Sanctuary 游戏中的神像祭坛与室内建筑' },
          { type: 'video', src: '/works/game/sanctuary-walkthrough.mp4', poster: '/works/game/sanctuary-ritual.webp', label: '实机游览录像', alt: 'Sanctuary 游戏场景演示录像' },
        ],
        actions: [
          { label: '下载 Windows Demo', href: 'https://github.com/Yiliwish/sanctuary-third-person-walkthrough/releases/download/desktop-v1.0.0/Sanctuary-Windows-Setup-1.0.0.exe', external: true },
        ],
      },
    ],
  },
  {
    id: 'computer',
    name: '个人简历',
    title: 'AI 建模与产品设计简历',
    category: '关于我 · 简历',
    description: '个人经历、项目职责与技能概览。简历以 PDF 原件展示，方便在场景中直接阅读或下载。',
    parts: [
      {
        label: '简历',
        title: '个人简历',
        intro: '聚焦 AI 建模工作流、AI 视频工具与内容生产平台的产品设计实践。',
        steps: [
          { title: '产品设计', text: '梳理 AI 创作流程，将生成、校验和修改组织成可执行步骤。' },
          { title: 'AI 建模', text: '结合 Codex、Blender 与专业建模工具探索三维工作流。' },
          { title: '项目落地', text: '覆盖产品原型、前端实现、模型与 Prompt 方案。' },
        ],
        tags: ['AI 产品', '3D 工作流', '产品设计'],
        note: 'PDF 中包含简历原有的联系方式。',
        media: [
          { type: 'image', src: '/works/resume/resume-preview.webp', label: '简历首页预览', alt: '个人简历首页，包含工作经历、教育背景与联系方式' },
        ],
        actions: [
          { label: '下载简历 PDF', href: '/works/resume/resume.pdf', download: true },
        ],
      },
    ],
  },
  {
    id: 'video',
    name: '视频 / 漫剧平台',
    title: 'AI 视频创作与漫剧平台',
    category: 'AI 建模 · 视频内容',
    description: '一侧展示 AI 角色与镜头进入动态影像后的结果，另一侧展示把漫剧制作流程产品化的工作。',
    parts: [
      {
        label: 'AI 视频',
        title: '让角色造型进入动态影像',
        intro: '从角色外形与多视角设定出发，查看最终舞蹈视频和运镜版本，感受造型在连续镜头中的呈现。',
        steps: [
          { title: '角色设定', text: '先整理角色外形与多角度参考，作为后续画面基础。' },
          { title: '动态生成', text: '将角色放入动作和镜头变化中，检查连续画面的稳定性。' },
          { title: '成片呈现', text: '通过完整视频和运镜片段对比最终画面效果。' },
        ],
        tags: ['AI 角色', '动态影像', '镜头表现'],
        note: '舞台场景模型可旋转、缩放查看；视频在点击播放后才开始加载。',
        media: [
          { type: 'image', src: '/works/video/dancer-turnaround.webp', label: '角色多视角设定', alt: '国风舞者角色的正面、侧面和背面造型' },
          { type: 'model', src: '/models/dance-environment.glb', poster: '/works/video/dancer-turnaround.webp', label: '旋转查看大佛舞台场景', alt: '乐山大佛舞蹈场景三维模型，可拖动旋转并缩放查看' },
          { type: 'video', src: '/works/video/dance-film.mp4', poster: '/works/video/dance-film-poster.webp', label: '国风独舞成片', alt: '大佛前国风独舞 AI 视频' },
          { type: 'video', src: '/works/video/dance-camera.mp4', poster: '/works/video/dance-camera-poster.webp', label: '运镜片段', alt: '乐山大佛场景中的红衣舞者运镜视频' },
        ],
        actions: [],
      },
      {
        label: '漫剧平台',
        title: '把漫剧制作串成一条 AI 工作流',
        intro: '“漫造”面向短视频与漫剧创作者，将原文、分镜、角色与场景设定、画面生成和成片整理放进连续流程。',
        steps: [
          { title: '故事原文', text: '导入文本，生成结构化的场次、镜头和动作。' },
          { title: '角色与场景', text: '沉淀可复用设定，减少多镜头生成时的形象和空间漂移。' },
          { title: '分镜到成片', text: '组织画面、字幕、配音和片段，便于评审与后续编辑。' },
        ],
        tags: ['AI 产品设计', 'React · TypeScript', '工作流原型'],
        note: '项目记录：15 秒视频制作从约 1 小时缩短至约 30 分钟；这是个人项目制作过程中的前后对比。公开演示为旧版，页面会明确标记。',
        media: [
          { type: 'workflow', label: '从原文到成片', stages: ['原文导入', '智能分镜', '角色 / 场景', '画面生成', '字幕合成'] },
        ],
        actions: [
          { label: '查看代码仓库', href: 'https://github.com/Yiliwish/ai-manju-generator', external: true },
          { label: '旧版产品演示', href: 'https://ai-manju-generator.vercel.app/', external: true, note: '旧版演示，可用性待确认' },
        ],
      },
    ],
  },
  {
    id: 'architecture',
    name: '建筑项目',
    title: 'AI 建模在建筑方案中的应用',
    category: 'AI 建模 · 建筑空间',
    description: '通过可旋转的建筑模型、效果图、流线分析和方案 PDF 展示建筑形态与场地关系。',
    parts: [
      {
        label: '建筑方案',
        title: '从建筑体量到场地流线',
        intro: '以高差、坡道、露台和场地入口组织空间，结合可交互模型、效果图与流线分析图呈现方案思路。',
        steps: [
          { title: '形体构想', text: '以平台、坡道和露台构成可连续行走的建筑体量。' },
          { title: '空间推演', text: '区分人行、车行与垂直交通，检查路径交汇和场地入口。' },
          { title: '方案表达', text: '通过效果图、流线图和 PDF 图纸说明空间关系。' },
        ],
        tags: ['建筑概念', '三维模型', '场地流线', '方案图纸'],
        note: '拖动三维模型可查看建筑形态，滚轮可缩放；方向键和加减号也可操作。',
        media: [
          { type: 'model', src: '/models/architecture.glb', label: '旋转查看建筑模型', alt: '可旋转缩放的建筑方案三维模型' },
          { type: 'image', src: '/works/architecture/architecture-aerial.webp', label: '建筑场地效果图', alt: '建筑平台、坡道与周边街区的鸟瞰效果图' },
          { type: 'image', src: '/works/architecture/architecture-flow.webp', label: '场地交通流线', alt: '建筑场地的人行、车行和垂直交通流线分析图' },
          { type: 'image', src: '/works/architecture/architecture-concept-1.webp', label: '建筑概念视图一', alt: '建筑概念方案效果图一' },
          { type: 'image', src: '/works/architecture/architecture-concept-2.webp', label: '建筑概念视图二', alt: '建筑概念方案效果图二' },
          { type: 'image', src: '/works/architecture/architecture-concept-3.webp', label: '建筑概念视图三', alt: '建筑概念方案效果图三' },
          { type: 'pdf', src: '/works/architecture/project-drawings.pdf', label: '浏览建筑方案 PDF', alt: '建筑项目方案 PDF' },
        ],
        actions: [
          { label: '打开建筑方案 PDF', href: '/works/architecture/project-drawings.pdf', external: true },
        ],
      },
    ],
  },
];
