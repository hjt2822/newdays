<template>
  <div class="stage">
    <div class="blob b1" />
    <div class="blob b2" />
    <div class="blob b3" />
  </div>
  <div class="app">
    <header class="topbar">
      <div class="brand">
        <div class="logo">简</div>
        <div>
          <h1>每日<span>简报</span></h1>
          <small>Daily Briefing · 一屏看完全网热点</small>
        </div>
      </div>

      <nav class="tabs">
        <button v-for="t in tabs" :key="t.id" :class="{ active: tab === t.id }" @click="tab = t.id">
          {{ t.label }}
        </button>
      </nav>

      <div class="actions">
        <button class="icon-btn" title="刷新全部" :disabled="loading" @click="load(true)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 1 1-2.3-6" />
            <path d="M21 3v6h-6" />
          </svg>
        </button>
        <button class="icon-btn" title="搜索" @click="showSearch = !showSearch">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3-3" />
          </svg>
        </button>
        <button class="pill-btn" @click="showMore = true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
          </svg>
          更多
        </button>
      </div>
    </header>

    <div v-if="showSearch" class="search-wrap">
      <input v-model="keyword" placeholder="搜索全部热榜标题…" autofocus />
    </div>

    <section v-if="filteredCards.length" class="grid">
      <article
        v-for="(card, i) in filteredCards"
        :key="card.id"
        class="card"
        :style="{ '--tone': card.color, '--delay': Math.min(i, 11) * 55 + 'ms' }"
        @mousemove="onCardMove"
      >
        <div class="card-head">
          <a class="head-left" :href="card.home" target="_blank" rel="noreferrer">
            <div class="avatar">{{ card.name.slice(0, 1) }}</div>
            <div class="head-meta">
              <div class="name">
                {{ card.name }}
                <span v-if="card.tag" class="tag">{{ card.tag }}</span>
              </div>
              <div class="updated">{{ formatUpdated(card.updatedAt) }}</div>
            </div>
          </a>
          <div class="head-ops">
            <button class="icon-btn" title="刷新" @click="refreshOne(card.id)">↻</button>
            <button class="icon-btn" :class="{ active: isStarred(card.id) }" title="关注" @click="toggleStar(card.id)">★</button>
          </div>
        </div>

        <div class="list">
          <div v-if="!card.items?.length && card.error" class="error">暂时无法获取，稍后再试</div>
          <div v-else-if="!card.items?.length" class="empty">暂无内容</div>
          <a
            v-for="item in visibleItems(card)"
            :key="item.id"
            class="item"
            :href="item.url"
            target="_blank"
            rel="noreferrer"
          >
            <div v-if="item.rank" class="rank" :class="item.rank <= 3 ? `r${item.rank}` : ''">{{ item.rank }}</div>
            <div v-else class="time-col">{{ item.time || '刚刚' }}</div>
            <div>
              <div class="title">
                {{ item.title }}
                <span v-if="item.flag" class="flag" :class="item.flag">{{ item.flag }}</span>
              </div>
              <div v-if="item.extra" class="extra">{{ item.extra }}</div>
            </div>
          </a>
        </div>
      </article>
    </section>

    <div v-else-if="loading" class="grid">
      <article v-for="n in 6" :key="n" class="card" style="--tone:#8a5a52">
        <div class="skeleton" /><div class="skeleton" /><div class="skeleton" /><div class="skeleton" />
      </article>
    </div>

    <p v-else class="hint">{{ emptyHint }}</p>

    <div v-if="showMore" class="drawer-mask" @click.self="showMore = false">
      <div class="drawer">
        <h2>选择关注的来源</h2>
        <p>点星收藏后，可在「关注」页只看这些栏目。</p>
        <div class="source-list">
          <div v-for="s in allCards" :key="s.id" class="source-row">
            <span>{{ s.name }} · {{ s.tag }}</span>
            <button class="icon-btn" :class="{ active: isStarred(s.id) }" @click="toggleStar(s.id)">★</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'

const tabs = [
  { id: 'focus', label: '关注' },
  { id: 'hottest', label: '最热' },
  { id: 'realtime', label: '实时' },
  { id: 'all', label: '全部' },
]

const tab = ref('hottest')
const loading = ref(false)
const allCards = ref([])
const keyword = ref('')
const showSearch = ref(false)
const showMore = ref(false)
const stars = ref(loadStars())

function loadStars() {
  try {
    return JSON.parse(localStorage.getItem('newdays-stars') || '[]')
  } catch {
    return []
  }
}

function saveStars() {
  localStorage.setItem('newdays-stars', JSON.stringify(stars.value))
}

function isStarred(id) {
  return stars.value.includes(id)
}

function toggleStar(id) {
  stars.value = isStarred(id) ? stars.value.filter((x) => x !== id) : [...stars.value, id]
  saveStars()
}

function onCardMove(e) {
  const el = e.currentTarget
  const r = el.getBoundingClientRect()
  el.style.setProperty('--mx', `${e.clientX - r.left}px`)
  el.style.setProperty('--my', `${e.clientY - r.top}px`)
}

function formatUpdated(ts) {
  if (!ts) return '尚未更新'
  const m = Math.max(0, Math.floor((Date.now() - ts) / 60000))
  if (m < 1) return '刚刚更新'
  if (m < 60) return `${m}分钟前更新`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}小时前更新`
  return `${Math.floor(h / 24)}天前更新`
}

function visibleItems(card) {
  const q = keyword.value.trim().toLowerCase()
  const items = card.items || []
  if (!q) return items.slice(0, 12)
  return items.filter((it) => it.title.toLowerCase().includes(q)).slice(0, 12)
}

const filteredCards = computed(() => {
  let list = allCards.value
  if (tab.value === 'focus') list = list.filter((c) => isStarred(c.id))
  if (tab.value === 'hottest') list = list.filter((c) => c.type === 'hottest' || ['weibo', 'zhihu', 'hackernews', 'github'].includes(c.id))
  if (tab.value === 'realtime') list = list.filter((c) => c.type === 'realtime' || c.type === 'latest')
  const q = keyword.value.trim().toLowerCase()
  if (q) {
    list = list.filter((c) =>
      c.name.toLowerCase().includes(q) || (c.items || []).some((it) => it.title.toLowerCase().includes(q)),
    )
  }
  return list
})

const emptyHint = computed(() => {
  if (tab.value === 'focus' && !stars.value.length) return '还没有关注来源。点卡片上的星标，或打开「更多」选择栏目。'
  return '没有匹配的内容。'
})

async function load(force = false) {
  loading.value = true
  try {
    const res = await fetch(`/api/news${force ? '?refresh=1' : ''}`)
    const data = await res.json()
    allCards.value = data.sources || []
  } catch {
    allCards.value = []
  } finally {
    loading.value = false
  }
}

async function refreshOne(id) {
  const res = await fetch(`/api/news/${id}?refresh=1`)
  const data = await res.json()
  allCards.value = allCards.value.map((c) => (c.id === id ? data : c))
}

onMounted(() => load())
</script>
