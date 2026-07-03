const OBRA_PALETTE = [
  { accent: '#C9A84C', soft: 'rgba(201,168,76,.13)', border: 'rgba(201,168,76,.55)', ink: '#FFE7A6' },
  { accent: '#4F8A68', soft: 'rgba(79,138,104,.15)', border: 'rgba(79,138,104,.52)', ink: '#CFF3DA' },
  { accent: '#4E7BA6', soft: 'rgba(78,123,166,.16)', border: 'rgba(78,123,166,.55)', ink: '#D6E9FF' },
  { accent: '#B66A4A', soft: 'rgba(182,106,74,.15)', border: 'rgba(182,106,74,.52)', ink: '#FFD9C7' },
  { accent: '#7B6AAE', soft: 'rgba(123,106,174,.16)', border: 'rgba(123,106,174,.55)', ink: '#E8DFFF' },
  { accent: '#B98226', soft: 'rgba(185,130,38,.14)', border: 'rgba(185,130,38,.55)', ink: '#FFE0A3' },
  { accent: '#4C8F8A', soft: 'rgba(76,143,138,.15)', border: 'rgba(76,143,138,.52)', ink: '#CFF4F0' },
  { accent: '#A55E7E', soft: 'rgba(165,94,126,.15)', border: 'rgba(165,94,126,.52)', ink: '#FFD7E8' },
]

function hashString(value) {
  const text = String(value || 'obra')
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export function obraColor(obra) {
  const key = obra?.id || obra?.nome || obra?.cliente_nome || 'obra'
  return OBRA_PALETTE[hashString(key) % OBRA_PALETTE.length]
}
