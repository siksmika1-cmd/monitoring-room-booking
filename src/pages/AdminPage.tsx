import { useEffect, useMemo, useState } from 'react'
import { Loader2, Save, Settings, Trash2 } from 'lucide-react'
import { TimeBlockPicker } from '@/components/TimeBlockPicker'
import { fetchSettings, loginAdmin, updateSettings } from '@/lib/api'
import { APP_TITLE } from '@/lib/constants'
import { useEmbed } from '@/lib/embed'
import { cloneSchedule } from '@/lib/scheduleHelpers'
import { formatKoreanDate, todayIso } from '@/lib/format'
import { blockKey, generateCandidateBlocks } from '@/lib/timeBlocks'
import { WEEKDAY_KEYS, WEEKDAY_LABELS, isWeekendKey } from '@/lib/weekday'
import type { AppSettings, DaySchedule, Room, RoomId, TimeBlock, WeekdayKey } from '@/lib/types'

const ADMIN_KEY = 'booking-admin-auth'
const ADMIN_PASSWORD_KEY = 'booking-admin-password'

function readStoredPassword(): string {
  return sessionStorage.getItem(ADMIN_PASSWORD_KEY) ?? ''
}

function storeAdminSession(password: string) {
  sessionStorage.setItem(ADMIN_KEY, '1')
  sessionStorage.setItem(ADMIN_PASSWORD_KEY, password)
}

function clearAdminSession() {
  sessionStorage.removeItem(ADMIN_KEY)
  sessionStorage.removeItem(ADMIN_PASSWORD_KEY)
}

const WEEKDAY_TABS = WEEKDAY_KEYS.filter((k) => !isWeekendKey(k))

function mergeTimeBlocks(prev: TimeBlock[], next: TimeBlock[]): TimeBlock[] {
  const prevMap = new Map(prev.map((block) => [blockKey(block), block]))
  return next.map((block) => {
    const existing = prevMap.get(blockKey(block))
    return existing ?? { ...block, enabledRoomIds: [] }
  })
}

export function AdminPage() {
  const embed = useEmbed()
  const [password, setPassword] = useState(() => readStoredPassword())
  const [authed, setAuthed] = useState(() => {
    const ok = sessionStorage.getItem(ADMIN_KEY) === '1'
    return ok && !!readStoredPassword()
  })
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [activeWeekday, setActiveWeekday] = useState<WeekdayKey>('mon')
  const [activeTimeKey, setActiveTimeKey] = useState<string | null>(null)
  const [saveError, setSaveError] = useState('')
  const [saveLoading, setSaveLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newBlockedDate, setNewBlockedDate] = useState('')

  const activeSchedule = useMemo(
    () => (settings ? settings.weekdaySchedules[activeWeekday] : null),
    [settings, activeWeekday],
  )

  const activeBlock = useMemo(
    () => activeSchedule?.timeBlocks.find((block) => blockKey(block) === activeTimeKey) ?? null,
    [activeSchedule, activeTimeKey],
  )

  const blockedDates = settings?.blockedDates ?? []

  useEffect(() => {
    if (authed) {
      fetchSettings()
        .then(({ settings: s, rooms: r }) => {
          setSettings(s)
          setRooms(r)
        })
        .catch((e) => setSaveError(e instanceof Error ? e.message : '불러오기 실패'))
    }
  }, [authed])

  useEffect(() => {
    if (!activeSchedule) return
    if (activeTimeKey && activeSchedule.timeBlocks.some((block) => blockKey(block) === activeTimeKey)) {
      return
    }
    const first = activeSchedule.timeBlocks[0]
    setActiveTimeKey(first ? blockKey(first) : null)
  }, [activeSchedule, activeTimeKey])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)
    try {
      await loginAdmin(password)
      storeAdminSession(password)
      setAuthed(true)
      const { settings: s, rooms: r } = await fetchSettings()
      setSettings(s)
      setRooms(r)
    } catch {
      setLoginError('비밀번호가 올바르지 않습니다')
    } finally {
      setLoginLoading(false)
    }
  }

  const updateActiveSchedule = (patch: Partial<DaySchedule>) => {
    if (!settings) return
    setSaved(false)
    setSettings({
      ...settings,
      weekdaySchedules: {
        ...settings.weekdaySchedules,
        [activeWeekday]: { ...settings.weekdaySchedules[activeWeekday], ...patch },
      },
    })
  }

  const toggleRoomForActiveBlock = (id: RoomId) => {
    if (!activeBlock || !activeSchedule) return
    const enabled = new Set(activeBlock.enabledRoomIds)
    if (enabled.has(id)) enabled.delete(id)
    else enabled.add(id)
    const nextBlocks = activeSchedule.timeBlocks.map((block) =>
      blockKey(block) === activeTimeKey
        ? { ...block, enabledRoomIds: [...enabled] as RoomId[] }
        : block,
    )
    updateActiveSchedule({ timeBlocks: nextBlocks })
  }

  const addBlockedDate = () => {
    if (!settings || !newBlockedDate) return
    if (blockedDates.includes(newBlockedDate)) return
    setSaved(false)
    setSettings({
      ...settings,
      blockedDates: [...blockedDates, newBlockedDate].sort(),
    })
    setNewBlockedDate('')
  }

  const removeBlockedDate = (dateIso: string) => {
    if (!settings) return
    setSaved(false)
    setSettings({
      ...settings,
      blockedDates: blockedDates.filter((date) => date !== dateIso),
    })
  }

  const copyToOtherWeekdays = () => {
    if (!settings) return
    setSaved(false)
    const source = settings.weekdaySchedules[activeWeekday]
    const next = { ...settings.weekdaySchedules }
    for (const key of WEEKDAY_TABS) {
      if (key !== activeWeekday) next[key] = cloneSchedule(source)
    }
    setSettings({ ...settings, weekdaySchedules: next })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!settings) return

    const savePassword = password.trim() || readStoredPassword()
    if (!savePassword) {
      setSaveError('저장하려면 아래에 관리자 비밀번호를 입력해 주세요')
      return
    }

    setSaveError('')
    setSaveLoading(true)
    setSaved(false)
    try {
      const { settings: s, rooms: r } = await updateSettings(savePassword, settings)
      storeAdminSession(savePassword)
      setPassword(savePassword)
      setSettings(s)
      setRooms(r)
      setSaved(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : '저장 실패'
      if (message.includes('비밀번호')) {
        clearAdminSession()
        setAuthed(false)
        setPassword('')
      }
      setSaveError(message)
    } finally {
      setSaveLoading(false)
    }
  }

  if (embed) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm text-slate-600">
          관리자 설정은 보안을 위해 Notion 임베드가 아닌{' '}
          <strong>독립 앱(새 창)</strong>에서 이용해 주세요.
        </p>
        <a
          href="/admin"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
        >
          관리자 페이지 열기
        </a>
      </div>
    )
  }

  if (!authed) {
    return (
      <div className="mx-auto max-w-sm px-4 py-10">
        <div className="mb-6 text-center">
          <Settings className="mx-auto text-slate-400" size={32} />
          <h1 className="mt-3 text-xl font-bold text-slate-900">관리자 모드</h1>
          <p className="mt-1 text-sm text-slate-500">{APP_TITLE}</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">관리자 비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              required
            />
          </label>
          {loginError && <p className="text-sm text-red-500">{loginError}</p>}
          <button
            type="submit"
            disabled={loginLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white"
          >
            {loginLoading && <Loader2 className="animate-spin" size={16} />}
            로그인
          </button>
        </form>
      </div>
    )
  }

  if (!settings || !activeSchedule) {
    return <p className="py-10 text-center text-sm text-slate-500">설정 불러오는 중...</p>
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-1 text-2xl font-bold text-slate-900">관리자 설정</h1>
      <p className="mb-6 text-sm text-slate-500">
        요일별로 예약 시간을 선택한 뒤, 각 시간마다 예약 가능 좌석을 개별 설정합니다.
      </p>

      <form onSubmit={handleSave} className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">1. 요일 선택</h2>
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_TABS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setActiveWeekday(key)
                  setActiveTimeKey(null)
                }}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  activeWeekday === key
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {WEEKDAY_LABELS[key]}요일
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-700">
              2. {WEEKDAY_LABELS[activeWeekday]}요일 · 시간 선택
            </h2>
            <button
              type="button"
              onClick={copyToOtherWeekdays}
              className="text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              다른 평일에 복사
            </button>
          </div>
          <TimeBlockPicker
            slotMinutes={settings.slotMinutes}
            timeBlocks={activeSchedule.timeBlocks}
            onChange={(timeBlocks) =>
              updateActiveSchedule({
                timeBlocks: mergeTimeBlocks(activeSchedule.timeBlocks, timeBlocks),
              })
            }
            onSlotMinutesChange={(slotMinutes) => {
              setSaved(false)
              const candidates = generateCandidateBlocks(slotMinutes)
              const keys = new Set(candidates.map(blockKey))
              setSettings({
                ...settings,
                slotMinutes,
                weekdaySchedules: Object.fromEntries(
                  WEEKDAY_KEYS.map((key) => {
                    const schedule = settings.weekdaySchedules[key]
                    const filtered = mergeTimeBlocks(
                      schedule.timeBlocks,
                      schedule.timeBlocks.filter((b) => keys.has(blockKey(b))),
                    )
                    return [key, { timeBlocks: filtered }]
                  }),
                ) as AppSettings['weekdaySchedules'],
              })
            }}
          />
        </section>

        {activeSchedule.timeBlocks.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">
              3. {WEEKDAY_LABELS[activeWeekday]}요일 · 좌석 선택
            </h2>
            <p className="mb-3 text-xs text-slate-500">좌석을 설정할 시간을 선택하세요.</p>
            <div className="mb-4 flex flex-wrap gap-2">
              {activeSchedule.timeBlocks.map((block) => {
                const key = blockKey(block)
                const selected = activeTimeKey === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTimeKey(key)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                      selected
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    {block.start}–{block.end}
                    <span className={`ml-1 ${selected ? 'text-blue-100' : 'text-slate-400'}`}>
                      ({block.enabledRoomIds.length}석)
                    </span>
                  </button>
                )
              })}
            </div>

            {activeBlock ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-600">
                  {activeBlock.start}–{activeBlock.end} 예약 가능 좌석
                </p>
                {rooms.map((room) => (
                  <label
                    key={room.id}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-100 px-3 py-2 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={activeBlock.enabledRoomIds.includes(room.id)}
                      onChange={() => toggleRoomForActiveBlock(room.id)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{room.name}</p>
                      <p className="text-xs text-slate-500">{room.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">시간을 선택하면 좌석을 설정할 수 있습니다.</p>
            )}
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-1 text-sm font-semibold text-slate-700">예약 불가 날짜</h2>
          <p className="mb-3 text-xs text-slate-500">
            지정한 날짜는 주말·공휴일과 같이 모니터링 예약을 받지 않습니다.
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            <input
              type="date"
              value={newBlockedDate}
              min={todayIso()}
              onChange={(e) => {
                setNewBlockedDate(e.target.value)
                setSaved(false)
              }}
              className="input flex-1 min-w-[10rem]"
            />
            <button
              type="button"
              onClick={addBlockedDate}
              disabled={!newBlockedDate}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              추가
            </button>
          </div>
          {blockedDates.length === 0 ? (
            <p className="text-xs text-slate-500">등록된 예약 불가 날짜가 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {blockedDates.map((dateIso) => (
                <li
                  key={dateIso}
                  className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{formatKoreanDate(dateIso)}</p>
                    <p className="text-xs text-slate-500">{dateIso}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeBlockedDate(dateIso)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"
                    aria-label={`${dateIso} 삭제`}
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">저장용 관리자 비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setSaved(false)
              }}
              className="input"
              placeholder="로그인에 사용한 비밀번호"
              autoComplete="current-password"
            />
          </label>
          <p className="mt-1 text-xs text-slate-500">
            설정 저장 시 서버 인증에 사용됩니다. 새로고침 후에도 같은 비밀번호가 필요합니다.
          </p>
        </section>

        {saveError && <p className="text-sm text-red-500">{saveError}</p>}
        {saved && <p className="text-sm text-green-600">설정이 저장되었습니다.</p>}

        <button
          type="submit"
          disabled={saveLoading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white"
        >
          {saveLoading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          설정 저장
        </button>
      </form>
    </div>
  )
}
