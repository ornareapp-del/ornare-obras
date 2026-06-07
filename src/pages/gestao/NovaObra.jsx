import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function NovaObra() {
  const navigate = useNavigate()
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({
    nome: '', cliente_nome: '', cliente_email: '', cliente_telefone: '',
    endereco: '', cidade: '', comercial_nome: '', valor_contrato: '',
    data_inicio: '', data_previsao: '', status: 'Planejamento', observacoes: '', progresso: 0,
  })

  function set(k, v) { setForm(p => ({ ...p, [k]: v })) }

  async function salvar() {
    if (!form.nome.trim() || !form.cliente_nome.trim()) return
    setSalvando(true)
    const { data, error } = await supabase.from('obras').insert([{
      ...form,
      valor_contrato: form.valor_contrato ? parseFloat(form.valor_contrato) : null,
      data_inicio: form.data_inicio || null,
      data_previsao: form.data_previsao || null,
      progresso: parseInt(form.progresso) || 0,
    }]).select().single()
    setSalvando(false)
    if (!error && data) navigate(`/obras/${data.id}`)
  }

  return (
    <div style={{ padding: '40px 48px', maxWidth: 800, margin: '0 auto' }}>
      <button onClick={() => navigate('/obras')} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--color-ink-muted)', cursor: 'pointer', padding: 0, marginBottom: 16 }}>
        ← Obras
      </button>
      <div style={{ fontSize: 9, letterSpacing: 3, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 8 }}>Gestão</div>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 500, color: 'var(--color-ink)', margin: '0 0 32px' }}>Nova Obra</h1>

      <div style={{ display: 'grid', gap: 20 }}>
        <Secao titulo="Identificação">
          <Grid>
            <Campo label="Nome da Obra *"><FInput value={form.nome} onChange={v => set('nome', v)} placeholder="Ex: Residência Silva" /></Campo>
            <Campo label="Status">
              <FSelect value={form.status} onChange={v => set('status', v)}>
                <option>Planejamento</option>
                <option>Em andamento</option>
                <option>Em montagem</option>
                <option>Pausada</option>
                <option>Concluída</option>
                <option>Cancelada</option>
              </FSelect>
            </Campo>
            <Campo label="Data Início"><FInput type="date" value={form.data_inicio} onChange={v => set('data_inicio', v)} /></Campo>
            <Campo label="Data Previsão"><FInput type="date" value={form.data_previsao} onChange={v => set('data_previsao', v)} /></Campo>
            <Campo label="Valor do Contrato (R$)"><FInput type="number" value={form.valor_contrato} onChange={v => set('valor_contrato', v)} placeholder="0,00" /></Campo>
            <Campo label="Progresso (%)"><FInput type="number" value={form.progresso} onChange={v => set('progresso', v)} placeholder="0" /></Campo>
          </Grid>
        </Secao>

        <Secao titulo="Cliente">
          <Grid>
            <Campo label="Nome do Cliente *" full><FInput value={form.cliente_nome} onChange={v => set('cliente_nome', v)} placeholder="Nome completo" /></Campo>
            <Campo label="E-mail"><FInput type="email" value={form.cliente_email} onChange={v => set('cliente_email', v)} placeholder="email@exemplo.com" /></Campo>
            <Campo label="Telefone"><FInput value={form.cliente_telefone} onChange={v => set('cliente_telefone', v)} placeholder="(48) 99999-9999" /></Campo>
          </Grid>
        </Secao>

        <Secao titulo="Localização">
          <Grid>
            <Campo label="Endereço" full><FInput value={form.endereco} onChange={v => set('endereco', v)} placeholder="Rua, número, complemento" /></Campo>
            <Campo label="Cidade"><FInput value={form.cidade} onChange={v => set('cidade', v)} placeholder="Cidade - UF" /></Campo>
            <Campo label="Responsável Comercial"><FInput value={form.comercial_nome} onChange={v => set('comercial_nome', v)} placeholder="Nome" /></Campo>
          </Grid>
        </Secao>

        <Secao titulo="Observações">
          <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} rows={4} placeholder="Informações adicionais sobre a obra..." style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
        </Secao>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 8 }}>
          <button onClick={() => navigate('/obras')} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 22px', fontSize: 13, cursor: 'pointer', color: 'var(--color-ink-muted)' }}>
            Cancelar
          </button>
          <button onClick={salvar} disabled={salvando || !form.nome.trim() || !form.cliente_nome.trim()} style={{ background: salvando ? '#ccc' : 'var(--color-ink)', color: '#f9f7f4', border: 'none', borderRadius: 8, padding: '10px 28px', fontSize: 13, fontWeight: 600, cursor: salvando ? 'not-allowed' : 'pointer' }}>
            {salvando ? 'Salvando...' : 'Criar Obra'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Secao({ titulo, children }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: '20px 24px' }}>
      <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 16 }}>{titulo}</div>
      {children}
    </div>
  )
}
function Grid({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>{children}</div>
}
function Campo({ label, children, full }) {
  return <div style={{ gridColumn: full ? '1/-1' : undefined }}><div style={{ fontSize: 11, color: '#888', marginBottom: 5, fontWeight: 500 }}>{label}</div>{children}</div>
}
function FInput({ onChange, ...props }) {
  return <input {...props} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }} />
}
function FSelect({ onChange, children, ...props }) {
  return <select {...props} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff' }}>{children}</select>
}