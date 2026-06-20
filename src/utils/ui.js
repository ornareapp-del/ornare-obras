export function limparNome(nome) {
  if (!nome) return ''
  const roles = ['Montador', 'Supervisor', 'Gestao', 'Gestão', 'Vendedor', 'Cliente', 'Pos_venda', 'Pós-venda']
  const partes = String(nome).trim().split(/\s+/)
  if (roles.includes(partes[partes.length - 1])) {
    return partes.slice(0, -1).join(' ')
  }
  return String(nome).trim()
}

export const progressBarStyle = {
  height: 6,
  background: '#E8E4DE',
  borderRadius: 999,
  overflow: 'hidden',
}

export const progressFillStyle = {
  height: '100%',
  background: '#C9A96E',
  borderRadius: 999,
}

export const statusBadgeBaseStyle = {
  borderRadius: 999,
  padding: '4px 10px',
  fontSize: 11,
  fontWeight: 700,
  lineHeight: 1,
}
