import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [modo, setModo] = useState('login') // login | recuperar | confirmado

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setErro('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) setErro('E-mail ou senha incorretos.')
    setLoading(false)
  }

  async function handleRecuperar(e) {
    e.preventDefault()
    setLoading(true)
    setErro('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })
    if (error) setErro('Erro ao enviar e-mail. Verifique o endereço.')
    else setModo('confirmado')
    setLoading(false)
  }

  return (
    <div className="ow-login" style={{
      minHeight: '100vh', background: '#1D1C19',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-sans)', padding: 20,
    }}>
      <div style={{
        background: 'var(--color-bg)', borderRadius: 20,
        padding: '48px 44px', width: '100%', maxWidth: 420,
        boxShadow: 'var(--shadow-lg)',
        border: '1px solid rgba(184,150,94,0.14)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 600, letterSpacing: 6, color: 'var(--color-ink)' }}>
            ORNARE
          </div>
          <div style={{ fontSize: 9, letterSpacing: 4, color: 'var(--color-gold)', marginTop: 4 }}>
            {modo === 'login' ? 'GESTÃO DE OBRAS' : 'RECUPERAÇÃO DE ACESSO'}
          </div>
        </div>

        {modo === 'confirmado' ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 16, color: 'var(--color-gold)' }}>✉</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-ink)', marginBottom: 8 }}>E-mail enviado</div>
            <div style={{ fontSize: 13, color: 'var(--color-ink-muted)', lineHeight: 1.6, marginBottom: 24 }}>
              Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
            </div>
            <button onClick={() => setModo('login')} style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--color-gold)', cursor: 'pointer', textDecoration: 'underline' }}>
              Voltar ao login
            </button>
          </div>
        ) : (
          <form onSubmit={modo === 'login' ? handleLogin : handleRecuperar}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--color-ink-muted)', marginBottom: 6, textTransform: 'uppercase' }}>E-mail</div>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required autoComplete="email"
                style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1.5px solid var(--color-border)', fontSize: 14, fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            {modo === 'login' && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--color-ink-muted)', marginBottom: 6, textTransform: 'uppercase' }}>Senha</div>
                <input
                  type="password" value={senha} onChange={e => setSenha(e.target.value)}
                  required autoComplete="current-password"
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1.5px solid var(--color-border)', fontSize: 14, fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>
            )}

            {erro && (
              <div style={{ fontSize: 12, color: 'var(--color-danger)', marginBottom: 12, padding: '8px 12px', background: '#fdecea', borderRadius: 8 }}>
                {erro}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              style={{
                width: '100%', padding: '14px', borderRadius: 10,
                background: loading ? '#888' : 'var(--color-ink)',
                color: '#f5f2ee', border: 'none', fontSize: 12,
                fontWeight: 700, letterSpacing: 2, cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: 8, textTransform: 'uppercase',
              }}
            >
              {loading ? 'Aguarde...' : modo === 'login' ? 'Entrar' : 'Enviar link de recuperação'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 20 }}>
              {modo === 'login' ? (
                <button type="button" onClick={() => { setModo('recuperar'); setErro('') }} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--color-gold)', cursor: 'pointer' }}>
                  Esqueci minha senha
                </button>
              ) : (
                <button type="button" onClick={() => { setModo('login'); setErro('') }} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--color-ink-muted)', cursor: 'pointer' }}>
                  ← Voltar ao login
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      <div style={{ position: 'fixed', bottom: 20, fontSize: 10, color: 'rgba(246,243,238,0.42)', letterSpacing: 2 }}>
        ORNARE WORKS · GESTÃO PREMIUM DE OBRAS
      </div>

      <style>{`
        @media (max-width: 420px) {
          .ow-login { padding: 14px !important; align-items: stretch !important; }
          .ow-login > div:first-of-type { padding: 34px 22px !important; border-radius: 16px !important; }
          .ow-login input, .ow-login button { min-height: 44px; }
          .ow-login > div:last-of-type { position: static !important; margin-top: 18px; text-align: center; }
        }
      `}</style>
    </div>
  )
}
