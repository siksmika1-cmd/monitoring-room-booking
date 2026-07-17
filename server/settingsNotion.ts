import { Client } from '@notionhq/client'
import type { AppSettings } from './types.js'

const SETTINGS_PAGE_TITLE = '예약 앱 설정'
const RICH_TEXT_CHUNK = 2000

let cachedSettingsPageId: string | null = null

function getClient() {
  const token = process.env.NOTION_API_TOKEN
  if (!token) throw new Error('NOTION_API_TOKEN이 설정되지 않았습니다')
  return new Client({ auth: token })
}

function normalizeId(id: string): string {
  return id.replace(/-/g, '')
}

function toRichText(text: string) {
  if (!text) return [{ type: 'text' as const, text: { content: '' } }]
  const chunks = []
  for (let i = 0; i < text.length; i += RICH_TEXT_CHUNK) {
    chunks.push({ type: 'text' as const, text: { content: text.slice(i, i + RICH_TEXT_CHUNK) } })
  }
  return chunks
}

function pageTitle(page: { properties?: Record<string, unknown> }): string {
  if (!page.properties) return ''
  for (const prop of Object.values(page.properties)) {
    if (
      prop &&
      typeof prop === 'object' &&
      'type' in prop &&
      prop.type === 'title' &&
      'title' in prop &&
      Array.isArray(prop.title)
    ) {
      return prop.title.map((t) => ('plain_text' in t ? t.plain_text : '')).join('')
    }
  }
  return ''
}

async function resolveParentPageId(notion: Client): Promise<string | undefined> {
  const raw = process.env.NOTION_DATABASE_ID
  if (!raw) return undefined

  const id = normalizeId(raw.trim())
  try {
    const db = await notion.databases.retrieve({ database_id: id })
    if ('parent' in db && db.parent.type === 'page_id') return db.parent.page_id
    return undefined
  } catch {
    try {
      await notion.pages.retrieve({ page_id: id })
      return id
    } catch {
      return undefined
    }
  }
}

async function findSettingsPageId(notion: Client): Promise<string | undefined> {
  const explicit = process.env.NOTION_SETTINGS_PAGE_ID?.trim()
  if (explicit) {
    const pageId = normalizeId(explicit)
    await notion.pages.retrieve({ page_id: pageId })
    return pageId
  }

  const { results } = await notion.search({
    query: SETTINGS_PAGE_TITLE,
    filter: { property: 'object', value: 'page' },
    page_size: 20,
  })

  for (const item of results) {
    if (!('object' in item) || item.object !== 'page' || !('id' in item)) continue
    const page = await notion.pages.retrieve({ page_id: item.id })
    if ('properties' in page && pageTitle(page) === SETTINGS_PAGE_TITLE) return normalizeId(item.id)
  }

  return undefined
}

async function createSettingsPage(notion: Client): Promise<string> {
  const parentPageId = await resolveParentPageId(notion)
  if (!parentPageId) {
    throw new Error(
      'Notion 설정 페이지를 만들 수 없습니다. NOTION_SETTINGS_PAGE_ID를 환경 변수에 지정해 주세요.',
    )
  }

  const page = await notion.pages.create({
    parent: { page_id: parentPageId },
    properties: {
      title: {
        title: [{ type: 'text', text: { content: SETTINGS_PAGE_TITLE } }],
      },
    },
  })

  return normalizeId(page.id)
}

async function getOrCreateSettingsPageId(): Promise<string> {
  if (cachedSettingsPageId) return cachedSettingsPageId

  const notion = getClient()
  const existing = await findSettingsPageId(notion)
  cachedSettingsPageId = existing ?? (await createSettingsPage(notion))
  return cachedSettingsPageId
}

async function readSettingsJson(pageId: string): Promise<string | null> {
  const notion = getClient()
  const { results } = await notion.blocks.children.list({ block_id: pageId })
  const codeBlock = results.find(
    (block) => 'type' in block && block.type === 'code' && 'code' in block && block.code.language === 'json',
  )

  if (!codeBlock || !('code' in codeBlock)) return null
  const json = codeBlock.code.rich_text.map((part) => part.plain_text).join('')
  return json.trim() ? json : null
}

async function writeSettingsJson(pageId: string, json: string) {
  const notion = getClient()
  const { results } = await notion.blocks.children.list({ block_id: pageId })
  const codeBlock = results.find(
    (block) => 'type' in block && block.type === 'code' && 'code' in block && block.code.language === 'json',
  )

  const rich_text = toRichText(json)
  if (codeBlock && 'id' in codeBlock) {
    await notion.blocks.update({
      block_id: codeBlock.id,
      code: { rich_text },
    })
    return
  }

  await notion.blocks.children.append({
    block_id: pageId,
    children: [
      {
        object: 'block',
        type: 'code',
        code: {
          caption: [],
          rich_text,
          language: 'json',
        },
      },
    ],
  })
}

export async function loadSettingsFromNotion(): Promise<Partial<AppSettings> | null> {
  try {
    const notion = getClient()
    const pageId = await findSettingsPageId(notion)
    if (!pageId) return null
    const json = await readSettingsJson(pageId)
    if (!json) return null
    return JSON.parse(json) as Partial<AppSettings>
  } catch {
    return null
  }
}

export async function saveSettingsToNotion(settings: AppSettings): Promise<void> {
  const pageId = await getOrCreateSettingsPageId()
  const payload = {
    slotMinutes: settings.slotMinutes,
    weekdaySchedules: settings.weekdaySchedules,
    blockedDates: settings.blockedDates,
    updatedAt: settings.updatedAt,
  }
  await writeSettingsJson(pageId, `${JSON.stringify(payload, null, 2)}\n`)
}
