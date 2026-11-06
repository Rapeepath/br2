// node:path (POSIX) for the in-browser POS: just what server/store.ts and server/catalog.ts call.
export const sep = '/'

export const isAbsolute = (path: string): boolean => path.startsWith('/')

export function join(...parts: string[]): string {
  const out: string[] = []
  for (const part of parts.join('/').split('/')) {
    if (part === '..') out.pop()
    else if (part && part !== '.') out.push(part)
  }
  return `${parts[0]?.startsWith('/') ? '/' : ''}${out.join('/')}` || '.'
}

export function dirname(path: string): string {
  const trimmed = path.replace(/\/+$/, '')
  const i = trimmed.lastIndexOf('/')
  return i < 0 ? '.' : i === 0 ? '/' : trimmed.slice(0, i)
}
