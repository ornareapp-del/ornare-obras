import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useStore } from './store/useStore'
import Login from './pages/Login'
import Layout from './components/Layout'
import DashboardGestao from './pages/gestao/DashboardGestao'
import Obras from './pages/gestao/Obras'
import ObraDetalhe from './pages/gestao/ObraDetalhe'
import NovaObra from './pages/gestao/NovaObra'
import Agenda from './pages/gestao/Agenda'
import Equipe from './pages/gestao/Equipe'
import Ocorrencias from './pages/gestao/Ocorrencias'
import Gastos from './pages/gestao/Gastos'
import Tarefas from './pages/gestao/Tarefas'
import PortalCliente from './pages/cliente/PortalCliente'
import MontadorDashboard from './pages/montador/MontadorDashboard'

function RootRedirect() {
  const { profile } = useStore()
  if (!profile) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#bbb' }}>Carregando...</div>
  if (profile.role === 'montador') return <Navigate to="/montador" />
  if (profile.role === 'cliente') return <Navigate to="/cliente-area" />
  return <Navigate to="/dashboard" />
}

function PrivateLayout() {
  const { user } = useStore()
  if (!user) return <Navigate to="/login" />
  return <Layout />
}

function PrivateRoute({ children }) {
  const { user } = useStore()
  if (!user) return <Navigate to="/login" />
  return children
}

function App() {
  const { user, setUser, setProfile } = useStore()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) { setUser(session.user); fetchProfile(session.user.id) }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) { setUser(session.user); fetchProfile(session.user.id) }
      else { setUser(null); setProfile(null) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) setProfile(data)
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        <Route path="/cliente/:id" element={<PortalCliente />} />
        <Route path="/" element={user ? <RootRedirect /> : <Navigate to="/login" />} />
        <Route path="/montador" element={<PrivateRoute><MontadorDashboard /></PrivateRoute>} />
        <Route element={<PrivateLayout />}>
          <Route path="/dashboard" element={<DashboardGestao />} />
          <Route path="/obras" element={<Obras />} />
          <Route path="/obras/nova" element={<NovaObra />} />
          <Route path="/obras/:id" element={<ObraDetalhe />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/equipe" element={<Equipe />} />
          <Route path="/ocorrencias" element={<Ocorrencias />} />
          <Route path="/gastos" element={<Gastos />} />
          <Route path="/tarefas" element={<Tarefas />} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App