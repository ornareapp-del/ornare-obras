import { useState } from 'react'
import { supabase } from '../lib/supabase'
import bgImage from '../assets/ornare-milao-40-anos.jpg'

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
    <div className="ow-login">
      <style>{css}</style>
      <img className="ow-login-bg" src={bgImage} alt="" />
      <div className="ow-login-shade" />

      <section className="ow-login-shell">
        <div className="ow-login-brand">
          <div className="ow-login-logo">
            <img src="/logo-ornare.png" alt="Ornare" />
            <span>Works</span>
          </div>
          <div className="ow-login-copy">
            <h1>Gestão Operacional
Ornare</h1>
            <p>Operação, montagem, assistência e acompanhamento em uma central corporativa Ornare.</p>
          </div>
          <div className="ow-login-points" aria-label="Resumo do sistema">
            <strong>Obras</strong>
            <strong>Equipe</strong>
            <strong>Cliente</strong>
          </div>
        </div>

        {modo === 'confirmado' ? (
          <div className="ow-login-card success">
            <div className="ow-login-mark">OK</div>
            <strong>E-mail enviado</strong>
            <p>
              Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
            </p>
            <button className="ow-login-link" onClick={() => setModo('login')}>
              Voltar ao login
            </button>
          </div>
        ) : (
          <form className="ow-login-card" onSubmit={modo === 'login' ? handleLogin : handleRecuperar}>
            <div className="ow-login-head">
              <span>{modo === 'login' ? 'Acesso seguro' : 'Recuperação de acesso'}</span>
              <h2>{modo === 'login' ? 'Entrar no Ornare Works' : 'Redefinir senha'}</h2>
              <p>{modo === 'login' ? 'Use seu e-mail e senha para continuar.' : 'Informe seu e-mail para receber o link de recuperação.'}</p>
            </div>

            <label className="ow-field">
              <span>E-mail</span>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required autoComplete="email"
              />
            </label>

            {modo === 'login' && (
              <label className="ow-field">
                <span>Senha</span>
                <input
                  type="password" value={senha} onChange={e => setSenha(e.target.value)}
                  required autoComplete="current-password"
                />
              </label>
            )}

            {erro && (
              <div className="ow-login-error">
                {erro}
              </div>
            )}

            <button
              className="ow-login-submit"
              type="submit" disabled={loading}
            >
              {loading ? 'Aguarde...' : modo === 'login' ? 'Entrar' : 'Enviar link de recuperação'}
            </button>

            <div className="ow-login-alt">
              {modo === 'login' ? (
                <button type="button" onClick={() => { setModo('recuperar'); setErro('') }}>
                  Esqueci minha senha
                </button>
              ) : (
                <button type="button" onClick={() => { setModo('login'); setErro('') }}>
                  Voltar ao login
                </button>
              )}
            </div>
          </form>
        )}
      </section>
    </div>
  )
}

const css = `
.ow-login{position:relative;min-height:100vh;background:#11100E;color:#F8F5EF;display:flex;align-items:center;justify-content:center;font-family:var(--font-sans);padding:0 64px;overflow:hidden}
.ow-login-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:grayscale(1) brightness(.36) contrast(1.18);transform:scale(1.02)}
.ow-login-shade{position:absolute;inset:0;background:radial-gradient(circle at 78% 30%,rgba(201,169,110,.12),transparent 30%),linear-gradient(90deg,rgba(15,14,12,.96),rgba(15,14,12,.84) 48%,rgba(15,14,12,.64));box-shadow:inset 0 0 0 1px rgba(255,255,255,.03)}
.ow-login-shell{position:relative;z-index:1;width:min(1080px,100%);margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:72px;align-items:center;min-height:100vh;padding:60px 0}
.ow-login-brand{display:flex;flex-direction:column;justify-content:center;align-items:flex-start}
.ow-login-logo{display:flex;flex-direction:column;align-items:flex-start;margin-bottom:40px}
.ow-login-logo img{width:172px;filter:brightness(0) invert(1);opacity:.96}
.ow-login-logo span{display:block;margin-top:5px;color:var(--color-gold);font-size:10px;letter-spacing:5px;text-transform:uppercase;font-weight:900;text-align:left}
.ow-login-copy{position:relative;padding-left:22px;border-left:2px solid rgba(201,169,110,.72)}
.ow-login-brand h1{font-family:var(--font-serif);font-size:56px;line-height:.96;font-weight:500;margin:0 0 16px;max-width:590px;color:#fff;text-shadow:0 24px 58px rgba(0,0,0,.66)}
.ow-login-brand p{max-width:470px;margin:0;color:rgba(248,245,239,.88);font-size:16px;line-height:1.65;font-weight:600;text-shadow:0 18px 38px rgba(0,0,0,.46)}
.ow-login-points{display:flex;gap:10px;margin-top:28px;padding-left:22px}
.ow-login-points strong{border:1px solid rgba(201,169,110,.38);background:rgba(255,255,255,.06);color:#F8F5EF;border-radius:999px;padding:8px 12px;font-size:11px;font-weight:900;letter-spacing:.5px;backdrop-filter:blur(8px);cursor:default;user-select:none}
.ow-login-card{background:rgba(255,254,252,.97);border:1px solid rgba(231,224,213,.88);border-top:3px solid var(--color-gold);border-radius:24px;padding:36px;box-shadow:0 40px 100px rgba(0,0,0,.42);backdrop-filter:blur(24px);color:var(--color-ink);align-self:center}
.ow-login-card.success{text-align:center}
.ow-login-mark{width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;background:#F1E6D3;color:var(--color-gold);font-size:13px;font-weight:900}
.ow-login-card.success strong{display:block;font-size:18px;margin-bottom:8px}
.ow-login-card.success p{margin:0 0 20px;color:var(--color-ink-muted);font-size:13px;line-height:1.55}
.ow-login-head{margin-bottom:22px}
.ow-login-head span{display:block;color:var(--color-gold);font-size:10px;letter-spacing:2.2px;text-transform:uppercase;font-weight:900;margin-bottom:9px}
.ow-login-head h2{font-family:var(--font-serif);font-size:32px;line-height:1.03;font-weight:500;margin:0;color:var(--color-ink)}
.ow-login-head p{margin:8px 0 0;color:var(--color-ink-muted);font-size:13px;line-height:1.45}
.ow-field{display:block;margin-bottom:14px}
.ow-field span{display:block;font-size:10px;letter-spacing:1.7px;color:var(--color-ink-muted);margin-bottom:7px;text-transform:uppercase;font-weight:900}
.ow-field input{width:100%;min-height:50px;padding:12px 14px;border-radius:14px;border:1.5px solid var(--color-border);font-size:15px;font-family:inherit;background:#fff;box-sizing:border-box;outline:none;color:var(--color-ink);transition:border-color .15s,box-shadow .15s}
.ow-field input:focus{border-color:var(--color-gold);box-shadow:0 0 0 3px rgba(184,150,94,.14)}
.ow-login-error{font-size:12px;color:var(--color-danger);margin:2px 0 12px;padding:10px 12px;background:#fdecea;border-radius:12px;border-left:3px solid var(--color-danger)}
.ow-login-submit{width:100%;min-height:52px;border-radius:14px;background:var(--color-ink);color:#F8F5EF;border:0;font-size:12px;font-weight:900;letter-spacing:1.6px;cursor:pointer;margin-top:4px;text-transform:uppercase;font-family:inherit;box-shadow:0 14px 32px rgba(23,21,18,.18);transition:background .18s,box-shadow .18s}
.ow-login-submit:hover:not(:disabled){background:var(--color-gold);box-shadow:0 16px 36px rgba(184,150,94,.32)}
.ow-login-submit:disabled{background:#8A8175;cursor:not-allowed}
.ow-login-alt{text-align:center;margin-top:18px}
.ow-login-alt button,.ow-login-link{background:transparent;border:0;color:var(--color-gold);font-size:12px;font-weight:800;cursor:pointer;font-family:inherit}
@media (max-width:760px){
  .ow-login{align-items:flex-end;padding:0;min-height:100svh}
  .ow-login-shade{background:linear-gradient(180deg,rgba(15,14,12,.58),rgba(15,14,12,.78) 42%,rgba(15,14,12,.96))}
  .ow-login-shell{display:flex;flex-direction:column;gap:18px;align-items:stretch;justify-content:flex-end;min-height:100svh;padding:18px 20px 24px}
  .ow-login-brand{min-height:auto}
  .ow-login-logo{margin-bottom:22px}
  .ow-login-logo img{width:126px}
  .ow-login-logo span{font-size:8px;letter-spacing:3.2px;margin-top:4px}
  .ow-login-copy{padding-left:16px}
  .ow-login-brand h1{font-size:34px;margin:0 0 10px;max-width:320px}
  .ow-login-brand p{font-size:12.5px;line-height:1.45;max-width:315px}
  .ow-login-points{padding-left:16px;margin-top:16px;gap:7px}
  .ow-login-points strong{font-size:10px;padding:7px 10px}
  .ow-login-card{border-radius:22px;padding:22px;box-shadow:0 22px 60px rgba(0,0,0,.26)}
  .ow-login-head h2{font-size:26px}
  .ow-login-head p{font-size:12.5px}
}
@media (max-width:360px){
  .ow-login-brand h1{font-size:30px}
  .ow-login-card{padding:18px}
}
`





