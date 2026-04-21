import './style.css'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) throw new Error('App root not found')

app.innerHTML = `
<main class="page">
  <header class="glass-panel hero artlab-hero">
    <div class="brand">
      <img class="brand-logo" src="/artlab-logo.svg" alt="ArtLab logo" />
    </div>
    <div class="hero-actions">
      <button class="glass-button nav-button is-active" type="button">Новости</button>
      <button class="glass-button nav-button" type="button">Календарь событий</button>
      <button class="glass-button nav-button" type="button">Люди</button>
      <button class="glass-button nav-button" type="button">Расписание</button>
    </div>
  </header>

  <section class="glass-panel content-page">
    <h1 id="page-title" class="page-title">Новости</h1>
    <div id="page-content" class="page-content">
      <p>Последние новости ArtLab и важные обновления студенческой жизни.</p>
    </div>
  </section>

  <div id="pdf-modal" class="pdf-modal" aria-hidden="true">
    <div class="pdf-modal-dialog">
      <button id="pdf-modal-close" class="pdf-modal-close" type="button" aria-label="Закрыть">✕</button>
      <iframe id="pdf-frame" class="pdf-frame" title="Просмотр PDF"></iframe>
    </div>
  </div>

  <div id="news-modal" class="news-modal" aria-hidden="true">
    <div class="news-modal-dialog">
      <button id="news-modal-close" class="news-modal-close" type="button" aria-label="Закрыть">✕</button>
      <img id="news-photo" class="news-photo" alt="Фото мероприятия" />
      <div class="news-modal-content">
        <h3 id="news-title" class="news-title"></h3>
        <p id="news-description" class="news-description"></p>
        <div class="news-gallery-controls">
          <button id="news-prev" class="news-gallery-nav" type="button">◀</button>
          <span id="news-gallery-index" class="news-gallery-index"></span>
          <button id="news-next" class="news-gallery-nav" type="button">▶</button>
        </div>
      </div>
    </div>
  </div>

</main>
`

const navButtons = document.querySelectorAll<HTMLButtonElement>('.nav-button')
const pageTitle = document.querySelector<HTMLHeadingElement>('#page-title')
const pageContent = document.querySelector<HTMLDivElement>('#page-content')

if (!pageTitle || !pageContent) {
  throw new Error('Page content elements not found')
}

const pdfModal = document.querySelector<HTMLDivElement>('#pdf-modal')
const pdfFrame = document.querySelector<HTMLIFrameElement>('#pdf-frame')
const pdfModalClose = document.querySelector<HTMLButtonElement>('#pdf-modal-close')
const newsModal = document.querySelector<HTMLDivElement>('#news-modal')
const newsModalClose = document.querySelector<HTMLButtonElement>('#news-modal-close')
const newsPhoto = document.querySelector<HTMLImageElement>('#news-photo')
const newsTitle = document.querySelector<HTMLHeadingElement>('#news-title')
const newsDescription = document.querySelector<HTMLParagraphElement>('#news-description')
const newsPrev = document.querySelector<HTMLButtonElement>('#news-prev')
const newsNext = document.querySelector<HTMLButtonElement>('#news-next')
const newsGalleryIndex = document.querySelector<HTMLSpanElement>('#news-gallery-index')

if (
  !pdfModal ||
  !pdfFrame ||
  !pdfModalClose ||
  !newsModal ||
  !newsModalClose ||
  !newsPhoto ||
  !newsTitle ||
  !newsDescription ||
  !newsPrev ||
  !newsNext ||
  !newsGalleryIndex
) {
  throw new Error('PDF modal elements not found')
}

type NewsItem = {
  id: string
  title: string
  description: string
  photos: string[]
}

type EventItem = {
  id: string
  date: string
  title: string
  place: string
  description: string
}

type PersonItem = {
  id: string
  name: string
  role: string
  photo?: string
}

type ScheduleItem = {
  id: string
  title: string
  file: string
  description?: string
}

type SiteContent = {
  news: NewsItem[]
  events: EventItem[]
  people: PersonItem[]
  schedulePdfs: ScheduleItem[]
}

let contentData: SiteContent = {
  news: [],
  events: [],
  people: [],
  schedulePdfs: [],
}

let activeNews: NewsItem | null = null
let activeNewsPhoto = 0

const monthNames = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
]

const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

let calendarDate = new Date()
let selectedDay: number | null = new Date().getDate()

const renderCalendarPage = () => {
  const year = calendarDate.getFullYear()
  const month = calendarDate.getMonth()
  const firstWeekDay = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevMonthDays = new Date(year, month, 0).getDate()

  const cells: string[] = []

  for (let i = 0; i < firstWeekDay; i += 1) {
    const day = prevMonthDays - firstWeekDay + i + 1
    cells.push(`<button class="calendar-day muted" type="button" disabled>${day}</button>`)
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const isSelected = selectedDay === day
    cells.push(
      `<button class="calendar-day ${isSelected ? 'selected' : ''}" type="button" data-calendar-day="${day}">${day}</button>`,
    )
  }

  while (cells.length % 7 !== 0) {
    const nextDay = cells.length % 7
    cells.push(`<button class="calendar-day muted" type="button" disabled>${nextDay + 1}</button>`)
  }

  const eventsMarkup = contentData.events.length
    ? contentData.events
        .map(
          (eventItem) => `
            <article class="event-card">
              <h4>${eventItem.title}</h4>
              <p class="event-meta">${eventItem.date} | ${eventItem.place}</p>
              <p>${eventItem.description}</p>
            </article>
          `,
        )
        .join('')
    : '<p>События пока не добавлены.</p>'

  pageContent.innerHTML = `
    <section class="calendar-ui">
      <div class="calendar-toolbar">
        <button class="calendar-nav" type="button" data-calendar-nav="prev">◀</button>
        <h3 class="calendar-title">${monthNames[month]} ${year}</h3>
        <button class="calendar-nav" type="button" data-calendar-nav="next">▶</button>
      </div>
      <div class="calendar-weekdays">
        ${weekDays.map((day) => `<span>${day}</span>`).join('')}
      </div>
      <div class="calendar-grid">
        ${cells.join('')}
      </div>
    </section>
    <section class="events-list">
      <h3 class="events-list-title">События</h3>
      <div class="events-list-grid">${eventsMarkup}</div>
    </section>
  `
}

const renderSchedulePage = () => {
  const cards = contentData.schedulePdfs
    .map(
      (pdf) => `
        <article class="pdf-card">
          <h3 class="pdf-title">${pdf.title}</h3>
          <button class="pdf-open-button" type="button" data-pdf-file="${pdf.file}">Открыть PDF</button>
        </article>
      `,
    )
    .join('')

  pageContent.innerHTML = `<div class="pdf-grid">${cards}</div>`
}

const renderPage = (title: string) => {
  if (title === 'Расписание') {
    renderSchedulePage()
    return
  }

  if (title === 'Календарь событий') {
    renderCalendarPage()
    return
  }

  if (title === 'Люди') {
    pageContent.innerHTML = `
      <div class="people-grid">
        ${contentData.people
          .map(
            (person) => `
              <article class="person-card">
                <img
                  class="person-photo"
                  src="${person.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(person.name)}&background=c31111&color=faf9f6&size=256`}"
                  alt="${person.name}"
                />
                <h3 class="person-name">${person.name}</h3>
                <p class="person-role">${person.role}</p>
              </article>
            `,
          )
          .join('')}
      </div>
    `
    return
  }

  if (title === 'Новости') {
    pageContent.innerHTML = `
      <div class="news-grid">
        ${contentData.news
          .map(
            (item) => `
              <article class="news-card">
                <img class="news-card-image" src="${item.photos[0]}" alt="${item.title}" />
                <div class="news-card-body">
                  <h3 class="news-card-title">${item.title}</h3>
                  <button class="news-more-button" type="button" data-news-id="${item.id}">Подробнее</button>
                </div>
              </article>
            `,
          )
          .join('')}
      </div>
    `
    return
  }

  const pages: Record<string, string> = {
    'Календарь событий': 'Ближайшие мероприятия, встречи и дедлайны по проектам.',
    Люди: 'Команда ArtLab, активисты и ключевые контакты сообщества.',
  }
  pageContent.innerHTML = `<p>${pages[title] ?? 'Содержимое страницы будет добавлено.'}</p>`
}

const closePdfModal = () => {
  pdfModal.classList.remove('is-open')
  pdfModal.setAttribute('aria-hidden', 'true')
  pdfFrame.src = ''
}

const openPdfModal = (file: string) => {
  pdfFrame.src = file
  pdfModal.classList.add('is-open')
  pdfModal.setAttribute('aria-hidden', 'false')
}

const closeNewsModal = () => {
  newsModal.classList.remove('is-open')
  newsModal.setAttribute('aria-hidden', 'true')
  activeNews = null
  activeNewsPhoto = 0
}

const syncNewsModal = () => {
  if (!activeNews) return
  newsPhoto.src = activeNews.photos[activeNewsPhoto]
  newsTitle.textContent = activeNews.title
  newsDescription.textContent = activeNews.description
  newsGalleryIndex.textContent = `${activeNewsPhoto + 1} / ${activeNews.photos.length}`
}

const openNewsModal = (newsId: string) => {
  const item = contentData.news.find((news) => news.id === newsId)
  if (!item) return
  activeNews = item
  activeNewsPhoto = 0
  syncNewsModal()
  newsModal.classList.add('is-open')
  newsModal.setAttribute('aria-hidden', 'false')
}

navButtons.forEach((button) => {
  button.addEventListener('click', () => {
    navButtons.forEach((item) => item.classList.remove('is-active'))
    button.classList.add('is-active')
    const title = button.textContent?.trim() ?? 'Страница'
    pageTitle.textContent = title
    renderPage(title)
  })
})

pageContent.addEventListener('click', (event) => {
  const target = event.target as HTMLElement
  const file = target.getAttribute('data-pdf-file')
  if (file) {
    openPdfModal(file)
    return
  }

  const nav = target.getAttribute('data-calendar-nav')
  if (nav === 'prev') {
    calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1)
    selectedDay = null
    renderCalendarPage()
    return
  }

  if (nav === 'next') {
    calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1)
    selectedDay = null
    renderCalendarPage()
    return
  }

  const day = target.getAttribute('data-calendar-day')
  if (day) {
    selectedDay = Number(day)
    renderCalendarPage()
    return
  }

  const newsId = target.getAttribute('data-news-id')
  if (newsId) {
    openNewsModal(newsId)
  }
})

pdfModalClose.addEventListener('click', closePdfModal)

pdfModal.addEventListener('click', (event) => {
  if (event.target === pdfModal) {
    closePdfModal()
  }
})

newsModalClose.addEventListener('click', closeNewsModal)

newsModal.addEventListener('click', (event) => {
  if (event.target === newsModal) {
    closeNewsModal()
  }
})

newsPrev.addEventListener('click', () => {
  if (!activeNews) return
  activeNewsPhoto = (activeNewsPhoto - 1 + activeNews.photos.length) % activeNews.photos.length
  syncNewsModal()
})

newsNext.addEventListener('click', () => {
  if (!activeNews) return
  activeNewsPhoto = (activeNewsPhoto + 1) % activeNews.photos.length
  syncNewsModal()
})

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && pdfModal.classList.contains('is-open')) {
    closePdfModal()
  }
  if (event.key === 'Escape' && newsModal.classList.contains('is-open')) {
    closeNewsModal()
  }
})

const loadContent = async () => {
  try {
    const response = await fetch('/api/content')
    if (!response.ok) throw new Error('Failed to fetch content')
    const data = (await response.json()) as SiteContent
    contentData = data
  } catch {
    pageContent.innerHTML = '<p>Не удалось загрузить контент. Проверьте сервер.</p>'
  }
}

const init = async () => {
  await loadContent()
  renderPage('Новости')
}

void init()
