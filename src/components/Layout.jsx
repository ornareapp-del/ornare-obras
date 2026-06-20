import { useState, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import BottomNavigation from './BottomNavigation'
import Sidebar from './Sidebar'
import { supabase } from '../lib/supabase'
import { useStore } from '../store/useStore'

export default function Layout() {
  const navigate = useNavigate()
  const { user } = useStore()
  const [collapsed, setCollapsed] = useState(false)
  const [isMobile, setIsMobile]   = useState(false)
  const [notificacoes, setNotificacoes] = useState([])
  const [notificacoesAbertas, setNotificacoesAbertas] = useState(false)

  useEffect(() => {
    function check() {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      setCollapsed(mobile)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (!user?.id) return

    let ativo = true
    async function carregarNotificacoes() {
      const { data } = await supabase
        .from('notificacoes')
        .select('*')
        .eq('usuario_id', user.id)
        .order('created_at', { ascending: false })
        .limit(12)

      if (ativo) setNotificacoes(data || [])
    }

    carregarNotificacoes()
    const timer = window.setInterval(carregarNotificacoes, 45000)
    return () => {
      ativo = false
      window.clearInterval(timer)
    }
  }, [user?.id])

  async function abrirNotificacao(notificacao) {
    if (!notificacao) return
    if (notificacao.status !== 'lida') {
      const lidaEm = new Date().toISOString()
      await supabase.from('notificacoes').update({ status: 'lida', lida_em: lidaEm }).eq('id', notificacao.id)
      setNotificacoes(lista => lista.map(item => item.id === notificacao.id ? { ...item, status: 'lida', lida_em: lidaEm } : item))
    }
    setNotificacoesAbertas(false)
    if (notificacao.rota) navigate(notificacao.rota)
  }

  const pendentes = notificacoes.filter(item => item.status !== 'lida')

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--color-bg, #F5F2EE)' }}>

      {/* overlay mobile */}
      {isMobile && !collapsed && (
        <div
          onClick={() => setCollapsed(true)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(26,24,20,0.55)',
            zIndex: 40, backdropFilter: 'blur(2px)',
          }}
        />
      )}

      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} isMobile={isMobile} />

      <main className="ow-app-main" style={{ flex: 1, overflowY: 'auto', transition: 'all 0.25s', background: 'var(--color-bg, #F5F2EE)' }}>

        {user?.id && (
          <div style={{ position: 'fixed', top: isMobile ? 14 : 18, right: isMobile ? 14 : 22, zIndex: 36 }}>
            <button
              onClick={() => setNotificacoesAbertas(v => !v)}
              style={{
                width: 42,
                height: 42,
                borderRadius: 999,
                border: '1px solid rgba(184,150,94,.35)',
                background: '#fff',
                color: '#1D1C19',
                boxShadow: '0 12px 32px rgba(29,28,25,.12)',
                cursor: 'pointer',
                position: 'relative',
                display: 'grid',
                placeItems: 'center',
              }}
              title="Notificações"
            >
              <IconBell />
              {pendentes.length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: -3,
                  right: -3,
                  minWidth: 18,
                  height: 18,
                  borderRadius: 999,
                  background: '#C0392B',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 900,
                  display: 'grid',
                  placeItems: 'center',
                  border: '2px solid #fff',
                }}>
                  {pendentes.length > 9 ? '9+' : pendentes.length}
                </span>
              )}
            </button>

            {notificacoesAbertas && (
              <div style={{
                position: 'absolute',
                top: 50,
                right: 0,
                width: isMobile ? 'calc(100vw - 28px)' : 360,
                maxHeight: 460,
                overflowY: 'auto',
                background: '#fff',
                border: '1px solid #E7E0D5',
                borderRadius: 18,
                boxShadow: '0 24px 80px rgba(29,28,25,.22)',
                padding: 12,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 4px 10px' }}>
                  <strong style={{ fontFamily: 'var(--font-serif)', fontSize: 19, color: '#1D1C19' }}>Notificações</strong>
                  <span style={{ color: '#B8965E', fontSize: 12, fontWeight: 900 }}>{pendentes.length} pendentes</span>
                </div>
                {notificacoes.length === 0 ? (
                  <div style={{ padding: 22, textAlign: 'center', color: '#6D675E', fontSize: 13 }}>Nenhuma notificação pendente.</div>
                ) : (
                  notificacoes.map(item => (
                    <button
                      key={item.id}
                      onClick={() => abrirNotificacao(item)}
                      style={{
                        width: '100%',
                        border: '1px solid #E7E0D5',
                        borderLeft: `4px solid ${item.prioridade === 'alta' ? '#C0392B' : item.status !== 'lida' ? '#B8965E' : '#D8D0C2'}`,
                        background: item.status !== 'lida' ? '#FFFCF7' : '#fff',
                        borderRadius: 12,
                        padding: 12,
                        marginBottom: 8,
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      <span style={{ display: 'block', color: '#B8965E', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 900, marginBottom: 5 }}>{item.tipo}</span>
                      <strong style={{ display: 'block', color: '#1D1C19', fontSize: 13.5, lineHeight: 1.25 }}>{item.titulo}</strong>
                      {item.descricao && <small style={{ display: 'block', color: '#6D675E', fontSize: 12, lineHeight: 1.35, marginTop: 4 }}>{item.descricao}</small>}
                      <small style={{ display: 'block', color: '#9E9E9E', fontSize: 11, marginTop: 8 }}>
                        {item.created_at ? new Date(item.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                      </small>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* botao hamburguer mobile — nova identidade */}
        {isMobile && collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="ow-mobile-menu-fallback"
            style={{
              position: 'fixed', top: 14, left: 14, zIndex: 30,
              background: '#1A1A18',
              border: '1px solid rgba(200,168,106,0.25)',
              borderRadius: 10, padding: '8px 12px',
              cursor: 'pointer',
              boxShadow: '0 2px 16px rgba(0,0,0,0.25)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <IconMenu />
            <span style={{
              fontSize: 10,
              fontFamily: 'var(--font-serif, serif)',
              letterSpacing: 3,
              color: '#C8A86A',
              fontWeight: 600,
            }}>
              ORNARE
            </span>
          </button>
        )}

        <Outlet />
        {isMobile && collapsed && <BottomNavigation onMore={() => setCollapsed(false)} />}
      </main>
    </div>
  )
}

function IconMenu() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C8A86A" strokeWidth="2.5">
      <line x1="3" y1="6"  x2="21" y2="6"  />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

function IconBell() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B8965E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}
