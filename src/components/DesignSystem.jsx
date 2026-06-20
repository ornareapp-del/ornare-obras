const STATUS = {
  success: { label: 'Concluído', color: 'var(--status-success)', bg: 'rgba(45,122,74,.12)' },
  warning: { label: 'Atenção', color: 'var(--status-warning)', bg: 'rgba(163,111,34,.13)' },
  danger: { label: 'Crítico', color: 'var(--status-danger)', bg: 'rgba(184,64,64,.12)' },
  info: { label: 'Informativo', color: 'var(--status-info)', bg: 'rgba(54,92,125,.12)' },
  gold: { label: 'Ornare', color: 'var(--status-gold)', bg: 'rgba(184,150,94,.14)' },
}

function toneStyle(tone = 'gold') {
  return STATUS[tone] || STATUS.gold
}

export function PageHeader({ eyebrow = 'Ornare Works', title, subtitle, actions }) {
  return (
    <header className="ow-page-header">
      <div>
        <div className="ow-eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="ow-page-actions">{actions}</div>}
    </header>
  )
}

export function SectionTitle({ eyebrow, title, action }) {
  return (
    <div className="ow-section-title">
      <div>
        {eyebrow && <span>{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  )
}

export function PremiumCard({ title, subtitle, action, children, tone = 'gold', className = '' }) {
  return (
    <section className={`ow-premium-card ${className}`} style={{ '--card-tone': toneStyle(tone).color }}>
      {(title || subtitle || action) && (
        <div className="ow-card-head">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function KpiCard({ label, value, helper, title, titulo, valor, detalhe, tone = 'gold', danger }) {
  const finalTone = danger ? 'danger' : tone
  return (
    <div className="ow-kpi-card" style={{ '--kpi-tone': toneStyle(finalTone).color }}>
      <span>{label || title || titulo}</span>
      <strong>{value ?? valor ?? '-'}</strong>
      {(helper || detalhe) && <small>{helper || detalhe}</small>}
    </div>
  )
}

export function StatusBadge({ children, tone = 'info', style, className = '' }) {
  const status = toneStyle(tone)
  return (
    <span className={`ow-status-badge ${className}`} style={{ borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 700, lineHeight: 1, color: status.color, background: status.bg, ...style }}>
      {children || status.label}
    </span>
  )
}

export function ActionButton({ children, variant = 'primary', ...props }) {
  return (
    <button {...props} className={`ow-action-button ${variant} ${props.className || ''}`}>
      {children}
    </button>
  )
}

export function FilterBar({ children }) {
  return <div className="ow-filter-bar">{children}</div>
}

export function EmptyState({ title = 'Nenhum registro encontrado', text, action }) {
  return (
    <div className="ow-empty-state">
      <strong>{title}</strong>
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}
