const FETCH_TIMEOUT = 10000

async function fetchJson(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewDays/1.0)',
        Accept: 'application/json, text/plain, */*',
        ...(options.headers || {}),
      },
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

async function fetchText(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewDays/1.0)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

function decodeEntities(str = '') {
  return String(str)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
}

function parseRssXml(xml, { limit = 20 } = {}) {
  const items = []
  const matches = xml.match(/<(?:item|entry)[\s\S]*?<\/(?:item|entry)>/gi) || []
  for (const block of matches.slice(0, limit)) {
    const title = decodeEntities((block.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '')
    const link = decodeEntities((block.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1] || '')
    const href =
      (block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) || [])[1] ||
      (block.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']alternate["']/i) || [])[1] ||
      (block.match(/<link[^>]*href=["']([^"']+)["']/i) || [])[1]
    const pub = (block.match(/<(?:pubDate|published|updated)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated)>/i) || [])[1]
    if (!title) continue
    items.push({
      title,
      url: link || href || '',
      pubDate: pub ? new Date(pub).getTime() || undefined : undefined,
    })
  }
  return items
}

function pick(list, n = 20) {
  return (list || []).filter(Boolean).slice(0, n)
}

function formatHeat(n) {
  const num = Number(n)
  if (!Number.isFinite(num)) return String(n)
  if (num >= 10000) return `${(num / 10000).toFixed(1)}万`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`
  return String(num)
}

function timeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m}分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}小时前`
  return `${Math.floor(h / 24)}天前`
}

export const sources = [
  {
    id: 'v2ex',
    name: 'V2EX',
    tag: '最新分享',
    color: '#5b6578',
    column: 'tech',
    type: 'latest',
    home: 'https://www.v2ex.com',
    async fetch() {
      try {
        const data = await fetchJson('https://www.v2ex.com/api/topics/hot.json')
        return pick(data).map((t) => ({
          title: t.title,
          url: t.url,
          extra: t.replies != null ? `${t.replies} 回复` : undefined,
          pubDate: t.created ? t.created * 1000 : undefined,
        }))
      } catch {
        return parseRssXml(await fetchText('https://www.v2ex.com/index.xml'))
      }
    },
  },
  {
    id: 'weibo',
    name: '微博',
    tag: '实时热搜',
    color: '#c45c4a',
    column: 'china',
    type: 'hottest',
    home: 'https://s.weibo.com/top/summary',
    async fetch() {
      const data = await fetchJson('https://weibo.com/ajax/side/hotSearch', {
        headers: { Referer: 'https://weibo.com/' },
      })
      const list = data?.data?.realtime || []
      return pick(list, 25).map((item, i) => ({
        title: item.word || item.note,
        url: `https://s.weibo.com/weibo?q=${encodeURIComponent('#' + (item.word || item.note))}`,
        extra: item.num ? formatHeat(item.num) : undefined,
        flag: item.icon_desc || (item.is_hot === 1 ? '热' : item.is_new === 1 ? '新' : undefined),
        rank: i + 1,
      }))
    },
  },
  {
    id: 'zhihu',
    name: '知乎',
    tag: '热榜',
    color: '#3d6ea8',
    column: 'china',
    type: 'hottest',
    home: 'https://www.zhihu.com/hot',
    async fetch() {
      const data = await fetchJson('https://api.zhihu.com/topstory/hot-lists/total?limit=20')
      return pick(data?.data).map((item, i) => {
        const target = item.target || {}
        const id = target.id
        return {
          title: target.title,
          url: id ? `https://www.zhihu.com/question/${id}` : 'https://www.zhihu.com/hot',
          extra: item.detail_text,
          rank: i + 1,
        }
      })
    },
  },
  {
    id: 'ithome',
    name: 'IT之家',
    tag: '最新',
    color: '#c45c4a',
    column: 'tech',
    type: 'latest',
    home: 'https://www.ithome.com',
    async fetch() {
      return parseRssXml(await fetchText('https://www.ithome.com/rss/'))
    },
  },
  {
    id: 'cls',
    name: '金十数据',
    tag: '快讯',
    color: '#b44a3c',
    column: 'finance',
    type: 'realtime',
    home: 'https://www.cls.cn',
    async fetch() {
      const text = await fetchText('https://www.jin10.com/flash_newest.js?t=1')
      const json = text.replace(/^\s*var\s+newest\s*=\s*/, '').replace(/;\s*$/, '')
      const list = JSON.parse(json)
      return pick(list, 18)
        .map((item) => {
          const d = item.data || {}
          const title = decodeEntities(d.title || d.content || '')
          return title
            ? {
                title,
                url: d.source_link || 'https://www.jin10.com',
                pubDate: item.time ? new Date(item.time.replace(/-/g, '/')).getTime() : undefined,
              }
            : null
        })
        .filter(Boolean)
    },
  },
  {
    id: 'hackernews',
    name: 'Hacker News',
    tag: 'Top',
    color: '#c47a3a',
    column: 'world',
    type: 'hottest',
    home: 'https://news.ycombinator.com',
    async fetch() {
      const ids = await fetchJson('https://hacker-news.firebaseio.com/v0/topstories.json')
      const stories = await Promise.all(
        (ids || []).slice(0, 12).map((id) =>
          fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).catch(() => null),
        ),
      )
      return stories.filter(Boolean).map((s, i) => ({
        title: s.title,
        url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
        extra: s.score != null ? `${s.score} points` : undefined,
        rank: i + 1,
        pubDate: s.time ? s.time * 1000 : undefined,
      }))
    },
  },
  {
    id: 'zaobao',
    name: '第一财经',
    tag: '最新',
    color: '#b44a4a',
    column: 'world',
    type: 'latest',
    home: 'https://www.yicai.com',
    async fetch() {
      const list = await fetchJson('https://www.yicai.com/api/ajax/getlatest?page=1&pagesize=20')
      return pick(list).map((item) => ({
        title: item.NewsTitle,
        url: item.url ? `https://www.yicai.com${item.url}` : `https://www.yicai.com/news/${item.NewsID}.html`,
        extra: item.NewsSource || item.ChannelName,
        pubDate: item.CreateDate ? new Date(item.CreateDate).getTime() : undefined,
      }))
    },
  },
  {
    id: 'github',
    name: 'GitHub',
    tag: 'Trending',
    color: '#6b7280',
    column: 'tech',
    type: 'hottest',
    home: 'https://github.com/trending',
    async fetch() {
      const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
      const data = await fetchJson(
        `https://api.github.com/search/repositories?q=created:>${since}&sort=stars&order=desc&per_page=15`,
      )
      const items = data?.items || []
      if (items.length) {
        return pick(items, 15).map((r, i) => ({
          title: r.full_name,
          url: r.html_url,
          extra: r.stargazers_count != null ? `★ ${formatHeat(r.stargazers_count)}` : r.description,
          rank: i + 1,
        }))
      }
      return parseRssXml(await fetchText('https://rsshub.app/github/trending/daily/any'))
    },
  },
  {
    id: 'sspai',
    name: '少数派',
    tag: '最新',
    color: '#c45c4a',
    column: 'tech',
    type: 'latest',
    home: 'https://sspai.com',
    async fetch() {
      try {
        const data = await fetchJson('https://sspai.com/api/v1/article/index/page/get?limit=20&offset=0')
        return pick(data?.data).map((a) => ({
          title: a.title,
          url: `https://sspai.com/post/${a.id}`,
          extra: a.author?.nickname,
          pubDate: a.released_time ? a.released_time * 1000 : undefined,
        }))
      } catch {
        return parseRssXml(await fetchText('https://sspai.com/feed'))
      }
    },
  },
  {
    id: 'solidot',
    name: 'Solidot',
    tag: '最新',
    color: '#4a6fa5',
    column: 'tech',
    type: 'latest',
    home: 'https://www.solidot.org',
    async fetch() {
      return parseRssXml(await fetchText('https://www.solidot.org/index.rss'))
    },
  },
  {
    id: 'thepaper',
    name: '澎湃新闻',
    tag: '要闻',
    color: '#3d5a80',
    column: 'china',
    type: 'hottest',
    home: 'https://www.thepaper.cn',
    async fetch() {
      const data = await fetchJson('https://api.thepaper.cn/contentapi/wwwIndex/rightSidebar')
      const list = data?.data?.hotNews || data?.data?.editorHandpicked || []
      return pick(list).map((item, i) => ({
        title: item.name,
        url: item.contId ? `https://www.thepaper.cn/newsDetail_forward_${item.contId}` : 'https://www.thepaper.cn',
        extra: item.praiseTimes ? `${item.praiseTimes} 赞` : item.pubTime,
        rank: i + 1,
      }))
    },
  },
  {
    id: 'baidu',
    name: '百度热搜',
    tag: '实时',
    color: '#3d6ea8',
    column: 'china',
    type: 'hottest',
    home: 'https://top.baidu.com/board?tab=realtime',
    async fetch() {
      const data = await fetchJson('https://top.baidu.com/api/board?platform=wise&tab=realtime')
      const items = []
      for (const card of data?.data?.cards || []) {
        for (const group of card.content || []) {
          const rows = Array.isArray(group.content) ? group.content : [group]
          for (const it of rows) {
            if (it?.word) {
              items.push({
                title: it.word,
                url: it.url || 'https://top.baidu.com/board?tab=realtime',
                flag: it.newHotName || it.labelTagName,
              })
            }
          }
        }
      }
      return pick(items, 25).map((it, i) => ({ ...it, rank: i + 1 }))
    },
  },
  {
    id: 'toutiao',
    name: '今日头条',
    tag: '热榜',
    color: '#c45c4a',
    column: 'china',
    type: 'hottest',
    home: 'https://www.toutiao.com',
    async fetch() {
      const data = await fetchJson('https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc')
      return pick(data?.data, 25).map((item, i) => ({
        title: item.Title,
        url: item.Url || 'https://www.toutiao.com',
        extra: item.HotValue ? formatHeat(item.HotValue) : undefined,
        flag: item.Label === 'hot' ? '热' : item.Label === 'new' ? '新' : undefined,
        rank: i + 1,
      }))
    },
  },
  {
    id: 'bbc',
    name: 'BBC',
    tag: 'World',
    color: '#8b3a4a',
    column: 'world',
    type: 'latest',
    home: 'https://www.bbc.com/news',
    async fetch() {
      return parseRssXml(await fetchText('https://feeds.bbci.co.uk/news/world/rss.xml'))
    },
  },
  {
    id: 'producthunt',
    name: 'Product Hunt',
    tag: 'Today',
    color: '#c47a3a',
    column: 'tech',
    type: 'hottest',
    home: 'https://www.producthunt.com',
    async fetch() {
      return parseRssXml(await fetchText('https://www.producthunt.com/feed'), { limit: 15 }).map((item, i) => ({
        ...item,
        rank: i + 1,
      }))
    },
  },
  {
    id: 'juejin',
    name: '稀土掘金',
    tag: '热门',
    color: '#3d6ea8',
    column: 'tech',
    type: 'hottest',
    home: 'https://juejin.cn',
    async fetch() {
      try {
        const data = await fetchJson('https://api.juejin.cn/recommend_api/v1/article/recommend_all_feed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_type: 2,
            client_type: 2608,
            sort_type: 200,
            cursor: '0',
            limit: 20,
          }),
        })
        return pick(data?.data)
          .map((item) => item?.item_info || item)
          .filter((a) => a?.article_info || a?.article_id)
          .map((a, i) => ({
            title: a.article_info?.title || a.title,
            url: `https://juejin.cn/post/${a.article_id || a.article_info?.article_id}`,
            extra: a.author_user_info?.user_name,
            rank: i + 1,
          }))
      } catch {
        return parseRssXml(await fetchText('https://rsshub.app/juejin/hot'))
      }
    },
  },
  {
    id: 'wallstreet',
    name: '华尔街见闻',
    tag: '快讯',
    color: '#8b6914',
    column: 'finance',
    type: 'realtime',
    home: 'https://wallstreetcn.com',
    async fetch() {
      try {
        const data = await fetchJson(
          'https://api-one.wallstcn.com/apiv1/content/lives?channel=global-channel&limit=20',
        )
        return pick(data?.data?.items).map((item) => ({
          title: item.title || item.content_text || item.content,
          url: item.uri || `https://wallstreetcn.com/live/${item.id}`,
          pubDate: item.display_time ? item.display_time * 1000 : undefined,
        }))
      } catch {
        return parseRssXml(await fetchText('https://rsshub.app/wallstreetcn/live/global'))
      }
    },
  },
]

export { timeAgo, formatHeat }
