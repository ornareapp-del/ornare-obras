import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { tarefasService } from '../../services/tarefasService'

const ABAS = ['Visão Geral', 'Tarefas', 'Checklist', 'Fotos', 'Ocorrências', 'Gastos', 'Cliente', 'Histórico']

const STATUS_TAREFA = {
  pendente: { label: 'Pendente', color: '#b0956a' },
  em_andamento: { label: 'Em andamento', color: '#4a90d9' },
  concluida: { label: 'Concluída', color: '#5aab6e' },
  bloqueada: { label: 'Bloqueada', color: '#d94a4a' },
}

const PRIORIDADE = {
  baixa: { label: 'Baixa', color: '#8a8a8a' },
  media: { label: 'Média', color: '#b0956a' },
  alta: { label: 'Alta', color: '#d94a4a' },
}

const statusObra = {
  em_andamento: { label: 'Em andamento', bg: '#e8f4ea', color: '#3a7d4f' },
  concluida: { label: 'Concluída', bg: '#eaf0e8', color: '#3a6a3f' },
  pausada: { label: 'Pausada', bg: '#fdf3e3', color: '#a0692a' },
  cancelada: { label: 'Cancelada', bg: '#fdecea', color: '#a03030' },
  planejamento: { label: 'Planejamento', bg: '#eef2f8', color: '#3a5580' },
}

export default function ObraDetalhe() {
  const { id } = useParams()
  const [obra, setObra] = useState(null)
  const [abaAtiva, setAbaAtiva] = useState('Visão Geral')
  const [loading, setLoading] = useState(true)

  // Tarefas
  const [tarefas, setTarefas] = useState([])
  const [loadingTarefas, setLoadingTarefas] = useState(false)
  const [showFormTarefa, setShowFormTarefa] = useState(false)
  const [salvandoTarefa, setSalvandoTarefa] = useState(false)
  const [novaTarefa, setNovaTarefa] = useState({
    titulo: '',
    descricao: '',
    prioridade: 'media',
    prazo: '',
    responsavel_id: '',
    status: 'pendente',
  })
  const [profiles, setProfiles] = useState([])
  const [progresso, setProgresso] = useState(0)

  useEffect(() => {
    carregarObra()
    carregarProfiles()
  }, [id])

  useEffect(() => {
    if (abaAtiva === 'Tarefas') carregarTarefas()
  }, [abaAtiva, id])

  async function carregarObra() {
    setLoading(true)
    const { data, error } = await supabase
      .from('obras')
      .select('*')
      .eq('id', id)
      .single()
    if (!error) setObra(data)
    setLoading(false)
  }

  async function carregarProfiles() {
    const { data } = await supabase.from('profiles').select('id, full_name, email')
    if (data) setProfiles(data)
  }

  async function carregarTarefas() {
    setLoadingTarefas(true)
    try {
      const data = await tarefasService.listarPorObra(id)
      setTarefas(data || [])
      const p = await tarefasService.calcularProgresso(id)
      setProgresso(p)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingTarefas(false)
    }
  }

  async function salvarTarefa() {
    if (!novaTarefa.titulo.trim()) return
    setSalvandoTarefa(true)
    try {
      await tarefasService.criar({
        ...novaTarefa,
        obra_id: id,
        responsavel_id: novaTarefa.responsavel_id || null,
        prazo: novaTarefa.prazo || null,
      })
      setNovaTarefa({ titulo: '', descricao: '', prioridade: 'media', prazo: '', responsavel_id: '', status: 'pendente' })
      setShowFormTarefa(false)
      await carregarTarefas()
    } catch (e) {
      console.error(e)
    } finally {
      setSalvandoTarefa(false)
    }
  }

  async function mudarStatus(tarefaId, novoStatus) {
    try {
      await tarefasService.atualizarStatus(tarefaId, novoStatus)
      await carregarTarefas()
    } catch (e) {
      console.error(e)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#888', fontSize: 15 }}>
      Carregando obra...
    </div>
  )

  if (!obra) return (
    <div style={{ padding: 40, color: '#888' }}>Obra não encontrada.</div>
  )

  const st = statusObra[obra.status] || statusObra.planejamento

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header da Obra */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 2, color: '#b0956a', textTransform: 'uppercase', marginBottom: 6 }}>
              Detalhe da Obra
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1a1a1a', margin: 0, lineHeight: 1.2 }}>
              {obra.nome}
            </h1>
            <div style={{ marginTop: 8, fontSize: 14, color: '#666' }}>
              {obra.cliente_nome} · {obra.cidade || obra.endereco}
            </div>
          </div>
          <span style={{
            display: 'inline-block', padding: '6px 16px', borderRadius: 20,
            background: st.bg, color: st.color, fontSize: 13, fontWeight: 600
          }}>
            {st.label}
          </span>
        </div>

        {/* KPIs rápidos */}
        <div style={{ display: 'flex', gap: 20, marginTop: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'Início', value: obra.data_inicio ? new Date(obra.data_inicio).toLocaleDateString('pt-BR') : '—' },
            { label: 'Previsão', value: obra.data_previsao ? new Date(obra.data_previsao).toLocaleDateString('pt-BR') : '—' },
            { label: 'Progresso', value: `${obra.progresso || 0}%` },
            { label: 'Valor', value: obra.valor_contrato ? `R$ ${Number(obra.valor_contrato).toLocaleString('pt-BR')}` : '—' },
          ].map(k => (
            <div key={k.label} style={{
              background: '#fff', border: '1px solid #ece8e1', borderRadius: 12,
              padding: '14px 20px', minWidth: 110
            }}>
              <div style={{ fontSize: 11, color: '#999', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>{k.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #ece8e1', marginBottom: 32, overflowX: 'auto' }}>
        {ABAS.map(aba => (
          <button
            key={aba}
            onClick={() => setAbaAtiva(aba)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '12px 20px', fontSize: 13, fontWeight: abaAtiva === aba ? 700 : 400,
              color: abaAtiva === aba ? '#b0956a' : '#888',
              borderBottom: abaAtiva === aba ? '2px solid #b0956a' : '2px solid transparent',
              marginBottom: -2, whiteSpace: 'nowrap', transition: 'all 0.15s',
            }}
          >
            {aba}
          </button>
        ))}
      </div>

      {/* Conteúdo das abas */}
      {abaAtiva === 'Visão Geral' && <AbaVisaoGeral obra={obra} />}
      {abaAtiva === 'Tarefas' && (
        <AbaTarefas
          tarefas={tarefas}
          loading={loadingTarefas}
          showForm={showFormTarefa}
          setShowForm={setShowFormTarefa}
          novaTarefa={novaTarefa}
          setNovaTarefa={setNovaTarefa}
          profiles={profiles}
          onSalvar={salvarTarefa}
          salvando={salvandoTarefa}
          onMudarStatus={mudarStatus}
          progresso={progresso}
        />
      )}
      {!['Visão Geral', 'Tarefas'].includes(abaAtiva) && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#bbb', fontSize: 15 }}>
          Módulo <strong style={{ color: '#b0956a' }}>{abaAtiva}</strong> em desenvolvimento.
        </div>
      )}
    </div>
  )
}

/* ─── Aba Visão Geral ─── */
function AbaVisaoGeral({ obra }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <Card titulo="Informações do Cliente">
        <Info label="Nome" value={obra.cliente_nome} />
        <Info label="E-mail" value={obra.cliente_email} />
        <Info label="Telefone" value={obra.cliente_telefone} />
      </Card>
      <Card titulo="Informações da Obra">
        <Info label="Endereço" value={obra.endereco} />
        <Info label="Cidade" value={obra.cidade} />
        <Info label="Responsável Comercial" value={obra.comercial_nome} />
      </Card>
      {obra.observacoes && (
        <Card titulo="Observações" style={{ gridColumn: '1 / -1' }}>
          <p style={{ margin: 0, fontSize: 14, color: '#555', lineHeight: 1.7 }}>{obra.observacoes}</p>
        </Card>
      )}
    </div>
  )
}

/* ─── Aba Tarefas ─── */
function AbaTarefas({ tarefas, loading, showForm, setShowForm, novaTarefa, setNovaTarefa, profiles, onSalvar, salvando, onMudarStatus, progresso }) {
  const total = tarefas.length
  const concluidas = tarefas.filter(t => t.status === 'concluida').length

  return (
    <div>
      {/* Barra de progresso por tarefas */}
      {total > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#888', marginBottom: 6 }}>
            <span>{concluidas} de {total} tarefas concluídas</span>
            <span style={{ fontWeight: 700, color: '#b0956a' }}>{progresso}%</span>
          </div>
          <div style={{ background: '#ece8e1', borderRadius: 8, height: 6 }}>
            <div style={{ background: '#b0956a', borderRadius: 8, height: 6, width: `${progresso}%`, transition: 'width 0.4s' }} />
          </div>
        </div>
      )}

      {/* Botão nova tarefa */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 8,
            padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8
          }}
        >
          {showForm ? '✕ Cancelar' : '+ Nova Tarefa'}
        </button>
      </div>

      {/* Formulário nova tarefa */}
      {showForm && (
        <div style={{
          background: '#fff', border: '1px solid #ece8e1', borderRadius: 14,
          padding: 24, marginBottom: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', marginBottom: 16, letterSpacing: 0.5 }}>
            NOVA TAREFA
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <Label>Título *</Label>
              <Input
                value={novaTarefa.titulo}
                onChange={e => setNovaTarefa(p => ({ ...p, titulo: e.target.value }))}
                placeholder="Título da tarefa"
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <Label>Descrição</Label>
              <textarea
                value={novaTarefa.descricao}
                onChange={e => setNovaTarefa(p => ({ ...p, descricao: e.target.value }))}
                placeholder="Detalhes da tarefa..."
                rows={3}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 8,
                  border: '1px solid #ddd', fontSize: 13, fontFamily: 'inherit',
                  resize: 'vertical', boxSizing: 'border-box', color: '#1a1a1a'
                }}
              />
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select
                value={novaTarefa.prioridade}
                onChange={e => setNovaTarefa(p => ({ ...p, prioridade: e.target.value }))}
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </Select>
            </div>
            <div>
              <Label>Prazo</Label>
              <Input
                type="date"
                value={novaTarefa.prazo}
                onChange={e => setNovaTarefa(p => ({ ...p, prazo: e.target.value }))}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <Label>Responsável</Label>
              <Select
                value={novaTarefa.responsavel_id}
                onChange={e => setNovaTarefa(p => ({ ...p, responsavel_id: e.target.value }))}
              >
                <option value="">Sem responsável</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
                ))}
              </Select>
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={onSalvar}
              disabled={salvando || !novaTarefa.titulo.trim()}
              style={{
                background: salvando ? '#ccc' : '#b0956a',
                color: '#fff', border: 'none', borderRadius: 8,
                padding: '10px 24px', fontSize: 13, fontWeight: 700,
                cursor: salvando ? 'not-allowed' : 'pointer'
              }}
            >
              {salvando ? 'Salvando...' : 'Criar Tarefa'}
            </button>
          </div>
        </div>
      )}

      {/* Lista de tarefas */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#bbb' }}>Carregando tarefas...</div>
      ) : tarefas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#bbb' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
          <div>Nenhuma tarefa criada ainda.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tarefas.map(t => (
            <CardTarefa key={t.id} tarefa={t} onMudarStatus={onMudarStatus} />
          ))}
        </div>
      )}
    </div>
  )
}

function CardTarefa({ tarefa, onMudarStatus }) {
  const st = STATUS_TAREFA[tarefa.status] || STATUS_TAREFA.pendente
  const pr = PRIORIDADE[tarefa.prioridade] || PRIORIDADE.media
  const [mudando, setMudando] = useState(false)

  async function handleStatus(e) {
    setMudando(true)
    await onMudarStatus(tarefa.id, e.target.value)
    setMudando(false)
  }

  return (
    <div style={{
      background: '#fff', border: '1px solid #ece8e1', borderRadius: 12,
      padding: '16px 20px', display: 'flex', alignItems: 'flex-start',
      gap: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
    }}>
      {/* Indicador de prioridade */}
      <div style={{ width: 4, borderRadius: 4, alignSelf: 'stretch', background: pr.color, flexShrink: 0 }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{tarefa.titulo}</span>
          <span style={{
            fontSize: 11, padding: '2px 10px', borderRadius: 20,
            background: st.color + '18', color: st.color, fontWeight: 600
          }}>
            {st.label}
          </span>
        </div>
        {tarefa.descricao && (
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#777', lineHeight: 1.5 }}>{tarefa.descricao}</p>
        )}
        <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
          {tarefa.prazo && (
            <span style={{ fontSize: 12, color: '#999' }}>
              📅 {new Date(tarefa.prazo).toLocaleDateString('pt-BR')}
            </span>
          )}
          {tarefa.responsavel?.full_name && (
            <span style={{ fontSize: 12, color: '#999' }}>
              👤 {tarefa.responsavel.full_name}
            </span>
          )}
          <span style={{ fontSize: 12, color: pr.color, fontWeight: 500 }}>
            ● {pr.label}
          </span>
        </div>
      </div>

      {/* Seletor de status */}
      <select
        value={tarefa.status}
        onChange={handleStatus}
        disabled={mudando}
        style={{
          fontSize: 12, padding: '6px 10px', borderRadius: 8,
          border: '1px solid #ddd', background: '#fafaf8',
          color: st.color, fontWeight: 600, cursor: 'pointer',
          flexShrink: 0
        }}
      >
        {Object.entries(STATUS_TAREFA).map(([val, { label }]) => (
          <option key={val} value={val}>{label}</option>
        ))}
      </select>
    </div>
  )
}

/* ─── Componentes auxiliares ─── */
function Card({ titulo, children, style = {} }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #ece8e1', borderRadius: 14,
      padding: '20px 24px', ...style
    }}>
      <div style={{ fontSize: 11, letterSpacing: 1.5, color: '#b0956a', textTransform: 'uppercase', fontWeight: 700, marginBottom: 14 }}>
        {titulo}
      </div>
      {children}
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: '#aaa', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: '#1a1a1a', fontWeight: 500 }}>{value || '—'}</div>
    </div>
  )
}

function Label({ children }) {
  return <div style={{ fontSize: 12, color: '#888', marginBottom: 6, fontWeight: 500 }}>{children}</div>
}

function Input({ ...props }) {
  return (
    <input
      {...props}
      style={{
        width: '100%', padding: '10px 14px', borderRadius: 8,
        border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box',
        fontFamily: 'inherit', color: '#1a1a1a', ...props.style
      }}
    />
  )
}

function Select({ children, ...props }) {
  return (
    <select
      {...props}
      style={{
        width: '100%', padding: '10px 14px', borderRadius: 8,
        border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box',
        fontFamily: 'inherit', color: '#1a1a1a', background: '#fff'
      }}
    >
      {children}
    </select>
  )
}