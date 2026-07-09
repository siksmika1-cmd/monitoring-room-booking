import { Client } from '@notionhq/client'
import { ROOM_MAP } from './rooms.js'
import { kstDateIso, kstTimeLabel } from './timezone.js'
import type { Booking, CreateBookingInput, RoomId } from './types.js'

const KST = 'Asia/Seoul'

/** Notion date 속성: time_zone 사용 시 offset 없는 로컬 시각 문자열 */
function notionDateTime(iso: string): string {
  const date = kstDateIso(iso)
  const time = kstTimeLabel(iso)
  return `${date}T${time}:00`
}

function getClient() {
  const token = process.env.NOTION_API_TOKEN
  if (!token) throw new Error('NOTION_API_TOKEN이 설정되지 않았습니다')
  return new Client({ auth: token })
}

let cachedDatabaseId: string | null = null

function normalizeId(id: string): string {
  return id.replace(/-/g, '')
}

/** 페이지 ID가 들어온 경우 child_database 블록에서 실제 DB ID를 찾습니다 */
async function resolveDatabaseId(): Promise<string> {
  if (cachedDatabaseId) return cachedDatabaseId

  const raw = process.env.NOTION_DATABASE_ID
  if (!raw) throw new Error('NOTION_DATABASE_ID가 설정되지 않았습니다')

  const id = normalizeId(raw.trim())
  const notion = getClient()

  try {
    await notion.databases.retrieve({ database_id: id })
    cachedDatabaseId = id
    return id
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const isPageNotDb = message.includes('is a page, not a database')

    if (!isPageNotDb) throw e

    const { results } = await notion.blocks.children.list({ block_id: id })
    const dbBlock = results.find((block) => 'type' in block && block.type === 'child_database')
    if (dbBlock && 'id' in dbBlock) {
      cachedDatabaseId = normalizeId(dbBlock.id)
      return cachedDatabaseId
    }

    throw new Error(
      'NOTION_DATABASE_ID가 페이지 ID입니다. Notion에서 예약 DB 표를 연 뒤 우측 상단 ··· → "전체 페이지로 열기" 후 URL의 ID를 사용하거나, 페이지 안의 데이터베이스 블록을 확인해 주세요.',
    )
  }
}

/** Notion DB 속성명 후보 (한글 우선, 영문 CSV import 지원) */
const PROP_ALIASES = {
  title: ['이름', 'Name'],
  date: ['예약 시간', 'Booking Time'],
  room: ['룸', 'Room'],
  email: ['이메일', 'Email'],
  phone: ['연락처', 'Phone'],
  company: ['소속', 'Company'],
  purpose: ['방문 목적', 'Purpose'],
  protocolNo: ['Protocol No.', 'Protocol No'],
  irbNo: ['IRB No.', 'IRB No'],
  status: ['상태', 'Status'],
  cancelToken: ['취소 토큰', 'Cancel Token'],
  googleEventId: ['Google 이벤트 ID', 'Google Event ID'],
  bookingId: ['예약 ID', 'Booking ID'],
} as const

type PropsMap = Record<keyof typeof PROP_ALIASES, string>

let cachedProps: PropsMap | null = null
let cachedStatusConfirmed = '확정'
let cachedStatusCancelled = '취소'

async function resolveProps(): Promise<PropsMap> {
  if (cachedProps) return cachedProps

  const notion = getClient()
  const databaseId = await resolveDatabaseId()
  const db = await notion.databases.retrieve({ database_id: databaseId })
  const names = new Set(Object.keys(db.properties))

  const resolved = {} as PropsMap
  for (const key of Object.keys(PROP_ALIASES) as (keyof typeof PROP_ALIASES)[]) {
    const aliases = PROP_ALIASES[key]
    let found: string | undefined = aliases.find((name) => names.has(name))

    if (!found) {
      const typeByKey: Partial<Record<keyof typeof PROP_ALIASES, string>> = {
        title: 'title',
        date: 'date',
        email: 'email',
        phone: 'phone_number',
      }
      const expectedType = typeByKey[key]
      if (expectedType) {
        const entry = Object.entries(db.properties).find(([, field]) => field.type === expectedType)
        found = entry?.[0]
      }
    }

    if (!found) {
      throw new Error(
        `Notion DB에 "${aliases[0]}" 속성이 없습니다. (${aliases.join(' / ')} 중 하나 필요)`,
      )
    }
    resolved[key] = found
  }

  const statusField = db.properties[resolved.status]
  if (statusField && 'select' in statusField && statusField.type === 'select') {
    const options = statusField.select.options.map((o) => o.name)
    cachedStatusConfirmed =
      options.find((o) => o === '확정' || o === 'Confirmed') ?? options[0] ?? '확정'
    cachedStatusCancelled =
      options.find((o) => o === '취소' || o === 'Cancelled' || o === 'Canceled') ??
      options[1] ??
      '취소'
  }

  cachedProps = resolved
  return resolved
}

function isCancelledStatus(label: string): boolean {
  return label === cachedStatusCancelled || label === '취소' || label === 'Cancelled' || label === 'Canceled'
}

export async function notionQueryBookings(from: string, to: string): Promise<Booking[]> {
  const notion = getClient()
  const databaseId = await resolveDatabaseId()
  const PROPS = await resolveProps()

  const response = await notion.databases.query({
    database_id: databaseId,
    filter: {
      and: [
        {
          property: PROPS.date,
          date: { on_or_after: from },
        },
        {
          property: PROPS.date,
          date: { on_or_before: to },
        },
      ],
    },
  })

  return response.results.flatMap((page) => {
    if (!('properties' in page)) return []
    return [pageToBooking(page as { id: string; properties: Record<string, unknown> }, PROPS)]
  })
}

function richText(props: Record<string, unknown>, key: string): string {
  const field = props[key] as { rich_text?: { plain_text: string }[] } | undefined
  return field?.rich_text?.map((t) => t.plain_text).join('') ?? ''
}

function select(props: Record<string, unknown>, key: string): string {
  const field = props[key] as { select?: { name: string } | null } | undefined
  return field?.select?.name ?? ''
}

function email(props: Record<string, unknown>, key: string): string {
  const field = props[key] as { email?: string | null } | undefined
  return field?.email ?? ''
}

function phone(props: Record<string, unknown>, key: string): string {
  const field = props[key] as { phone_number?: string | null } | undefined
  return field?.phone_number ?? richText(props, key)
}

function title(props: Record<string, unknown>, key: string): string {
  const field = props[key] as { title?: { plain_text: string }[] } | undefined
  return field?.title?.map((t) => t.plain_text).join('') ?? ''
}

function dateRange(props: Record<string, unknown>, key: string) {
  const field = props[key] as {
    date?: { start: string; end?: string | null } | null
  } | undefined
  return field?.date
}

function pageToBooking(
  page: { id: string; properties: Record<string, unknown> },
  PROPS: PropsMap,
): Booking {
  const props = page.properties
  const range = dateRange(props, PROPS.date)
  const roomName = select(props, PROPS.room)
  const matchedRoom = Object.values(ROOM_MAP).find((r) => r.name === roomName)
  const roomId: RoomId = matchedRoom?.id ?? 'room-2p-a'

  const statusLabel = select(props, PROPS.status)
  const status: Booking['status'] = isCancelledStatus(statusLabel) ? 'cancelled' : 'confirmed'

  return {
    id: richText(props, PROPS.bookingId) || page.id,
    notionPageId: page.id,
    roomId,
    roomName: roomName || ROOM_MAP[roomId].name,
    startAt: range?.start ?? new Date().toISOString(),
    endAt: range?.end ?? range?.start ?? new Date().toISOString(),
    visitorName: title(props, PROPS.title).split(' · ')[0] ?? title(props, PROPS.title),
    visitorEmail: email(props, PROPS.email),
    visitorPhone: phone(props, PROPS.phone),
    company: richText(props, PROPS.company) || undefined,
    purpose: richText(props, PROPS.purpose) || undefined,
    protocolNo: richText(props, PROPS.protocolNo) || '',
    irbNo: richText(props, PROPS.irbNo) || '',
    status,
    cancelToken: richText(props, PROPS.cancelToken),
    googleEventId: richText(props, PROPS.googleEventId) || undefined,
    createdAt: range?.start ?? new Date().toISOString(),
  }
}

export async function notionCreateBooking(
  bookingId: string,
  cancelToken: string,
  input: CreateBookingInput,
  googleEventId?: string,
): Promise<string> {
  const notion = getClient()
  const databaseId = await resolveDatabaseId()
  const PROPS = await resolveProps()
  const room = ROOM_MAP[input.roomId]

  const page = await notion.pages.create({
    parent: { database_id: databaseId },
    properties: {
      [PROPS.title]: {
        title: [{ text: { content: `${input.visitorName} · ${room.name}` } }],
      },
      [PROPS.date]: {
        date: {
          start: notionDateTime(input.startAt),
          end: notionDateTime(input.endAt),
          time_zone: KST,
        },
      },
      [PROPS.room]: { select: { name: room.name } },
      [PROPS.email]: { email: input.visitorEmail },
      [PROPS.phone]: { phone_number: input.visitorPhone },
      [PROPS.company]: {
        rich_text: input.company ? [{ text: { content: input.company } }] : [],
      },
      [PROPS.purpose]: {
        rich_text: input.purpose ? [{ text: { content: input.purpose } }] : [],
      },
      [PROPS.protocolNo]: {
        rich_text: [{ text: { content: input.protocolNo } }],
      },
      [PROPS.irbNo]: {
        rich_text: [{ text: { content: input.irbNo } }],
      },
      [PROPS.status]: { select: { name: cachedStatusConfirmed } },
      [PROPS.cancelToken]: {
        rich_text: [{ text: { content: cancelToken } }],
      },
      [PROPS.bookingId]: {
        rich_text: [{ text: { content: bookingId } }],
      },
      [PROPS.googleEventId]: {
        rich_text: googleEventId ? [{ text: { content: googleEventId } }] : [],
      },
    },
  }).catch((e: unknown) => {
    const message = e instanceof Error ? e.message : String(e)
    if (message.includes('is not a property that exists')) {
      throw new Error(
        `Notion DB 속성명이 앱과 일치하지 않습니다. DB 열 이름을 "이름", "예약 시간", "룸" 등으로 맞춰 주세요. (Notion: ${message})`,
      )
    }
    throw e
  })

  return page.id
}

export async function notionUpdateGoogleEventId(pageId: string, googleEventId: string) {
  const notion = getClient()
  const PROPS = await resolveProps()
  await notion.pages.update({
    page_id: pageId,
    properties: {
      [PROPS.googleEventId]: {
        rich_text: [{ text: { content: googleEventId } }],
      },
    },
  })
}

export async function notionCancelBooking(pageId: string) {
  const notion = getClient()
  const PROPS = await resolveProps()
  await notion.pages.update({
    page_id: pageId,
    properties: {
      [PROPS.status]: { select: { name: cachedStatusCancelled } },
    },
  })
}

export async function notionRestoreBooking(pageId: string) {
  const notion = getClient()
  const PROPS = await resolveProps()
  await notion.pages.update({
    page_id: pageId,
    properties: {
      [PROPS.status]: { select: { name: cachedStatusConfirmed } },
    },
  })
}

export async function notionUpdateBookingSchedule(
  pageId: string,
  input: { startAt: string; endAt: string; roomId?: RoomId },
) {
  const notion = getClient()
  const PROPS = await resolveProps()

  if (input.roomId) {
    await notion.pages.update({
      page_id: pageId,
      properties: {
        [PROPS.date]: {
          date: {
            start: notionDateTime(input.startAt),
            end: notionDateTime(input.endAt),
            time_zone: KST,
          },
        },
        [PROPS.room]: { select: { name: ROOM_MAP[input.roomId].name } },
      },
    })
    return
  }

  await notion.pages.update({
    page_id: pageId,
    properties: {
      [PROPS.date]: {
        date: {
          start: notionDateTime(input.startAt),
          end: notionDateTime(input.endAt),
          time_zone: KST,
        },
      },
    },
  })
}

export async function notionFindByBookingId(bookingId: string): Promise<Booking | null> {
  const notion = getClient()
  const databaseId = await resolveDatabaseId()
  const PROPS = await resolveProps()

  const response = await notion.databases.query({
    database_id: databaseId,
    filter: {
      property: PROPS.bookingId,
      rich_text: { equals: bookingId },
    },
  })

  const page = response.results[0]
  if (!page || !('properties' in page)) return null
  return pageToBooking(page, PROPS)
}

export async function notionFindByEmail(email: string): Promise<Booking[]> {
  const notion = getClient()
  const databaseId = await resolveDatabaseId()
  const PROPS = await resolveProps()

  const response = await notion.databases.query({
    database_id: databaseId,
    filter: {
      property: PROPS.email,
      email: { equals: email.trim() },
    },
  })

  return response.results.flatMap((page) => {
    if (!('properties' in page)) return []
    return [pageToBooking(page as { id: string; properties: Record<string, unknown> }, PROPS)]
  })
}

export function formatBookingSummary(input: CreateBookingInput) {
  const room = ROOM_MAP[input.roomId]
  const start = `${kstDateIso(input.startAt)} ${kstTimeLabel(input.startAt)}`
  const end = kstTimeLabel(input.endAt)
  return `${room.name} · ${start}–${end} · ${input.visitorName}`
}
