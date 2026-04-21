const API_BASE = 'http://localhost:3001'
const KEY_STORAGE = 'artlab-editor-key'

const state = {
  content: { news: [], events: [], people: [], schedulePdfs: [] },
}

const keyInput = document.querySelector('#editor-key')
const saveKeyBtn = document.querySelector('#save-key')

const forms = {
  news: document.querySelector('#news-form'),
  events: document.querySelector('#events-form'),
  people: document.querySelector('#people-form'),
}

const lists = {
  news: document.querySelector('#news-list'),
  events: document.querySelector('#events-list'),
  people: document.querySelector('#people-list'),
}

const getKey = () => sessionStorage.getItem(KEY_STORAGE) || ''

const request = async (url, options = {}) => {
  const headers = new Headers(options.headers || {})
  if (options.auth) {
    headers.set('X-Editor-Key', getKey())
  }
  if (options.body) {
    headers.set('Content-Type', 'application/json')
  }
  const response = await fetch(url, { ...options, headers })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `HTTP ${response.status}`)
  }
  if (response.status === 204) return null
  return response.json()
}

const renderList = (section, items) => {
  const root = lists[section]
  if (!root) return
  root.innerHTML = items
    .map((item) => {
      const title = item.title || item.name || item.id
      const meta =
        section === 'events'
          ? `${item.date} | ${item.place}`
          : item.description || item.role || ''
      return `
      <article class="item">
        <div class="item-title">${title}</div>
        <div class="item-meta">${meta}</div>
        <div class="item-actions">
          <button type="button" data-action="delete" data-section="${section}" data-id="${item.id}">Удалить</button>
        </div>
      </article>
    `
    })
    .join('')
}

const render = () => {
  renderList('news', state.content.news)
  renderList('events', state.content.events)
  renderList('people', state.content.people)
}

const loadContent = async () => {
  const data = await request(`${API_BASE}/api/content`)
  state.content = data
  render()
}

const createItem = async (section, payload) => {
  await request(`${API_BASE}/api/admin/${section}`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  })
  await loadContent()
}

forms.news?.addEventListener('submit', async (event) => {
  event.preventDefault()
  const formData = new FormData(forms.news)
  const photosRaw = String(formData.get('photos') || '')
  const photos = photosRaw
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean)
  await createItem('news', {
    id: String(formData.get('id')),
    title: String(formData.get('title')),
    description: String(formData.get('description')),
    photos,
  })
  forms.news.reset()
})

forms.events?.addEventListener('submit', async (event) => {
  event.preventDefault()
  const formData = new FormData(forms.events)
  await createItem('events', {
    id: String(formData.get('id')),
    date: String(formData.get('date')),
    title: String(formData.get('title')),
    place: String(formData.get('place')),
    description: String(formData.get('description')),
  })
  forms.events.reset()
})

forms.people?.addEventListener('submit', async (event) => {
  event.preventDefault()
  const formData = new FormData(forms.people)
  await createItem('people', {
    id: String(formData.get('id')),
    name: String(formData.get('name')),
    role: String(formData.get('role')),
    photo: String(formData.get('photo') || ''),
  })
  forms.people.reset()
})

document.body.addEventListener('click', async (event) => {
  const target = event.target
  if (!(target instanceof HTMLElement)) return
  if (target.id === 'save-key') {
    sessionStorage.setItem(KEY_STORAGE, String(keyInput?.value || ''))
    alert('Ключ сохранен для текущей сессии')
    return
  }
  if (target.dataset.action === 'delete') {
    const { section, id } = target.dataset
    if (!section || !id) return
    await request(`${API_BASE}/api/admin/${section}/${id}`, {
      method: 'DELETE',
      auth: true,
    })
    await loadContent()
  }
})

keyInput.value = getKey()
loadContent().catch((error) => {
  // eslint-disable-next-line no-alert
  alert(`Ошибка загрузки: ${error.message}`)
})
