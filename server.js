import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { Pool } from 'pg'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const sitePort = Number(process.env.PORT) || 3000
const adminPort = Number(process.env.ADMIN_PORT) || 3001
const editorPath = process.env.EDITOR_PATH || '/editor-7f3k2'
const editorKey = process.env.EDITOR_KEY || 'artlab-dev-key'
const singlePort = process.env.SINGLE_PORT === 'true' || process.env.NODE_ENV === 'production'
const databaseUrl = process.env.DATABASE_URL

const distDir = path.join(__dirname, 'dist')
const adminDir = path.join(__dirname, 'admin')
const dataDir = path.join(__dirname, 'data')
const dataFile = path.join(dataDir, 'content.json')
const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    })
  : null

const sectionMap = {
  news: 'news',
  events: 'events',
  people: 'people',
}

const getFileContent = async () => {
  const raw = await fs.readFile(dataFile, 'utf-8')
  return JSON.parse(raw)
}

const saveFileContent = async (content) => {
  await fs.mkdir(dataDir, { recursive: true })
  await fs.writeFile(dataFile, `${JSON.stringify(content, null, 2)}\n`, 'utf-8')
}

const ensureDatabase = async () => {
  if (!pool) return

  await pool.query(`
    CREATE TABLE IF NOT EXISTS site_content (
      id INTEGER PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `)

  const countResult = await pool.query('SELECT COUNT(*)::int AS count FROM site_content')
  if (countResult.rows[0].count > 0) return

  const seedData = await getFileContent()
  await pool.query('INSERT INTO site_content (id, data) VALUES ($1, $2)', [1, seedData])
}

const getContent = async () => {
  if (!pool) return getFileContent()

  const result = await pool.query('SELECT data FROM site_content WHERE id = 1')
  if (result.rowCount && result.rows[0]?.data) return result.rows[0].data

  const seedData = await getFileContent()
  await pool.query('INSERT INTO site_content (id, data) VALUES ($1, $2)', [1, seedData])
  return seedData
}

const saveContent = async (content) => {
  if (!pool) {
    await saveFileContent(content)
    return
  }

  await pool.query(
    `
      INSERT INTO site_content (id, data, updated_at)
      VALUES (1, $1, NOW())
      ON CONFLICT (id)
      DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();
    `,
    [content],
  )
}

const validateSection = (section) => {
  const field = sectionMap[section]
  if (!field) return null
  return field
}

const requireEditorKey = (req, res, next) => {
  const key = req.header('X-Editor-Key')
  if (!key || key !== editorKey) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }
  next()
}

const registerCommonRoutes = (app) => {
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, storage: pool ? 'postgres' : 'json-file' })
  })

  app.get('/api/content', async (_req, res) => {
    try {
      const content = await getContent()
      res.json(content)
    } catch {
      res.status(500).json({ error: 'Failed to read content data' })
    }
  })
}

const registerAdminApiRoutes = (app) => {
  app.use(express.json({ limit: '2mb' }))

  app.post('/api/admin/:section', requireEditorKey, async (req, res) => {
    const field = validateSection(req.params.section)
    if (!field) {
      res.status(404).json({ error: 'Unknown section' })
      return
    }
    const item = req.body
    if (!item || typeof item !== 'object') {
      res.status(400).json({ error: 'Invalid payload' })
      return
    }

    try {
      const content = await getContent()
      content[field].push(item)
      await saveContent(content)
      res.status(201).json(item)
    } catch {
      res.status(500).json({ error: 'Failed to save content' })
    }
  })

  app.put('/api/admin/:section/:id', requireEditorKey, async (req, res) => {
    const field = validateSection(req.params.section)
    if (!field) {
      res.status(404).json({ error: 'Unknown section' })
      return
    }

    try {
      const content = await getContent()
      const list = content[field]
      const index = list.findIndex((item) => item.id === req.params.id)
      if (index < 0) {
        res.status(404).json({ error: 'Item not found' })
        return
      }
      list[index] = { ...list[index], ...req.body, id: req.params.id }
      await saveContent(content)
      res.json(list[index])
    } catch {
      res.status(500).json({ error: 'Failed to update content' })
    }
  })

  app.delete('/api/admin/:section/:id', requireEditorKey, async (req, res) => {
    const field = validateSection(req.params.section)
    if (!field) {
      res.status(404).json({ error: 'Unknown section' })
      return
    }

    try {
      const content = await getContent()
      const list = content[field]
      const nextList = list.filter((item) => item.id !== req.params.id)
      if (nextList.length === list.length) {
        res.status(404).json({ error: 'Item not found' })
        return
      }
      content[field] = nextList
      await saveContent(content)
      res.status(204).send()
    } catch {
      res.status(500).json({ error: 'Failed to delete content' })
    }
  })
}

const startServers = async () => {
  await ensureDatabase()

  if (singlePort) {
    const app = express()
    registerCommonRoutes(app)
    registerAdminApiRoutes(app)

    app.use('/admin-assets', express.static(adminDir))
    app.use(express.static(distDir))

    app.get(editorPath, (_req, res) => {
      res.sendFile(path.join(adminDir, 'index.html'))
    })

    app.use((_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'))
    })

    app.listen(sitePort, () => {
      console.log(`Site and admin are running at http://localhost:${sitePort}`)
      console.log(`Admin path: http://localhost:${sitePort}${editorPath}`)
      console.log(`Storage mode: ${pool ? 'PostgreSQL' : 'JSON file'}`)
    })
    return
  }

  const publicApp = express()
  const adminApp = express()

  registerCommonRoutes(publicApp)
  registerCommonRoutes(adminApp)
  registerAdminApiRoutes(adminApp)

  publicApp.use(express.static(distDir))
  publicApp.use('/admin-assets', express.static(adminDir))
  adminApp.use('/admin-assets', express.static(adminDir))

  adminApp.get(editorPath, (_req, res) => {
    res.sendFile(path.join(adminDir, 'index.html'))
  })

  publicApp.get(editorPath, (_req, res) => {
    res.redirect(`http://localhost:${adminPort}${editorPath}`)
  })

  publicApp.use((_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })

  adminApp.use((_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })

  publicApp.listen(sitePort, () => {
    console.log(`Site is running at http://localhost:${sitePort}`)
    console.log(`Storage mode: ${pool ? 'PostgreSQL' : 'JSON file'}`)
  })

  adminApp.listen(adminPort, () => {
    console.log(`Admin is running at http://localhost:${adminPort}${editorPath}`)
  })
}

startServers().catch((error) => {
  console.error('Server startup failed:', error)
  process.exit(1)
})
