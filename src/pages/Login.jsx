import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setErro('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) setErro('E-mail ou senha incorretos.')
    setLoading(false)
  }

  return (
    <div style={s.bg}>
      <div style={s.box}>
        <div style={s.logo}>Ornare</div>
        <div style={s.slogan}>Gestão Premium de Obras</div>
        {erro && <div style={s.erro}>{erro}</div>}
        <form onSubmit={handleLogin}>
          <label style={s.label}>E-mail</label>
          <input style={s.input} type="email" value={email}
            onChange={e => setEmail(e.target.value)} required />
          <label style={s.label}>Senha</label>
          <input style={s.input} type="password" value={senha}
            onChange={e => setSenha(e.target.value)} required />
          <button style={s.btn} disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

const s = {
  bg: { minHeight:'100vh', background:'#2C2B28', display:'flex', alignItems:'center', justifyContent:'center' },
  box: { background:'#FDFCFA', borderRadius:14, padding:'48px 44px', width:360, maxWidth:'90vw' },
  logo: { fontFamily:'Georgia,serif', fontSize:28, letterSpacing:6, color:'#2C2B28', textTransform:'uppercase', marginBottom:4 },
  slogan: { fontSize:11, color:'#9C9A94', letterSpacing:2, textTransform:'uppercase', marginBottom:36 },
  label: { display:'block', fontSize:11, letterSpacing:1.5, textTransform:'uppercase', color:'#5C5A54', marginBottom:6, marginTop:18 },
  input: { width:'100%', border:'1px solid #E8E3D8', borderRadius:6, padding:'10px 12px', fontSize:14, color:'#2C2B28', background:'#fff', outline:'none', boxSizing:'border-box' },
  btn: { background:'#2C2B28', color:'#FDFCFA', border:'none', borderRadius:6, padding:'12px 24px', fontSize:13, letterSpacing:1, cursor:'pointer', width:'100%', marginTop:24, textTransform:'uppercase' },
  erro: { background:'#FCEEE9', borderLeft:'3px solid #C4421E', color:'#5C2010', padding:'10px 14px', borderRadius:6, fontSize:12, marginBottom:12 },
}