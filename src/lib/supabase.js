import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

const missingEnvVars = [
  ['VITE_SUPABASE_URL', supabaseUrl],
  ['VITE_SUPABASE_ANON_KEY', supabaseKey],
].filter(([, value]) => !value).map(([name]) => name)

export const supabaseConfigError = missingEnvVars.length
  ? new Error(`Configuração Supabase incompleta. Variáveis ausentes: ${missingEnvVars.join(', ')}.`)
  : null

if (supabaseConfigError) {
  console.error(supabaseConfigError.message)
}

export const supabase = createClient(
  supabaseUrl || 'https://configuracao-ausente.supabase.co',
  supabaseKey || 'configuracao-ausente'
)
