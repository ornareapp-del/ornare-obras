import Sidebar from './Sidebar'

export default function Layout({ children }) {
  return (
    <div style={s.page}>
      <Sidebar />
      <main style={s.main}>
        {children}
      </main>
    </div>
  )
}

const s = {
  page: {
    background: '#F7F4EF',
    minHeight: '100vh'
  },
  main: {
    marginLeft: 280,
    padding: '42px 48px',
    boxSizing: 'border-box',
    minHeight: '100vh'
  }
}