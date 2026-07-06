// @ts-nocheck — dev-only middleware; dynamic import of Vercel handlers
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin, ViteDevServer } from 'vite'
import { loadEnv } from 'vite'

let devServer: ViteDevServer | undefined

const API_ROUTES: Record<string, string> = {
  '/api/bookings': '/api/bookings.ts',
  '/api/settings': '/api/settings.ts',
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, body: object) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.end(JSON.stringify(body))
}

async function handleApi(
  req: IncomingMessage,
  res: ServerResponse,
  modulePath: string,
) {
  const mod = await devServer!.ssrLoadModule(modulePath)
  const handler = mod.default
  const url = new URL(req.url ?? '/', 'http://localhost')
  const query = Object.fromEntries(url.searchParams.entries())

  const vercelReq = {
    method: req.method,
    query,
    body:
      req.method === 'POST' || req.method === 'PUT'
        ? await readJsonBody(req)
        : undefined,
  }

  const vercelRes = {
    statusCode: 200,
    setHeader() {},
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(body: object) {
      sendJson(res, this.statusCode, body)
    },
    end() {
      res.end()
    },
  }

  await handler(
    vercelReq as Parameters<typeof handler>[0],
    vercelRes as Parameters<typeof handler>[1],
  )
}

export function bookingsDevApi(): Plugin {
  return {
    name: 'bookings-dev-api',
    configureServer(server) {
      devServer = server
      const env = loadEnv(server.config.mode, server.config.root, '')
      for (const [key, value] of Object.entries(env)) {
        if (value) process.env[key] = value
      }

      server.middlewares.use(async (req, res, next) => {
        const urlPath = req.url?.split('?')[0]
        const modulePath = urlPath ? API_ROUTES[urlPath] : undefined

        if (!modulePath) {
          next()
          return
        }

        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
          res.end()
          return
        }

        try {
          await handleApi(req, res, modulePath)
        } catch (e) {
          const message = e instanceof Error ? e.message : '서버 오류'
          sendJson(res, 500, { error: message })
        }
      })
    },
  }
}
