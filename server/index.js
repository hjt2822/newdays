import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { sources, timeAgo } from './sources.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001
const CACHE_TTL = 15 * 60 * 1000

app.use(cors())
app.use(express.json())

const cache = new Map()

function metaOf(src) {
  return {
    id: src.id,
    name: src.name,
    tag: src.tag,
    color: src.color,
    column: src.column,
    type: src.type,
    home: src.home,
  }
}

async function loadSource(src, force = false) {
  const hit = cache.get(src.id)
  if (!force && hit && Date.now() - hit.updatedAt < CACHE_TTL) return hit
  try {
    const items = (await src.fetch())
      .filter((it) => it && it.title)
      .map((it, i) => ({
        id: `${src.id}-${i}`,
        title: String(it.title).trim(),
        url: it.url || src.home,
        extra: it.extra,
        flag: it.flag,
        rank: it.rank,
        pubDate: it.pubDate,
        time: it.pubDate ? timeAgo(it.pubDate) : undefined,
      }))
    const payload = {
      ...metaOf(src),
      items,
      updatedAt: Date.now(),
      error: items.length ? null : 'empty',
    }
    cache.set(src.id, payload)
    return payload
  } catch (err) {
    if (hit) return { ...hit, error: err.message }
    const payload = {
      ...metaOf(src),
      items: [],
      updatedAt: Date.now(),
      error: err.message || 'fetch failed',
    }
    cache.set(src.id, payload)
    return payload
  }
}

app.get('/api/sources', (_req, res) => {
  res.json(sources.map(metaOf))
})

app.get('/api/news', async (req, res) => {
  const force = req.query.refresh === '1'
  const results = await Promise.all(sources.map((s) => loadSource(s, force)))
  res.json({
    updatedAt: Date.now(),
    sources: results,
  })
})

app.get('/api/news/:id', async (req, res) => {
  const src = sources.find((s) => s.id === req.params.id)
  if (!src) return res.status(404).json({ error: 'not found' })
  const force = req.query.refresh === '1'
  res.json(await loadSource(src, force))
})

const dist = path.join(__dirname, '..', 'dist')
app.use(express.static(dist))
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next()
  res.sendFile(path.join(dist, 'index.html'), (err) => {
    if (err) next()
  })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Daily Briefing API listening on http://0.0.0.0:${PORT}`)
})
