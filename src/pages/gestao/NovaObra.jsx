import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const STATUS_LIST = [
  'Aguardando início','Medição agendada','Em medição',
  'Projeto em conferência','Em produção','Pronta para entrega',
  'Aguardando montagem','Montagem agendada','Em montagem',
  'Pausada','Vistoria final','Concluída','Cancelada'
]

const AMBIENTES_PADRAO = ['Cozinha','Living','Suíte','Closet','Banheiro','Lavabo','Escritório','Gourmet']

export default function NovaObra() {
  const navigate = useNavigate()
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const [ambientesSel, setAmbientesSel] = useState([])
  const [ambienteCustom, setAmbienteCustom] = useState('')
  const [form, setForm] = useState({
    nome: '', cliente_nome: '', cliente_email: '', cliente_telefone: '',
    endereco: '', cidade: '', comercial_nome: '', valor_contrato: '',
    data_inicio: '', data_previsao: '', status: 'Aguardando início',
    observacoes: '', progresso: 0,
  })

  function set(k, v) { setForm(p => ({ ...p, [k]: v })) }

  function toggleAmbiente(a) {
    setAmbientesSel(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])
  }

  function addCustom() {
    if (!ambienteCustom.trim()) return
    setAmbientesSel(prev => [...prev, ambienteCustom.trim()])
    setAmbienteCustom('')
  }

  async function salvar() {
    if (!form.nome.trim()) { setErro('Nome da obra é obrigatório.'); return }
    if (!form.cliente_nome.trim()) { setErro('Nome do cliente é obrigatório.'); return }
    setErro('')
    setSalvando(true)

    const { data, error } = await supabase.from('obras').insert([{
      nome: form.nome,
      cliente_nome: form.cliente_nome,
      cliente_email: form.cliente_email || null,
      cliente_telefone: form.cliente_telefone || null,
      endereco: form.endereco || null,
      cidade: form.cidade || null,
      comercial_nome: form.comercial_nome || null,
      valor_contrato: form.valor_contrato ? parseFloat(form.valor_contrato) : null,
      data_inicio: form.data_inicio || null,
      data_previsao: form.data_previsao || null,
      status: form.status,
      observacoes: form.observacoes || null,
      progresso: 0,
    }]).select().single()

    if (error) {
      setErro(`Erro ao salvar: ${error.message}`)
      setSalvando(false)
      return
    }

    if (ambientesSel.length > 0) {
      await supabase.from('obra_ambientes').insert(
        ambientesSel.map((nome, i) => ({ obra_id: data.id, nome, ordem: i, status: 'nao_iniciado' }))
      )
    }

    setSalvando(false)
    setSucesso(true)
    setTimeout(() => navigate(`/obras/${data.id}`), 1200)
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 780, margin: '0 auto' }}>
      <button onClick={() => navigate('/obras')} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--ink-3)', cursor: 'pointer', padding: 0, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
        ← Obras
      </button>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-title)', fontSize: 28, fontWeight: 500, color: 'var(--ink)', margin: 0 }}>Nova Obra</h1>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>Preencha os dados para cadastrar uma nova obra</p>
      </div>

      {sucesso && (
        <div style={{ background: 'var(--green-light)', border: '1px solid #A5D6A7', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 8 }}>
          ✓ Obra criada com sucesso! Redirecionando...
        </div>
      )}

      {erro && (
        <div style={{ background: 'var(--red-light)', border: '1px solid #EF9A9A', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: 'var(--red)' }}>
          ⚠ {erro}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Secao titulo="Identificação">
          <Grid>
            <Campo label="Nome da Obra *" full><FInput value={form.nome} onChange={v => set('nome', v)} placeholder="Ex: Residência Silva" /></Campo>
            <Campo label="Status">
              <FSelect value={form.status} onChange={v => set('status', v)}>
                {STATUS_LIST.map(s => <option key={s}>{s}</option>)}
              </FSelect>
            </Campo>
            <Campo label="Data Início"><FInput type="date" value={form.data_inicio} onChange={v => set('data_inicio', v)} /></Campo>
            <Campo label="Data Previsão"><FInput type="date" value={form.data_previsao} onChange={v => set('data_previsao', v)} /></Campo>
            <Campo label="Valor do Contrato (R$)"><FInput type="number" value={form.valor_contrato} onChange={v => set('valor_contrato', v)} placeholder="0,00" /></Campo>
            <Campo label="Responsável Comercial"><FInput value={form.comercial_nome} onChange={v => set('comercial_nome', v)} placeholder="Nome" /></Campo>
          </Grid>
        </Secao>

        <Secao titulo="Cliente">
          <Grid>
            <Campo label="Nome *" full><FInput value={form.cliente_nome} onChange={v => set('cliente_nome', v)} placeholder="Nome completo" /></Campo>
            <Campo label="E-mail"><FInput type="email" value={form.cliente_email} onChange={v => set('cliente_email', v)} placeholder="email@exemplo.com" /></Campo>
            <Campo label="Telefone"><FInput value={form.cliente_telefone} onChange={v => set('cliente_telefone', v)} placeholder="(48) 99999-9999" /></Campo>
          </Grid>
        </Secao>

        <Secao titulo="Localização">
          <Grid>
            <Campo label="Endereço" full><FInput value={form.endereco} onChange={v => set('endereco', v)} placeholder="Rua, número, complemento" /></Campo>
            <Campo label="Cidade"><FInput value={form.cidade} onChange={v => set('cidade', v)} placeholder="Cidade - UF" /></Campo>
          </Grid>
        </Secao>

        <Secao titulo="Ambientes da Obra">
          <p style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 14 }}>Selecione os ambientes que serão montados. O progresso será calculado automaticamente.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {AMBIENTES_PADRAO.map(a => (
              <button key={a} onClick={() => toggleAmbiente(a)} style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12.5, cursor: 'pointer', border: 'none',
                background: ambientesSel.includes(a) ? 'var(--blue)' : 'var(--border-light)',
                color: ambientesSel.includes(a) ? '#fff' : 'var(--ink-3)',
                fontWeight: ambientesSel.includes(a) ? 500 : 400,
                transition: 'all 0.15s',
              }}>{a}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <FInput value={ambienteCustom} onChange={setAmbienteCustom} placeholder="Outro ambiente..." />
            <button onClick={addCustom} style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 8, padding: '0 16px', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>Adicionar</button>
          </div>
          {ambientesSel.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ambientesSel.map(a => (
                <span key={a} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: 'var(--blue-light)', color: 'var(--blue)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {a}
                  <span onClick={() => setAmbientesSel(p => p.filter(x => x !== a))} style={{ cursor: 'pointer', opacity: 0.6, fontSize: 14 }}>×</span>
                </span>
              ))}
            </div>
          )}
        </Secao>

        <Secao titulo="Observações">
          <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} rows={3} placeholder="Informações adicionais..." style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', color: 'var(--ink)' }} />
        </Secao>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 4 }}>
          <button onClick={() => navigate('/obras')} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 22px', fontSize: 13, cursor: 'pointer', color: 'var(--ink-3)' }}>
            Cancelar
          </button>
          <button onClick={salvar} disabled={salvando} style={{
            background: salvando ? '#93C5FD' : 'var(--blue)',
            color: '#fff', border: 'none', borderRadius: 8,
            padding: '10px 28px', fontSize: 13, fontWeight: 600,
            cursor: salvando ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {salvando ? '⏳ Salvando...' : '✓ Criar Obra'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Secao({ titulo, children }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>{titulo}</div>
      {children}
    </div>
  )
}
function Grid({ children }) { return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>{children}</div> }
function Campo({ label, children, full }) { return <div style={{ gridColumn: full ? '1/-1' : undefined }}><div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 5, fontWeight: 500 }}>{label}</div>{children}</div> }
function FInput({ onChange, ...props }) { return <input {...props} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', color: 'var(--ink)', background: '#fff' }} /> }
function FSelect({ onChange, children, ...props }) { return <select {...props} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', color: 'var(--ink)', background: '#fff' }}>{children}</select> }