import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ROOMS } from '../server/rooms.js'
import { getSettings, updateSettings, verifyAdminPassword } from '../server/settingsStore.js'
import type { AppSettings } from '../server/types.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    if (req.method === 'GET') {
      const settings = getSettings()
      return res.status(200).json({ settings, rooms: ROOMS })
    }

    if (req.method === 'PUT') {
      const body = req.body as { password?: string; settings?: Partial<AppSettings> }
      if (!body.password || !verifyAdminPassword(body.password)) {
        return res.status(401).json({ error: '관리자 비밀번호가 올바르지 않습니다' })
      }
      if (!body.settings) {
        return res.status(400).json({ error: 'settings 필요' })
      }

      const settings = updateSettings(body.settings)
      return res.status(200).json({ settings, rooms: ROOMS })
    }

    if (req.method === 'POST') {
      const body = req.body as { action?: string; password?: string }
      if (body.action === 'login') {
        if (!body.password || !verifyAdminPassword(body.password)) {
          return res.status(401).json({ error: '관리자 비밀번호가 올바르지 않습니다' })
        }
        return res.status(200).json({ ok: true })
      }
      return res.status(400).json({ error: '알 수 없는 action' })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    const message = e instanceof Error ? e.message : '서버 오류'
    return res.status(500).json({ error: message })
  }
}
