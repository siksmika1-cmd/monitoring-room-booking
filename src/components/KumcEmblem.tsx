const EMBLEM_SRC = '/kumc-emblem.png'

export function KumcEmblem({ className }: { className?: string }) {
  return (
    <img
      src={EMBLEM_SRC}
      alt="고려대학교의료원"
      className={`object-contain ${className ?? ''}`}
      width={32}
      height={36}
      decoding="async"
    />
  )
}
