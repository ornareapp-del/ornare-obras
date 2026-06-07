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
    <div style={{
      minHeight: '100vh', background: '#1a1814',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-sans)', padding: 20,
    }}>
      <div style={{
        background: '#f5f2ee', borderRadius: 20,
        padding: '48px 44px', width: '100%', maxWidth: 420,
        boxShadow: '0 32px 80px rgba(0,0,0,0.4)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 600, letterSpacing: 6, color: '#1a1814' }}>
            ORNARE
          </div>
          <div style={{ fontSize: 9, letterSpacing: 4, color: '#b09a7a', marginTop: 4 }}>
            {modo === 'login' ? 'GESTÃO DE OBRAS' : 'RECUPERAÇÃO DE ACESSO'}
          </div>
        </div>

        {modo === 'confirmado' ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>✉️</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1814', marginBottom: 8 }}>E-mail enviado</div>
            <div style={{ fontSize: 13, color: '#888', lineHeight: 1.6, marginBottom: 24 }}>
              Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
            </div>
            <button onClick={() => setModo('login')} style={{ background: 'none', border: 'none', fontSize: 13, color: '#b09a7a', cursor: 'pointer', textDecoration: 'underline' }}>
              Voltar ao login
            </button>
          </div>
        ) : (
          <form onSubmit={modo === 'login' ? handleLogin : handleRecuperar}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: '#888', marginBottom: 6, textTransform: 'uppercase' }}>E-mail</div>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required autoComplete="email"
                style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1.5px solid #e0dbd3', fontSize: 14, fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            {modo === 'login' && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: '#888', marginBottom: 6, textTransform: 'uppercase' }}>Senha</div>
                <input
                  type="password" value={senha} onChange={e => setSenha(e.target.value)}
                  required autoComplete="current-password"
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1.5px solid #e0dbd3', fontSize: 14, fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>
            )}

            {erro && (
              <div style={{ fontSize: 12, color: '#d94a4a', marginBottom: 12, padding: '8px 12px', background: '#fdecea', borderRadius: 8 }}>
                {erro}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              style={{
                width: '100%', padding: '14px', borderRadius: 10,
                background: loading ? '#888' : '#1a1814',
                color: '#f5f2ee', border: 'none', fontSize: 12,
                fontWeight: 600, letterSpacing: 2, cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: 8, textTransform: 'uppercase',
              }}
            >
              {loading ? 'Aguarde...' : modo === 'login' ? 'Entrar' : 'Enviar link de recuperação'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 20 }}>
              {modo === 'login' ? (
                <button type="button" onClick={() => { setModo('recuperar'); setErro('') }} style={{ background: 'none', border: 'none', fontSize: 12, color: '#b09a7a', cursor: 'pointer' }}>
                  Esqueci minha senha
                </button>
              ) : (
                <button type="button" onClick={() => { setModo('login'); setErro('') }} style={{ background: 'none', border: 'none', fontSize: 12, color: '#888', cursor: 'pointer' }}>
                  ← Voltar ao login
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      <div style={{ position: 'fixed', bottom: 20, fontSize: 10, color: '#555', letterSpacing: 2 }}>
        ORNARE WORKS · GESTÃO PREMIUM DE OBRAS
      </div>
    </div>
  )
}