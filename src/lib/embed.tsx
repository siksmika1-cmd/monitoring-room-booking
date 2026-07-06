import { createContext, useContext, useMemo } from 'react'
import { Link, useSearchParams, type LinkProps } from 'react-router-dom'
import { isEmbedMode } from './format'

const EmbedContext = createContext(false)

export function EmbedProvider({ children }: { children: React.ReactNode }) {
  const [params] = useSearchParams()
  const embed = useMemo(
    () => params.get('embed') === 'true' || isEmbedMode(),
    [params],
  )
  return <EmbedContext.Provider value={embed}>{children}</EmbedContext.Provider>
}

export function useEmbed() {
  return useContext(EmbedContext)
}

/** embed 모드일 때 ?embed=true 를 붙인 경로 */
export function embedPath(path: string, embed: boolean): string {
  if (!embed) return path
  const [base, query = ''] = path.split('?')
  const params = new URLSearchParams(query)
  params.set('embed', 'true')
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

export function AppLink({ to, ...props }: LinkProps) {
  const embed = useEmbed()
  const resolved = typeof to === 'string' ? embedPath(to, embed) : to
  return <Link to={resolved} {...props} />
}

/** Notion 임베드용 URL 생성 (배포 후 도메인 교체) */
export function buildEmbedUrl(origin: string) {
  return `${origin.replace(/\/$/, '')}/?embed=true`
}

export function buildStandaloneUrl(origin: string, path = '/') {
  return `${origin.replace(/\/$/, '')}${path}`
}
