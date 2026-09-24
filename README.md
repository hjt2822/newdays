# 每日简报 Daily Briefing

参考 [NewsNow](https://newsnow.busiyi.world/) 的阅读体验，把微博、知乎、Hacker News、GitHub、V2EX 等热榜聚合到一页。深色沉浸光感界面，流动光晕背景与玻璃拟态卡片。

## 功能

- 沉浸光感深色界面：流动光晕、玻璃卡片、鼠标跟随辉光
- 关注 / 最热 / 实时 / 全部 四个视角
- 星标收藏来源，保存在本地
- 全站标题搜索
- 单源刷新与全部刷新
- 服务端缓存 15 分钟，降低上游压力

## 本地运行

```bash
# 安装依赖
npm install

# 同时启动 API（3001）和前端（5173）
npm run dev
```

浏览器打开 `http://localhost:5173`。前端已把 `/api` 反向代理到后端。

## 数据源

V2EX、微博、知乎、IT之家、财联社、Hacker News、联合早报、GitHub、少数派、Solidot、澎湃新闻、36氪、BBC、Product Hunt、稀土掘金、华尔街见闻。

某个源暂时失效时，卡片会显示「暂时无法获取」，其余源不受影响。
