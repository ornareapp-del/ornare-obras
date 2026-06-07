import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default function Agenda() {
  const [eventos, setEventos] = useState([])
  const [obras, setObras] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const hoje = new Date()
  const [form, setForm] = useState({ titulo: '', descricao: '', obra_id: '', data: new Date().toISOString().split('T')[0], hora_inicio: '08:00', hora_fim: '' })

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const [{ data: ev }, { data: ob }] = await Promise.all([
      supabase.from('agenda').select('*, obras(nome)').order('data').order('hora_inicio'),
      supabase.from('obras').select('id, nome').order('nome'),
    ])
    setEventos(ev || [])
    setObras(ob || [])
    setLoading(false)
  }

  async function salvar() {
    if (!form.titulo.trim()) return
    setSalvando(true)
    await supabase.from('agenda').insert([{ ...form, obra_id: form.obra_id || null, hora_fim: form.hora_fim || null }])
    setForm({ titulo: '', descricao: '', obra_id: '', data: new Date().toISOString().split('T')[0], hora_inicio: '08:00', hora_fim: '' })
    setShowForm(false)
    await carregar()
    setSalvando(false)
  }

  const hoje_str = hoje.toISOString().split('T')[0]
  const proximos = eventos.filter(e => e.data >= hoje_str)
  const passados = eventos.filter(e => e.data < hoje_str)

  function GrupoEventos({ lista, titulo }) {
    if (lista.length === 0) return null
    return (
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 12 }}>{titulo}</div>
        {lista.map(ev => {
          const d = new Date(ev.data + 'T00:00:00')
          return (
            <div key={ev.id} style={{ display: 'flex', gap: 16, background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: '14px 18px', marginBottom: 10, alignItems: 'flex-start' }}>
              <div style={{ minWidth: 52, textAlign: 'center', background: 'var(--color-bg)', borderRadius: 8, padding: '8px 0' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-ink)', fontFamily: 'var(--font-serif)', lineHeight: 1 }}>{d.getDate()}</div>
                <div style={{ fontSize: 10, color: 'var(--color-gold)', letterSpacing: 1 }}>{MESES[d.getMonth()].slice(0,3).toUpperCase()}</div>
                <div style={{ fontSize: 9, color: 'var(--color-ink-muted)' }}>{DIAS[d.getDay()]}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-ink)' }}>{ev.titulo}</div>
                {ev.descricao && <div style={{ fontSize: 12.5, color: 'var(--color-ink-muted)', marginTop: 3 }}>{ev.descricao}</div>}
                <div style={{ display: 'flex', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
                  {ev.hora_inicio && <span style={{ fontSize: 11, color: '#aaa' }}>🕐 {ev.hora_inicio.slice(0,5)}{ev.hora_fim ? ` – ${ev.hora_fim.slice(0,5)}` : ''}</span>}
                  {ev.obras?.nome && <span style={{ fontSize: 11, color: 'var(--color-gold)' }}>📍 {ev.obras.nome}</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ padding: '40px 48px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: 3, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 8 }}>Gestão</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 38, fontWeight: 500, color: 'var(--color-ink)', margin: 0 }}>Agenda</h1>
          <p style={{ fontSize: 13, color: 'var(--color-ink-muted)', marginTop: 6 }}>{MESES[hoje.getMonth()]} {hoje.getFullYear()}</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ background: 'var(--color-ink)', color: '#f9f7f4', border: 'none', borderRadius: 8, padding: '10px 22px', fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
          {showForm ? '✕ Cancelar' : '+ Novo Evento'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24, marginBottom: 28 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <L>Título *</L>
              <I value={form.titulo} onChange={v => setForm(p => ({ ...p, titulo: v }))} placeholder="Nome do evento" />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <L>Descrição</L>
              <I value={form.descricao} onChange={v => setForm(p => ({ ...p, descricao: v }))} placeholder="Detalhes..." />
            </div>
            <div>
              <L>Data</L>
              <I type="date" value={form.data} onChange={v => setForm(p => ({ ...p, data: v }))} />
            </div>
            <div>
              <L>Obra (opcional)</L>
              <S value={form.obra_id} onChange={v => setForm(p => ({ ...p, obra_id: v }))}>
                <option value="">Sem obra vinculada</option>
                {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </S>
            </div>
            <div>
              <L>Hora início</L>
              <I type="time" value={form.hora_inicio} onChange={v => setForm(p => ({ ...p, hora_inicio: v }))} />
            </div>
            <div>
              <L>Hora fim</L>
              <I type="time" value={form.hora_fim} onChange={v => setForm(p => ({ ...p, hora_fim: v }))} />
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={salvar} disabled={salvando} style={{ background: 'var(--color-gold)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {salvando ? 'Salvando...' : 'Criar Evento'}
            </button>
          </div>
        </div>
      )}

      {loading ? <div style={{ color: '#bbb' }}>Carregando...</div> : (
        <>
          <GrupoEventos lista={proximos} titulo="Próximos eventos" />
          <GrupoEventos lista={passados} titulo="Eventos anteriores" />
          {eventos.length === 0 && <div style={{ textAlign: 'center', padding: '50px 0', color: '#bbb' }}>Nenhum evento cadastrado.</div>}
        </>
      )}
    </div>
  )
}

function L({ children }) { return <div style={{ fontSize: 11, color: '#888', marginBottom: 5, fontWeight: 500 }}>{children}</div> }
function I({ onChange, ...props }) { return <input {...props} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }} /> }
function S({ onChange, children, ...props }) { return <select {...props} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff' }}>{children}</select> }