const DEFAULT_LIMIT = 30

export function createLocalQueue(storageKey, limit = DEFAULT_LIMIT) {
  function read() {
    if (typeof localStorage === 'undefined') return []
    try {
      const data = JSON.parse(localStorage.getItem(storageKey) || '[]')
      return Array.isArray(data) ? data : []
    } catch {
      return []
    }
  }

  function write(items) {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(storageKey, JSON.stringify((items || []).slice(-limit)))
  }

  return {
    read,
    clear() {
      write([])
      return []
    },
    add(action) {
      const record = {
        ...action,
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        criado_em: new Date().toISOString(),
        estado: 'nao_enviada',
      }
      const next = [...read(), record]
      write(next)
      return next
    },
  }
}
