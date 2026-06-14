import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'

const CATEGORIAS = [
  { value: 'combustivel',  label: 'Combustivel',  emoji: '⛽', cor: '#E8A020' },
  { value: 'pedagio',      label: 'Pedagio',      emoji: '🛣️', cor: '#9070C0' },
  { value: 'hospedagem',   label: 'Hospedagem',   emoji: '🏨', cor: '#4A90D9' },
  { value: 'alimentacao',  label: 'Alimentacao',  emoji: '🍽️', cor: '#5AAB6E' },
  { value: 'frete',        label: 'Frete',        emoji: '🚚', cor: '#D9704A' },
  { value: 'terceiros',    label: 'Terceiros',    emoji: '👷', cor: '#B09A7A' },
  { value: 'ferragens',    label: 'Ferragens',    emoji: '🔧', cor: '#888'    },
  { value: 'material',     label: 'Material',     emoji: '📦', cor: '#6A8A6A' },
  { value: 'outro',        label: 'Outros',       emoji: '📋', cor: '#AAA'    },
]
const CAT = Object.fromEntries(CATEGORIAS.map(c => [c.value, c]))

// Categorias que exigem aprovação acima de R$ 500
const CATS_APROVACAO = ['terceiros', 'hospedagem', 'frete']
const LIMITE_APROVACAO = 500

// ─── PAINEL DE CONTEXTO DE ORCAMENTO ─────────────────────────────────────────
function PainelOrcamento({ obra, gastosObra }) {
  if (!obra) return null
  const meta  = parseFloat(obra.gasto_meta) || 0
  const gasto = gastosObra.reduce((s, g) => s + (parseFloat(g.valor) || 0), 0)
  const pct   = meta > 0 ? Math.min(Math.round(gasto / meta * 100), 100) : 0
  const saldo = meta - gasto
  const corBarra = pct >= 90 ? '#B84040' : pct >= 70 ? '#C8A86A' : '#2D7A4A'
  const corSaldo = saldo < 0 ? '#B84040' : pct >= 80 ? '#C8A86A' : '#2D7A4A'

  return (
    <div style={{
      background: pct >= 90 ? '#fdf5f5' : '#f9f7f4',
      border: '1px solid ' + (pct >= 90 ? '#e8c0c0' : '#e8d9b8'),
      borderLeft: '3px solid ' + corBarra,
      borderRadius: 10, padding: '14px 18px', marginBottom: 20,
    }}>
      <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 10, fontWeight: 600 }}>
        Contexto financeiro — {obra.nome}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, color: '#aaa', marginBottom: 3 }}>Orçamento</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-ink)' }}>
            {meta > 0 ? 'R$ ' + meta.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#aaa', marginBottom: 3 }}>Já gasto</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-ink)' }}>
            R$ {gasto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#aaa', marginBottom: 3 }}>{saldo < 0 ? 'Excedido' : 'Disponível'}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: corSaldo }}>
            {meta > 0 ? 'R$ ' + Math.abs(saldo).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}
          </div>
        </div>
      </div>
      {meta > 0 && (
        <>
          <div style={{ height: 6, background: '#e8e4de', borderRadius: 3, marginBottom: 6 }}>
            <div style={{ height: 6, background: corBarra, borderRadius: 3, width: pct + '%', transition: 'width .3s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#aaa' }}>
            <span>{pct}% utilizado</span>
            {pct >= 90 && <span style={{ color: '#B84040', fontWeight: 600 }}>Limite critico atingido</span>}
            {pct >= 70 && pct < 90 && <span style={{ color: 'var(--color-gold)', fontWeight: 600 }}>Atenção ao orçamento</span>}
          </div>
        </>
      )}
    </div>
  )
}

// ─── MODAL NOVO GASTO ─────────────────────────────────────────────────────────
function Modal({ obras, profiles, todosGastos, onClose, onSaved }) {
  const { profile } = useStore()
  const [form, setForm] = useState({
    obra_id: '', categoria: 'combustivel', descricao: '',
    valor: '', data: new Date().toISOString().split('T')[0],
    responsavel_id: profile?.id || '', observacao: '',
  })
  const [saving,  setSaving]  = useState(false)
  const [erro,    setErro]    = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  const obraSelecionada  = obras.find(o => o.id === form.obra_id) || null
  const gastosObraSel    = todosGastos.filter(g => g.obra_id === form.obra_id)
  const valorNum         = parseFloat(form.valor.replace(',', '.')) || 0
  const metaObra         = parseFloat(obraSelecionada?.gasto_meta) || 0
  const gastoAtualObra   = gastosObraSel.reduce((s, g) => s + (parseFloat(g.valor) || 0), 0)
  const gastoPosLanc     = gastoAtualObra + valorNum
  const excedeMeta       = metaObra > 0 && gastoPosLanc > metaObra
  const precisaAprovacao = CATS_APROVACAO.includes(form.categoria) && valorNum > LIMITE_APROVACAO

  async function salvar() {
    if (!form.descricao.trim() || !form.valor || !form.data) {
      setErro('Preencha descricao, valor e data.'); return
    }
    if (isNaN(valorNum) || valorNum <= 0) {
      setErro('Valor invalido.'); return
    }
    setSaving(true)

    const status = precisaAprovacao ? 'pendente_aprovacao' : 'aprovado'

    const { error } = await supabase.from('gastos').insert({
      obra_id:        form.obra_id        || null,
      categoria:      form.categoria,
      descricao:      form.descricao.trim(),
      valor:          valorNum,
      data:           form.data,
      responsavel_id: form.responsavel_id || null,
      observacao:     form.observacao     || null,
      criado_por:     profile?.id,
      status,
    })

    if (error) { setErro(error.message); setSaving(false); return }
    onSaved(precisaAprovacao)
  }

  return (
    <div style={ms.bg} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={ms.box}>
        <div style={ms.header}>
          <h2 style={ms.title}>Novo Gasto</h2>
          <button style={ms.close} onClick={onClose}>✕</button>
        </div>

        <div style={ms.body}>
          {erro && <div style={ms.erro}>{erro}</div>}

          {/* seletor de obra primeiro — desbloqueia o painel */}
          <div style={{ marginBottom: 16 }}>
            <label style={ms.label}>Obra vinculada</label>
            <select style={ms.input} value={form.obra_id} onChange={e => set('obra_id', e.target.value)}>
              <option value="">— Sem obra vinculada —</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>

          {/* painel de contexto de orçamento */}
          {form.obra_id && (
            <PainelOrcamento obra={obraSelecionada} gastosObra={gastosObraSel} />
          )}

          {/* alerta de excedente */}
          {excedeMeta && valorNum > 0 && (
            <div style={ms.alertaExcede}>
              ⚠️ Este lançamento excederia o orçamento em{' '}
              <strong>R$ {(gastoPosLanc - metaObra).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>.
              O gasto sera salvo mas ficara marcado para revisao.
            </div>
          )}

          {/* alerta de aprovação */}
          {precisaAprovacao && (
            <div style={ms.alertaAprovacao}>
              🔒 Gastos de <strong>{CAT[form.categoria]?.label}</strong> acima de R$ {LIMITE_APROVACAO.toLocaleString('pt-BR')} requerem aprovação da gestão.
              Este lançamento ficará como <strong>pendente</strong> até ser aprovado.
            </div>
          )}

          <div style={ms.grid}>
            <div style={ms.full}>
              <label style={ms.label}>Descrição *</label>
              <input style={ms.input} value={form.descricao}
                onChange={e => set('descricao', e.target.value)}
                placeholder="Ex: Combustivel ida a obra..." />
            </div>

            <div>
              <label style={ms.label}>Categoria *</label>
              <select style={ms.input} value={form.categoria} onChange={e => set('categoria', e.target.value)}>
                {CATEGORIAS.map(c => (
                  <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={ms.label}>Valor (R$) *</label>
              <input style={{ ...ms.input, borderColor: excedeMeta && valorNum > 0 ? '#e8c0c0' : '#e0dbd4' }}
                value={form.valor}
                onChange={e => set('valor', e.target.value)}
                placeholder="0,00" />
            </div>

            <div>
              <label style={ms.label}>Data *</label>
              <input style={ms.input} type="date" value={form.data} onChange={e => set('data', e.target.value)} />
            </div>

            <div>
              <label style={ms.label}>Responsável</label>
              <select style={ms.input} value={form.responsavel_id} onChange={e => set('responsavel_id', e.target.value)}>
                <option value="">— Selecione —</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>

            <div style={ms.full}>
              <label style={ms.label}>Comprovante (foto ou PDF)</label>
              <label style={ms.uploadArea}>
                <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
                  onChange={e => set('arquivo', e.target.files[0])} />
                {form.arquivo ? (
                  <span style={{ color: 'var(--color-ink)', fontSize: 13 }}>📎 {form.arquivo.name}</span>
                ) : (
                  <span style={{ color: '#aaa', fontSize: 13 }}>📎 Toque para anexar comprovante</span>
                )}
              </label>
            </div>

            <div style={ms.full}>
              <label style={ms.label}>Observação</label>
              <textarea style={{ ...ms.input, height: 64, resize: 'vertical' }}
                value={form.observacao}
                onChange={e => set('observacao', e.target.value)}
                placeholder="Informações adicionais..." />
            </div>
          </div>
        </div>

        <div style={ms.footer}>
          <button style={ms.btnCancel} onClick={onClose}>Cancelar</button>
          <button style={{ ...ms.btnSave, background: precisaAprovacao ? '#C8A86A' : 'var(--color-gold)' }}
            onClick={salvar} disabled={saving}>
            {saving ? 'Salvando...' : precisaAprovacao ? 'Enviar para aprovação' : 'Salvar Gasto'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MODAL APROVACAO ──────────────────────────────────────────────────────────
function ModalAprovacao({ gasto, onClose, onAprovado }) {
  const [justificativa, setJustificativa] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function aprovar() {
    setSalvando(true)
    await supabase.from('gastos').update({ status: 'aprovado', observacao: gasto.observacao + (justificativa ? ' | Aprovado: ' + justificativa : '') }).eq('id', gasto.id)
    onAprovado()
  }
  async function recusar() {
    if (!justificativa.trim()) return
    setSalvando(true)
    await supabase.from('gastos').update({ status: 'recusado', observacao: gasto.observacao + ' | Recusado: ' + justificativa }).eq('id', gasto.id)
    onAprovado()
  }

  return (
    <div style={ms.bg} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...ms.box, maxWidth: 440 }}>
        <div style={ms.header}>
          <h2 style={ms.title}>Aprovar Gasto</h2>
          <button style={ms.close} onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '20px 28px' }}>
          <div style={{ background: '#f9f7f4', border: '1px solid var(--color-border)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 4 }}>{gasto.descricao}</div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>{CAT[gasto.categoria]?.emoji} {CAT[gasto.categoria]?.label} · {gasto.obras?.nome || 'Sem obra'}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-ink)' }}>
              R$ {parseFloat(gasto.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <label style={ms.label}>Justificativa (obrigatória para recusar)</label>
          <textarea
            style={{ ...ms.input, height: 72, resize: 'vertical', marginBottom: 16 }}
            value={justificativa}
            onChange={e => setJustificativa(e.target.value)}
            placeholder="Comentário opcional para aprovação, obrigatório para recusa..." />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={recusar} disabled={salvando || !justificativa.trim()} style={{ flex: 1, background: '#fdecea', color: '#B84040', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Recusar
            </button>
            <button onClick={aprovar} disabled={salvando} style={{ flex: 1, background: 'var(--color-gold)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {salvando ? '...' : 'Aprovar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── PAGINA GASTOS ────────────────────────────────────────────────────────────
export default function Gastos() {
  const navigate = useNavigate()
  const [gastos,          setGastos]          = useState([])
  const [obras,           setObras]           = useState([])
  const [profiles,        setProfiles]        = useState([])
  const [loading,         setLoading]         = useState(true)
  const [filtroObra,      setFiltroObra]      = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroStatus,    setFiltroStatus]    = useState('')
  const [modal,           setModal]           = useState(false)
  const [gastoPendente,   setGastoPendente]   = useState(null) // para modal de aprovação
  const [toast,           setToast]           = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const [{ data: g }, { data: o }, { data: p }] = await Promise.all([
      supabase.from('gastos')
        .select('*, obras(nome, gasto_meta), responsavel:profiles!gastos_responsavel_id_fkey(full_name)')
        .order('created_at', { ascending: false }),
      supabase.from('obras').select('id, nome, gasto_meta').order('nome'),
      supabase.from('profiles').select('id, full_name').in('role', ['gestao', 'supervisor', 'montador']),
    ])
    setGastos(g    || [])
    setObras(o     || [])
    setProfiles(p  || [])
    setLoading(false)
  }

  function mostrarToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  const pendentes = gastos.filter(g => g.status === 'pendente_aprovacao')

  const lista = gastos
    .filter(g => !filtroObra      || g.obra_id   === filtroObra)
    .filter(g => !filtroCategoria || g.categoria === filtroCategoria)
    .filter(g => !filtroStatus    || g.status    === filtroStatus)

  const total = lista.reduce((s, g) => s + (parseFloat(g.valor) || 0), 0)

  const porCategoria = Object.entries(
    lista.reduce((acc, g) => {
      acc[g.categoria] = (acc[g.categoria] || 0) + parseFloat(g.valor || 0)
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1])

  const statusCor = {
    aprovado:           { bg: '#edf7f0', color: '#2D7A4A', label: 'Aprovado' },
    pendente_aprovacao: { bg: '#fdf8f0', color: '#C8A86A', label: 'Pendente' },
    recusado:           { bg: '#fdecea', color: '#B84040', label: 'Recusado' },
  }

  return (
    <div className="ow-page" style={s.page}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: '#1A1A18', color: '#fff', padding: '12px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600, borderLeft: '3px solid #C8A86A', zIndex: 2000, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}

      {modal && (
        <Modal
          obras={obras} profiles={profiles} todosGastos={gastos}
          onClose={() => setModal(false)}
          onSaved={(precisouAprovacao) => {
            setModal(false)
            carregar()
            mostrarToast(precisouAprovacao ? 'Gasto enviado para aprovação da gestão.' : 'Gasto registrado com sucesso.')
          }}
        />
      )}

      {gastoPendente && (
        <ModalAprovacao
          gasto={gastoPendente}
          onClose={() => setGastoPendente(null)}
          onAprovado={() => { setGastoPendente(null); carregar(); mostrarToast('Gasto atualizado.') }}
        />
      )}

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div style={s.header}>
        <div>
          <div style={s.breadcrumb}>Gestão</div>
          <h1 style={s.title}>Gastos</h1>
          <p style={s.sub}>Controle financeiro de todas as obras</p>
        </div>
        <button style={s.btnNew} onClick={() => setModal(true)}>+ Lançar Gasto</button>
      </div>

      {/* ── APROVACOES PENDENTES ─────────────────────────────────────────────── */}
      {pendentes.length > 0 && (
        <div style={s.pendentesBox}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-gold)' }}>🔒 Aprovações pendentes ({pendentes.length})</span>
          </div>
          {pendentes.map(g => (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', borderBottom: '1px solid #e8d9b8' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)' }}>{g.descricao}</div>
                <div style={{ fontSize: 11, color: '#aaa' }}>{CAT[g.categoria]?.emoji} {CAT[g.categoria]?.label} · {g.obras?.nome || 'Sem obra'}</div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-ink)', marginRight: 8 }}>
                R$ {parseFloat(g.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <button onClick={() => setGastoPendente(g)} style={{ background: 'var(--color-gold)', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Analisar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── KPIs ─────────────────────────────────────────────────────────────── */}
      <div style={s.statsGrid}>
        <div style={s.stat}>
          <div style={s.statLabel}>Total Geral</div>
          <div style={s.statValue}>R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        </div>
        <div style={s.stat}>
          <div style={s.statLabel}>Lancamentos</div>
          <div style={s.statValue}>{lista.length}</div>
        </div>
        <div style={s.stat}>
          <div style={s.statLabel}>Obras com gastos</div>
          <div style={s.statValue}>{new Set(lista.map(g => g.obra_id).filter(Boolean)).size}</div>
        </div>
        <div style={{ ...s.stat, borderLeft: pendentes.length > 0 ? '3px solid #C8A86A' : '1px solid var(--color-border)' }}>
          <div style={s.statLabel}>Pendentes aprovação</div>
          <div style={{ ...s.statValue, color: pendentes.length > 0 ? '#C8A86A' : 'var(--color-ink)' }}>{pendentes.length}</div>
        </div>
      </div>

      {/* ── POR CATEGORIA ────────────────────────────────────────────────────── */}
      {porCategoria.length > 0 && (
        <div style={s.card}>
          <div style={s.cardLabel}>Por categoria</div>
          {porCategoria.map(([cat, val]) => (
            <div key={cat} style={s.catRow}>
              <div style={{ ...s.catDot, background: CAT[cat]?.cor || '#ccc' }} />
              <div style={s.catName}>{CAT[cat]?.emoji} {CAT[cat]?.label || cat}</div>
              <div style={s.catBar}>
                <div style={{ ...s.catFill, width: Math.round(val / total * 100) + '%', background: CAT[cat]?.cor || '#ccc' }} />
              </div>
              <div style={s.catVal}>R$ {val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              <div style={s.catPct}>{Math.round(val / total * 100)}%</div>
            </div>
          ))}
        </div>
      )}

      {/* ── FILTROS ──────────────────────────────────────────────────────────── */}
      <div style={s.filters}>
        <select style={s.select} value={filtroObra} onChange={e => setFiltroObra(e.target.value)}>
          <option value="">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <select style={s.select} value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
          <option value="">Todas as categorias</option>
          {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
        </select>
        <select style={s.select} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="aprovado">Aprovados</option>
          <option value="pendente_aprovacao">Pendentes</option>
          <option value="recusado">Recusados</option>
        </select>
      </div>

      {/* ── LISTA ────────────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={s.empty}>Carregando...</div>
      ) : lista.length === 0 ? (
        <div style={s.emptyBox}>
          <div style={s.emptyIcon}>💰</div>
          <div style={s.emptyTitle}>Nenhum gasto lançado</div>
          <div style={s.emptySub}>Registre os gastos operacionais das obras</div>
          <button style={s.btnNew} onClick={() => setModal(true)}>+ Lançar Primeiro Gasto</button>
        </div>
      ) : (
        <div style={s.list}>
          {lista.map(g => {
            const sc = statusCor[g.status] || statusCor.aprovado
            return (
              <div key={g.id} style={s.item} onClick={() => g.obra_id && navigate(`/obras/${g.obra_id}`)}>
                <div style={{ ...s.itemDot, background: CAT[g.categoria]?.cor || '#ccc' }} />
                <div style={s.itemBody}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={s.itemTitle}>{g.descricao}</div>
                    {g.status && g.status !== 'aprovado' && (
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: sc.bg, color: sc.color, fontWeight: 600 }}>
                        {sc.label}
                      </span>
                    )}
                  </div>
                  <div style={s.itemMeta}>
                    {CAT[g.categoria]?.emoji} {CAT[g.categoria]?.label || g.categoria}
                    {g.obras?.nome        ? ' · ' + g.obras.nome                                                       : ''}
                    {g.responsavel?.full_name ? ' · ' + g.responsavel.full_name                                        : ''}
                    {g.data               ? ' · ' + new Date(g.data + 'T00:00:00').toLocaleDateString('pt-BR')         : ''}
                  </div>
                  {g.observacao && <div style={s.itemObs}>{g.observacao}</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <div style={s.itemValor}>
                    R$ {parseFloat(g.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  {g.status === 'pendente_aprovacao' && (
                    <button
                      onClick={e => { e.stopPropagation(); setGastoPendente(g) }}
                      style={{ fontSize: 10, background: '#fdf8f0', color: '#C8A86A', border: '1px solid #e8d9b8', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontWeight: 600 }}>
                      Analisar
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── ESTILOS ──────────────────────────────────────────────────────────────────
const s = {
  page:         { padding: '32px 40px', maxWidth: 1000, margin: '0 auto' },
  header:       { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  breadcrumb:   { fontSize: 9, letterSpacing: 3, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 6 },
  title:        { fontFamily: 'var(--font-serif)', fontSize: 36, fontWeight: 500, color: 'var(--color-ink)', margin: 0 },
  sub:          { fontSize: 13, color: 'var(--color-ink-muted)', marginTop: 4 },
  btnNew:       { background: 'var(--color-gold)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
  pendentesBox: { background: '#fdf8f0', border: '1px solid #e8d9b8', borderLeft: '3px solid #C8A86A', borderRadius: 12, padding: '16px 20px', marginBottom: 24 },
  statsGrid:    { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 },
  stat:         { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 14, padding: '18px 22px', boxShadow: 'var(--shadow)' },
  statLabel:    { fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 8 },
  statValue:    { fontSize: 26, fontWeight: 700, color: 'var(--color-ink)' },
  card:         { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 14, padding: '18px 22px', marginBottom: 20, boxShadow: 'var(--shadow)' },
  cardLabel:    { fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 14 },
  catRow:       { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  catDot:       { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  catName:      { fontSize: 12, fontWeight: 500, minWidth: 130, color: 'var(--color-ink)' },
  catBar:       { flex: 1, height: 6, background: '#f0ece6', borderRadius: 3 },
  catFill:      { height: 6, borderRadius: 3, transition: 'width .3s' },
  catVal:       { fontSize: 12, fontWeight: 600, color: 'var(--color-ink)', minWidth: 100, textAlign: 'right' },
  catPct:       { fontSize: 11, color: '#aaa', minWidth: 36, textAlign: 'right' },
  filters:      { display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
  select:       { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 13, fontFamily: 'inherit', background: '#fff', color: 'var(--color-ink)' },
  list:         { display: 'flex', flexDirection: 'column', gap: 8 },
  item:         { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', transition: 'border-color .15s', boxShadow: 'var(--shadow)' },
  itemDot:      { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  itemBody:     { flex: 1, minWidth: 0 },
  itemTitle:    { fontSize: 14, fontWeight: 600, color: 'var(--color-ink)' },
  itemMeta:     { fontSize: 11, color: '#aaa', marginTop: 2 },
  itemObs:      { fontSize: 11, color: '#bbb', marginTop: 3, fontStyle: 'italic' },
  itemValor:    { fontSize: 15, fontWeight: 700, color: 'var(--color-ink)', whiteSpace: 'nowrap' },
  empty:        { textAlign: 'center', padding: '40px 0', color: '#bbb' },
  emptyBox:     { textAlign: 'center', padding: '60px 20px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12 },
  emptyIcon:    { fontSize: 40, marginBottom: 12 },
  emptyTitle:   { fontSize: 16, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 6 },
  emptySub:     { fontSize: 13, color: '#aaa', marginBottom: 20 },
}

const ms = {
  bg:          { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  box:         { background: '#fff', borderRadius: 14, width: '100%', maxWidth: 580, maxHeight: '92vh', display: 'flex', flexDirection: 'column' },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 28px 0', flexShrink: 0 },
  title:       { fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 500, margin: 0 },
  close:       { background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#999', padding: 4 },
  body:        { overflowY: 'auto', padding: '20px 28px', flex: 1 },
  grid:        { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  full:        { gridColumn: '1/-1' },
  label:       { display: 'block', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: '#888', marginBottom: 6 },
  input:       { width: '100%', border: '1px solid #e0dbd4', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'inherit', color: 'var(--color-ink)', background: '#fafaf8', outline: 'none', boxSizing: 'border-box' },
  uploadArea:  { display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px dashed #e0dbd4', borderRadius: 8, padding: '16px', cursor: 'pointer', background: '#fafaf8', width: '100%', boxSizing: 'border-box' },
  erro:        { background: '#fceee9', borderLeft: '3px solid #c4421e', color: '#5c2010', padding: '10px 14px', borderRadius: 6, fontSize: 12, marginBottom: 16 },
  alertaExcede:   { background: '#fdecea', borderLeft: '3px solid #B84040', color: '#7a2020', padding: '10px 14px', borderRadius: 6, fontSize: 12, marginBottom: 16, lineHeight: 1.5 },
  alertaAprovacao:{ background: '#fdf8f0', borderLeft: '3px solid #C8A86A', color: '#7a5c20', padding: '10px 14px', borderRadius: 6, fontSize: 12, marginBottom: 16, lineHeight: 1.5 },
  footer:      { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 28px', borderTop: '1px solid #f0ece6', flexShrink: 0 },
  btnCancel:   { background: 'none', border: '1px solid #e0dbd4', borderRadius: 8, padding: '9px 18px', fontSize: 13, cursor: 'pointer', color: '#888', fontFamily: 'inherit' },
  btnSave:     { color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
}
