import { useState, useEffect } from 'react'
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
  const [ambientesSel, setAmbientesSel] = useState([])
  const [ambienteCustom, setAmbienteCustom] = useState('')
  const [supervisores, setSupervisores] = useState([])
  const [form, setForm] = useState({
    nome: '',
    numero_contrato: '',
    pedido_ornare: '',
    cliente_nome: '',
    cliente_email: '',
    cliente_telefone: '',
    rua: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    cep: '',
    supervisor_id: '',
    comercial_nome: '',
    valor_contrato: '',
    data_inicio: '',
    data_previsao: '',
    status: 'Aguardando início',
    observacoes: '',
    arquiteto_nome: '',
arquiteto_email: '',
arquiteto_telefone: '',
gasto_meta: '',
  })

  useEffect(() => {
    supabase.from('profiles')
      .select('id, full_name')
      .eq('role', 'supervisor')
      .then(({ data }) => setSupervisores(data || []))
  }, [])

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

    const endereco_completo = [form.rua, form.numero, form.complemento, form.bairro, form.cidade, form.uf, form.cep]
      .filter(Boolean).join(', ')

    const { data, error } = await supabase.from('obras').insert([{
      nome: form.nome,
      numero_contrato: form.numero_contrato || null,
      pedido_ornare: form.pedido_ornare || null,
      cliente_nome: form.cliente_nome,
      cliente_email: form.cliente_email || null,
      cliente_telefone: form.cliente_telefone || null,
      endereco: endereco_completo || null,
      rua: form.rua || null,
      numero: form.numero || null,
      complemento: form.complemento || null,
      bairro: form.bairro || null,
      cidade: form.cidade || null,
      uf: form.uf || null,
      cep: form.cep || null,
      supervisor_id: form.supervisor_id || null,
      comercial_nome: form.comercial_nome || null,
      valor_contrato: form.valor_contrato ? parseFloat(form.valor_contrato) : null,
      data_inicio: form.data_inicio || null,
      data_previsao: form.data_previsao || null,
      status: form.status,
      observacoes: form.observacoes || null,
      progresso: 0,
      arquiteto_nome: form.arquiteto_nome || null,
arquiteto_email: form.arquiteto_email || null,
arquiteto_telefone: form.arquiteto_telefone || null,
gasto_meta: form.gasto_meta ? parseFloat(form.gasto_meta) : null,
    }]).select().single()

    if (error) { setErro(`Erro: ${error.message}`); setSalvando(false); return }

    if (ambientesSel.length > 0) {
      await supabase.from('obra_ambientes').insert(
        ambientesSel.map((nome, i) => ({ obra_id: data.id, nome, ordem: i, status: 'nao_iniciado' }))
      )
    }

    setSalvando(false)
    navigate(`/obras/${data.id}`)
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.back} onClick={() => navigate('/obras')}>← Obras</button>
        <div>
          <div style={s.breadcrumb}>Gestão</div>
          <h1 style={s.title}>Nova Obra</h1>
        </div>
      </div>

      {erro && <div style={s.erro}>{erro}</div>}

      <div style={s.sections}>

        {/* Identificação */}
        <Secao titulo="Identificação da Obra">
          <Grid>
            <Campo label="Nome da obra *" full>
              <FInput value={form.nome} onChange={v => set('nome', v)} placeholder="Ex: Suíte Master — Res. Alves" />
            </Campo>
            <Campo label="Número do Contrato">
              <FInput value={form.numero_contrato} onChange={v => set('numero_contrato', v)} placeholder="Ex: 078/2026" />
            </Campo>
            <Campo label="Pedido Ornare">
              <FInput value={form.pedido_ornare} onChange={v => set('pedido_ornare', v)} placeholder="Ex: PED-2026-001" />
            </Campo>
            <Campo label="Status">
              <FSelect value={form.status} onChange={v => set('status', v)}>
                {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
              </FSelect>
            </Campo>
            <Campo label="Supervisor responsável">
              <FSelect value={form.supervisor_id} onChange={v => set('supervisor_id', v)}>
                <option value="">— Selecione —</option>
                {supervisores.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </FSelect>
            </Campo>
          </Grid>
        </Secao>

        {/* Cliente */}
        <Secao titulo="Dados do Cliente">
          <Grid>
            <Campo label="Nome do cliente *" full>
              <FInput value={form.cliente_nome} onChange={v => set('cliente_nome', v)} placeholder="Nome completo" />
            </Campo>
            <Campo label="E-mail">
              <FInput type="email" value={form.cliente_email} onChange={v => set('cliente_email', v)} placeholder="email@exemplo.com" />
            </Campo>
            <Campo label="Telefone">
              <FInput value={form.cliente_telefone} onChange={v => set('cliente_telefone', v)} placeholder="(48) 99999-9999" />
            </Campo>
            <Campo label="Comercial responsável">
              <FInput value={form.comercial_nome} onChange={v => set('comercial_nome', v)} placeholder="Nome do vendedor" />
            </Campo>
            <Campo label="Valor do contrato (R$)">
              <FInput value={form.valor_contrato} onChange={v => set('valor_contrato', v)} placeholder="0,00" />
            </Campo>
          </Grid>
        </Secao>

        {/* Arquiteto */}
<Secao titulo="Arquiteto Responsável">
  <Grid>
    <Campo label="Nome do arquiteto">
      <FInput value={form.arquiteto_nome} onChange={v => set('arquiteto_nome', v)} placeholder="Nome completo" />
    </Campo>
    <Campo label="E-mail">
      <FInput type="email" value={form.arquiteto_email} onChange={v => set('arquiteto_email', v)} placeholder="email@exemplo.com" />
    </Campo>
    <Campo label="Telefone">
      <FInput value={form.arquiteto_telefone} onChange={v => set('arquiteto_telefone', v)} placeholder="(48) 99999-9999" />
    </Campo>
    <Campo label="Gasto máximo previsto (R$)">
      <FInput value={form.gasto_meta} onChange={v => set('gasto_meta', v)} placeholder="0,00" />
    </Campo>
  </Grid>
</Secao>

        {/* Endereço */}
        <Secao titulo="Endereço da Obra">
          <Grid>
            <Campo label="CEP">
              <FInput value={form.cep} onChange={v => set('cep', v)} placeholder="00000-000" />
            </Campo>
            <Campo label="Rua / Logradouro">
              <FInput value={form.rua} onChange={v => set('rua', v)} placeholder="Rua, Avenida..." />
            </Campo>
            <Campo label="Número">
              <FInput value={form.numero} onChange={v => set('numero', v)} placeholder="Ex: 340" />
            </Campo>
            <Campo label="Complemento">
              <FInput value={form.complemento} onChange={v => set('complemento', v)} placeholder="Apto, Bloco..." />
            </Campo>
            <Campo label="Bairro">
              <FInput value={form.bairro} onChange={v => set('bairro', v)} placeholder="Bairro" />
            </Campo>
            <Campo label="Cidade">
              <FInput value={form.cidade} onChange={v => set('cidade', v)} placeholder="Cidade" />
            </Campo>
            <Campo label="UF">
              <FSelect value={form.uf} onChange={v => set('uf', v)}>
                <option value="">—</option>
                {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </FSelect>
            </Campo>
          </Grid>
        </Secao>

        {/* Cronograma */}
        <Secao titulo="Cronograma">
          <Grid>
            <Campo label="Data de início">
              <FInput type="date" value={form.data_inicio} onChange={v => set('data_inicio', v)} />
            </Campo>
            <Campo label="Previsão de término">
              <FInput type="date" value={form.data_previsao} onChange={v => set('data_previsao', v)} />
            </Campo>
          </Grid>
        </Secao>

        {/* Ambientes */}
        <Secao titulo="Ambientes">
          <div style={s.ambienteGrid}>
            {AMBIENTES_PADRAO.map(a => (
              <div key={a} onClick={() => toggleAmbiente(a)} style={{
                ...s.ambienteTag,
                background: ambientesSel.includes(a) ? 'var(--color-ink)' : '#fff',
                color: ambientesSel.includes(a) ? '#f9f7f4' : 'var(--color-ink-muted)',
                border: ambientesSel.includes(a) ? 'none' : '1px solid var(--color-border)',
              }}>
                {a}
              </div>
            ))}
          </div>
          {ambientesSel.filter(a => !AMBIENTES_PADRAO.includes(a)).map(a => (
            <div key={a} style={{ ...s.ambienteTag, background: 'var(--color-ink)', color: '#f9f7f4', border: 'none', display: 'inline-flex', marginRight: 6, marginTop: 6 }}>
              {a} <span style={{ marginLeft: 6, cursor: 'pointer' }} onClick={() => toggleAmbiente(a)}>×</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <FInput value={ambienteCustom} onChange={setAmbienteCustom} placeholder="Outro ambiente..." />
            <button style={s.btnAdd} onClick={addCustom}>+ Adicionar</button>
          </div>
        </Secao>

        {/* Observações */}
        <Secao titulo="Observações Internas">
          <textarea
            value={form.observacoes}
            onChange={e => set('observacoes', e.target.value)}
            placeholder="Informações adicionais, acessos, contatos extras..."
            style={{ ...s.textarea }} />
        </Secao>

      </div>

      <div style={s.footer}>
        <button style={s.btnCancel} onClick={() => navigate('/obras')}>Cancelar</button>
        <button style={s.btnSave} onClick={salvar} disabled={salvando}>
          {salvando ? 'Salvando...' : '✓ Criar Obra'}
        </button>
      </div>
    </div>
  )
}

function Secao({ titulo, children }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: '20px 24px' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-gold)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16 }}>{titulo}</div>
      {children}
    </div>
  )
}
function Grid({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>{children}</div>
}
function Campo({ label, children, full }) {
  return (
    <div style={{ gridColumn: full ? '1/-1' : undefined }}>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 5, fontWeight: 500 }}>{label}</div>
      {children}
    </div>
  )
}
function FInput({ onChange, ...props }) {
  return <input {...props} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 7, border: '1px solid var(--color-border)', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', color: 'var(--color-ink)', background: '#fafaf8' }} />
}
function FSelect({ onChange, children, ...props }) {
  return <select {...props} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 7, border: '1px solid var(--color-border)', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', color: 'var(--color-ink)', background: '#fafaf8' }}>{children}</select>
}

const s = {
  page: { padding: '32px 40px', maxWidth: 800, margin: '0 auto' },
  header: { marginBottom: 28 },
  back: { background: 'none', border: 'none', fontSize: 12, color: '#888', cursor: 'pointer', padding: 0, marginBottom: 12 },
  breadcrumb: { fontSize: 9, letterSpacing: 3, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 6 },
  title: { fontFamily: 'var(--font-serif)', fontSize: 36, fontWeight: 500, color: 'var(--color-ink)', margin: 0 },
  sections: { display: 'flex', flexDirection: 'column', gap: 16 },
  erro: { background: '#fceee9', borderLeft: '3px solid #c4421e', color: '#5c2010', padding: '10px 14px', borderRadius: 6, fontSize: 12, marginBottom: 16 },
  ambienteGrid: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  ambienteTag: { padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', transition: 'all .15s' },
  textarea: { width: '100%', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', color: 'var(--color-ink)', background: '#fafaf8', height: 80, resize: 'vertical', boxSizing: 'border-box' },
  btnAdd: { background: 'var(--color-ink)', color: '#f9f7f4', border: 'none', borderRadius: 7, padding: '8px 14px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--color-border)' },
  btnCancel: { background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer', color: '#888' },
  btnSave: { background: 'var(--color-blue)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
}