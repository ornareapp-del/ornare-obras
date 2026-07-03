import { supabase } from '../lib/supabase'

const SENSITIVE_KEYS = ['password', 'senha', 'token', 'access_token', 'refresh_token', 'authorization', 'file', 'arquivo']

function sanitizeValue(value) {
  if (value == null) return value
  if (value instanceof Error) return sanitizeError(value)
  if (typeof value === 'string') return value.length > 180 ? `${value.slice(0, 180)}...` : value
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.slice(0, 20).map(sanitizeValue)
  if (typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, item]) => {
      const normalized = key.toLowerCase()
      acc[key] = SENSITIVE_KEYS.some(sensitive => normalized.includes(sensitive)) ? '[redacted]' : sanitizeValue(item)
      return acc
    }, {})
  }
  return String(value)
}

function sanitizeError(error) {
  return {
    message: error?.message || String(error || 'Erro desconhecido'),
    code: error?.code || null,
    details: error?.details ? sanitizeValue(error.details) : null,
    hint: error?.hint ? sanitizeValue(error.hint) : null,
  }
}

export async function logError(evento, error, contexto = {}) {
  const payload = {
    evento,
    nivel: 'error',
    mensagem: error?.message || String(error || 'Erro desconhecido'),
    codigo: error?.code || null,
    contexto: sanitizeValue(contexto),
    erro: sanitizeError(error),
    url: typeof window !== 'undefined' ? window.location.pathname : null,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  }

  try {
    const { error: insertError } = await supabase.from('app_logs').insert([payload])
    if (insertError) throw insertError
  } catch (loggingError) {
    console.error('Falha ao registrar app_logs:', loggingError, payload)
  }
}
