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
    marginLeft: 260,
    padding: 36,
    boxSizing: 'border-box'
  }
}
