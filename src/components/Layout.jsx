import { useState, useEffect, useMemo } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import BottomNavigation from './BottomNavigation'
import Sidebar from './Sidebar'
import { supabase } from '../lib/supabase'
import { useStore } from '../store/useStore'
import { theme } from '../constants/theme'

const L = theme.app
const S = theme.status

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
      const { error } = await supabase.from('notificacoes').update({ status: 'lida', lida_em: lidaEm }).eq('id', notificacao.id)
      if (error) {
        console.error('Erro ao marcar notificação como lida:', error)
        return
      }
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
    const { error } = await supabase.from('notificacoes').update({ status: 'lida', lida_em: lidaEm }).in('id', ids)
    if (error) {
      console.error('Erro ao marcar notificações como lidas:', error)
      return
    }
    setNotificacoes(lista => lista.map(item => ids.includes(item.id) ? { ...item, status: 'lida', lida_em: lidaEm } : item))
  }

  function corPrioridade(item) {
    if (item.prioridade === 'alta') return S.dangerDeep
    if (item.prioridade === 'media') return S.warningDeep
    if (item.status !== 'lida') return S.goldMuted
    return S.read
  }

  function labelPrioridade(item) {
    if (item.prioridade === 'alta') return 'Ação urgente'
    if (item.prioridade === 'media') return 'Atenção'
    if (item.status !== 'lida') return 'Nova'
    return 'Lida'
  }

  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: theme.background }}>

      {/* overlay mobile */}
      {isMobile && !collapsed && (
        <div
          onClick={() => setCollapsed(true)}
          style={{
            position: 'fixed', inset: 0,
            background: theme.overlay.scrim,
            zIndex: 40, backdropFilter: 'blur(2px)',
          }}
        />
      )}

      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} isMobile={isMobile} />

      <main className="ow-app-main" style={{ flex: '1 1 auto', minWidth: 0, width: '100%', overflowY: 'auto', overflowX: 'hidden', transition: 'all 0.25s', background: theme.background, paddingTop: user?.id ? 60 : 0, boxSizing: 'border-box' }}>

        {user?.id && (
          <div style={{ position: 'fixed', top: 0, right: 0, left: isMobile ? 0 : (collapsed ? 56 : 224), height: 60, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 24px', gap: 12, background: theme.background, borderBottom: '1px solid ' + theme.border, pointerEvents: 'none', boxSizing: 'border-box' }}>
            {temPendencias && !isMobile && (
              <button
                onClick={() => setNotificacoesAbertas(v => !v)}
                style={{
                  border: '1px solid ' + S.goldMuted,
                  background: L.surfaceWarm,
                  color: S.goldMuted,
                  borderRadius: 999,
                  padding: '9px 12px',
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  boxShadow: L.shadowSoft,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  pointerEvents: 'auto',
                }}
              >
                {pendentes.length > 9 ? '9+' : pendentes.length} AÇÕES PENDENTES
              </button>
            )}
            <button
              onClick={() => setNotificacoesAbertas(v => !v)}
              style={{
                minWidth: temPendencias ? 58 : 42,
                height: 42,
                borderRadius: 999,
                border: temPendencias ? '1px solid ' + S.dangerDeep : '1px solid ' + S.goldMuted,
                background: temPendencias ? `linear-gradient(135deg, ${S.warningDeep} 0%, ${S.dangerDeep} 100%)` : L.surface,
                color: temPendencias ? theme.textOnAccent : L.ink,
                boxShadow: temPendencias ? L.shadowSoft : L.shadow,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                padding: temPendencias ? '0 12px' : 0,
                transition: 'all .22s ease',
                fontFamily: 'inherit',
                pointerEvents: 'auto',
              }}
              title="Notificações"
            >
              <IconBell active={temPendencias} />
              {temPendencias && (
                <span style={{
                  minWidth: 22,
                  height: 22,
                  borderRadius: 999,
                  background: L.surface,
                  color: S.dangerDeep,
                  fontSize: 10.5,
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 6px',
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
                width: isMobile ? 'calc(100vw - 28px)' : 390,
                maxHeight: isMobile ? 'calc(100vh - 96px)' : 520,
                overflowY: 'auto',
                background: L.surface,
                border: '1px solid ' + L.border,
                borderRadius: 20,
                boxShadow: L.shadowPanel,
                padding: 12,
                pointerEvents: 'auto',
              }}>
                <div style={{ padding: '6px 6px 12px', borderBottom: '1px solid ' + L.border, marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div>
                      <strong style={{ fontFamily: 'var(--font-serif)', fontSize: 21, color: L.ink, display: 'block', lineHeight: 1 }}>Central de ações</strong>
                      <span style={{ display: 'block', marginTop: 5, color: L.muted, fontSize: 12.5, fontWeight: 700 }}>Pendências que precisam de atenção.</span>
                    </div>
                    <span style={{ minWidth: 34, height: 34, borderRadius: 999, display: 'grid', placeItems: 'center', background: temPendencias ? S.dangerDeep : L.surfaceMuted, color: temPendencias ? theme.textOnAccent : S.goldMuted, fontSize: 13, fontWeight: 900, border: '2px solid ' + L.surface, boxShadow: temPendencias ? L.shadowSoft : 'none' }}>
                      {pendentes.length}
                    </span>
                  </div>
                  {pendentes.length > 0 && (
                    <button
                      onClick={marcarTodasComoLidas}
                      style={{ marginTop: 12, width: '100%', border: '1px solid ' + L.border, background: L.surfaceMuted, color: L.muted, borderRadius: 12, padding: '9px 10px', fontSize: 12, fontWeight: 900, fontFamily: 'inherit', cursor: 'pointer' }}
                    >
                      Marcar todas como lidas
                    </button>
                  )}
                </div>
                {notificacoes.length === 0 ? (
                  <div style={{ padding: 28, textAlign: 'center', color: L.muted, fontSize: 13, lineHeight: 1.5 }}>Nenhuma ação pendente agora.</div>
                ) : (
                  notificacoesOrdenadas.map(item => (
                    <button
                      key={item.id}
                      onClick={() => abrirNotificacao(item)}
                      style={{
                        width: '100%',
                        border: '1px solid ' + L.border,
                        borderLeft: `5px solid ${corPrioridade(item)}`,
                        background: item.status !== 'lida' ? L.surfaceSoft : L.surface,
                        borderRadius: 14,
                        padding: 13,
                        marginBottom: 9,
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        boxShadow: item.status !== 'lida' ? L.shadowSoft : 'none',
                      }}
                    >
                      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ color: corPrioridade(item), fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 900 }}>{item.tipo || 'ação'}</span>
                        <span style={{ borderRadius: 999, background: `${corPrioridade(item)}18`, color: corPrioridade(item), padding: '4px 7px', fontSize: 10, fontWeight: 900, whiteSpace: 'nowrap' }}>{labelPrioridade(item)}</span>
                      </span>
                      <strong style={{ display: 'block', color: L.ink, fontSize: 13.5, lineHeight: 1.25 }}>{item.titulo}</strong>
                      {item.descricao && <small style={{ display: 'block', color: L.muted, fontSize: 12, lineHeight: 1.35, marginTop: 4 }}>{item.descricao}</small>}
                      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginTop: 10 }}>
                        <small style={{ display: 'block', color: L.soft, fontSize: 11 }}>
                          {item.created_at ? new Date(item.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                        </small>
                        <small style={{ color: S.goldMuted, fontSize: 11, fontWeight: 900 }}>Abrir →</small>
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
              background: theme.sidebar.background,
              border: '1px solid ' + theme.sidebar.avatarRing,
              borderRadius: 10, padding: '8px 12px',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-xs)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <IconMenu />
            <span style={{
              fontSize: 10,
              fontFamily: 'var(--font-serif, serif)',
              letterSpacing: 3,
              color: theme.sidebar.gold,
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
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={theme.sidebar.gold} strokeWidth="2.5">
      <line x1="3" y1="6"  x2="21" y2="6"  />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

function IconBell({ active = false }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? theme.textOnAccent : theme.status.goldMuted} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}
