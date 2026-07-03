const TIPOS_PDF = [
  { value: 'executivo', label: 'Executivo' },
  { value: 'operacional', label: 'Operacional' },
  { value: 'cliente', label: 'Cliente' },
  { value: 'financeiro', label: 'Financeiro interno' },
]

export default function ObraPdfExportControls({
  tipoPdf,
  setTipoPdf,
  gerarPdf,
  exportandoPdf,
  statusPdf,
  compacto,
  acaoBtn,
  theme,
}) {
  return (
    <>
      <select
        value={tipoPdf}
        onChange={e => setTipoPdf(e.target.value)}
        style={{
          background: theme.inputBackground,
          border: '1px solid ' + theme.inputBorder,
          color: theme.inputText,
          borderRadius: 8,
          padding: '10px 14px',
          width: '100%',
          fontSize: 14,
          outline: 'none',
          fontWeight: 700,
          fontFamily: 'inherit',
        }}
      >
        {TIPOS_PDF.map(tipo => <option key={tipo.value} value={tipo.value}>{tipo.label}</option>)}
      </select>
      <button
        onClick={gerarPdf}
        disabled={exportandoPdf}
        style={{
          ...acaoBtn(false),
          minHeight: 44,
          cursor: exportandoPdf ? 'not-allowed' : 'pointer',
          opacity: exportandoPdf ? 0.65 : 1,
        }}
      >
        {exportandoPdf ? 'Gerando PDF...' : 'Exportar PDF'}
      </button>
      {statusPdf && (
        <div
          style={{
            flexBasis: '100%',
            color: statusPdf.includes('Nao foi possivel') ? theme.danger : theme.muted,
            fontSize: 12,
            fontWeight: 700,
            textAlign: compacto ? 'left' : 'right',
          }}
        >
          {statusPdf}
        </div>
      )}
    </>
  )
}
