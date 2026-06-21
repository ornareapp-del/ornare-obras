import { useState, useEffect, useMemo } from 'react'
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
    const destino = resolverDestinoNotificacao(notificacao)
    if (destino) navigate(destino)
  }

  function resolverDestinoNotificacao(notificacao) {
    if (notificacao.rota) return notificacao.rota

    const tipo = String(notificacao.entidade_tipo || notificacao.tipo || '').toLowerCase()
    const entidadeId = notificacao.entidade_id
    const obraId = notificacao.obra_id

    if (tipo.includes('agenda') || tipo.includes('compromisso') || tipo.includes('vistoria')) {
      return entidadeId ? `/agenda?compromisso=${entidadeId}` : '/agenda'
    }

    if (tipo.includes('checkin') || tipo.includes('checkout')) {
      if (notificacao.rota) return notificacao.rota
      return obraId ? `/obras/${obraId}?aba=Agenda` : '/agenda'
    }

    if (tipo.includes('foto')) {
      return obraId ? `/obras/${obraId}?aba=Fotos${entidadeId ? `&foto=${entidadeId}` : ''}` : '/obras?filtro=fotos'
    }

    if (tipo.includes('checklist')) {
      return obraId ? `/obras/${obraId}?aba=Checklist${entidadeId ? `&checklist=${entidadeId}` : ''}` : '/obras?filtro=checklist'
    }

    if (tipo.includes('ocorr')) {
      return obraId ? `/obras/${obraId}?aba=Ocorrencias${entidadeId ? `&ocorrencia=${entidadeId}` : ''}` : '/ocorrencias'
    }

    if (tipo.includes('cronograma')) {
      return obraId ? `/obras/${obraId}?aba=Cronograma${entidadeId ? `&cronograma=${entidadeId}` : ''}` : '/planejamento'
    }

    if (tipo.includes('gasto')) {
      return obraId ? `/obras/${obraId}?aba=Gastos${entidadeId ? `&gasto=${entidadeId}` : ''}` : '/gastos'
    }

    if (tipo.includes('tarefa')) {
      return entidadeId ? `/tarefas?tarefa=${entidadeId}` : '/tarefas'
    }

    if (tipo.includes('obra')) {
      return obraId || entidadeId ? `/obras/${obraId || entidadeId}` : '/obras'
    }

    return obraId ? `/obras/${obraId}` : '/'
  }

  const pendentes = notificacoes.filter(item => item.status !== 'lida')
  const temPendencias = pendentes.length > 0
  const notificacoesOrdenadas = useMemo(() => {
    const pesoPrioridade = item => item.prioridade === 'alta' ? 0 : item.prioridade === 'media' ? 1 : 2
    return [...notificacoes].sort((a, b) => {
      const unreadA = a.status !== 'lida' ? 0 : 1
      const unreadB = b.status !== 'lida' ? 0 : 1
      if (unreadA !== unreadB) return unreadA - unreadB
      const prioridade = pesoPrioridade(a) - pesoPrioridade(b)
      if (prioridade !== 0) return prioridade
      return new Date(b.created_at || 0) - new Date(a.created_at || 0)
    })
  }, [notificacoes])

  async function marcarTodasComoLidas() {
    if (pendentes.length === 0) return
    const ids = pendentes.map(item => item.id).filter(Boolean)
    const lidaEm = new Date().toISOString()
    await supabase.from('notificacoes').update({ status: 'lida', lida_em: lidaEm }).in('id', ids)
    setNotificacoes(lista => lista.map(item => ids.includes(item.id) ? { ...item, status: 'lida', lida_em: lidaEm } : item))
  }

  function corPrioridade(item) {
    if (item.prioridade === 'alta') return '#C0392B'
    if (item.prioridade === 'media') return '#E07B39'
    if (item.status !== 'lida') return '#B8965E'
    return '#D8D0C2'
  }

  function labelPrioridade(item) {
    if (item.prioridade === 'alta') return 'Ação urgente'
    if (item.prioridade === 'media') return 'Atenção'
    if (item.status !== 'lida') return 'Nova'
    return 'Lida'
  }

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
          <div style={{ position: 'fixed', top: isMobile ? 14 : 18, right: isMobile ? 14 : 22, zIndex: 36, display: 'flex', alignItems: 'center', gap: 8 }}>
            {temPendencias && !isMobile && (
              <button
                onClick={() => setNotificacoesAbertas(v => !v)}
                style={{
                  border: '1px solid rgba(192,57,43,.18)',
                  background: '#FFF5F2',
                  color: '#C0392B',
                  borderRadius: 999,
                  padding: '9px 12px',
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  boxShadow: '0 12px 28px rgba(192,57,43,.14)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {pendentes.length > 9 ? '9+' : pendentes.length} ações pendentes
              </button>
            )}
            <button
              onClick={() => setNotificacoesAbertas(v => !v)}
              style={{
                width: temPendencias ? 52 : 42,
                height: temPendencias ? 52 : 42,
                borderRadius: 999,
                border: temPendencias ? '3px solid #FFFFFF' : '1px solid rgba(184,150,94,.35)',
                background: temPendencias ? 'linear-gradient(135deg, #E07B39 0%, #C0392B 100%)' : '#fff',
                color: temPendencias ? '#fff' : '#1D1C19',
                boxShadow: temPendencias ? '0 0 0 7px rgba(192,57,43,.14), 0 18px 42px rgba(192,57,43,.36)' : '0 12px 32px rgba(29,28,25,.12)',
                cursor: 'pointer',
                position: 'relative',
                display: 'grid',
                placeItems: 'center',
                transition: 'all .22s ease',
              }}
              title="Notificações"
            >
              <IconBell active={temPendencias} />
              {temPendencias && (
                <span style={{
                  position: 'absolute',
                  top: -7,
                  right: -7,
                  minWidth: 22,
                  height: 22,
                  borderRadius: 999,
                  background: '#C0392B',
                  color: '#fff',
                  fontSize: 10.5,
                  fontWeight: 900,
                  display: 'grid',
                  placeItems: 'center',
                  border: '3px solid #fff',
                  boxShadow: '0 6px 14px rgba(192,57,43,.35)',
                }}>
                  {pendentes.length > 9 ? '9+' : pendentes.length}
                </span>
              )}
              {temPendencias && (
                <span style={{
                  position: 'absolute',
                  bottom: -5,
                  right: -3,
                  width: 19,
                  height: 19,
                  borderRadius: 999,
                  background: '#fff',
                  color: '#C0392B',
                  fontSize: 12,
                  fontWeight: 900,
                  display: 'grid',
                  placeItems: 'center',
                  lineHeight: 1,
                  border: '2px solid #C0392B',
                }}>
                  !
                </span>
              )}
            </button>

            {notificacoesAbertas && (
              <div style={{
                position: 'absolute',
                top: 50,
                right: 0,
                width: isMobile ? 'calc(100vw - 28px)' : 390,
                maxHeight: isMobile ? 'calc(100vh - 96px)' : 520,
                overflowY: 'auto',
                background: '#fff',
                border: '1px solid #E7E0D5',
                borderRadius: 20,
                boxShadow: '0 24px 80px rgba(29,28,25,.22)',
                padding: 12,
              }}>
                <div style={{ padding: '6px 6px 12px', borderBottom: '1px solid #E7E0D5', marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div>
                      <strong style={{ fontFamily: 'var(--font-serif)', fontSize: 21, color: '#1D1C19', display: 'block', lineHeight: 1 }}>Central de ações</strong>
                      <span style={{ display: 'block', marginTop: 5, color: '#6D675E', fontSize: 12.5, fontWeight: 700 }}>Pendências que precisam de atenção.</span>
                    </div>
                    <span style={{ minWidth: 34, height: 34, borderRadius: 999, display: 'grid', placeItems: 'center', background: temPendencias ? '#C0392B' : '#F4EFE7', color: temPendencias ? '#fff' : '#B8965E', fontSize: 13, fontWeight: 900, border: '2px solid #fff', boxShadow: temPendencias ? '0 8px 18px rgba(192,57,43,.22)' : 'none' }}>
                      {pendentes.length}
                    </span>
                  </div>
                  {pendentes.length > 0 && (
                    <button
                      onClick={marcarTodasComoLidas}
                      style={{ marginTop: 12, width: '100%', border: '1px solid #E7E0D5', background: '#FFFEFC', color: '#6D675E', borderRadius: 12, padding: '9px 10px', fontSize: 12, fontWeight: 900, fontFamily: 'inherit', cursor: 'pointer' }}
                    >
                      Marcar todas como lidas
                    </button>
                  )}
                </div>
                {notificacoes.length === 0 ? (
                  <div style={{ padding: 28, textAlign: 'center', color: '#6D675E', fontSize: 13, lineHeight: 1.5 }}>Nenhuma ação pendente agora.</div>
                ) : (
                  notificacoesOrdenadas.map(item => (
                    <button
                      key={item.id}
                      onClick={() => abrirNotificacao(item)}
                      style={{
                        width: '100%',
                        border: '1px solid #E7E0D5',
                        borderLeft: `5px solid ${corPrioridade(item)}`,
                        background: item.status !== 'lida' ? '#FFFCF7' : '#fff',
                        borderRadius: 14,
                        padding: 13,
                        marginBottom: 9,
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        boxShadow: item.status !== 'lida' ? '0 10px 22px rgba(184,150,94,.08)' : 'none',
                      }}
                    >
                      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ color: corPrioridade(item), fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 900 }}>{item.tipo || 'ação'}</span>
                        <span style={{ borderRadius: 999, background: `${corPrioridade(item)}18`, color: corPrioridade(item), padding: '4px 7px', fontSize: 10, fontWeight: 900, whiteSpace: 'nowrap' }}>{labelPrioridade(item)}</span>
                      </span>
                      <strong style={{ display: 'block', color: '#1D1C19', fontSize: 13.5, lineHeight: 1.25 }}>{item.titulo}</strong>
                      {item.descricao && <small style={{ display: 'block', color: '#6D675E', fontSize: 12, lineHeight: 1.35, marginTop: 4 }}>{item.descricao}</small>}
                      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginTop: 10 }}>
                        <small style={{ display: 'block', color: '#9E9E9E', fontSize: 11 }}>
                          {item.created_at ? new Date(item.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                        </small>
                        <small style={{ color: '#B8965E', fontSize: 11, fontWeight: 900 }}>Abrir →</small>
                      </span>
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

function IconBell({ active = false }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#FFFFFF' : '#B8965E'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}
