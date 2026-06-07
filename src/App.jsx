import { useEffect, useState } from 'react'
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
import Splash from './pages/Splash'

function RootRedirect() {
  const { profile } = useStore()
  if (!profile) return null
  if (profile.role === 'montador') return <Navigate to="/montador" replace />
  if (profile.role === 'supervisor') return <Navigate to="/supervisor" replace />
  return <Navigate to="/dashboard" replace />
}

function PrivateLayout() {
  const { user } = useStore()
  if (!user) return <Navigate to="/login" replace />
  return <Layout />
}

function PrivateRoute({ children }) {
  const { user } = useStore()
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const { user, setUser, setProfile } = useStore()
  const [pronto, setPronto] = useState(false)
  const [splashOk, setSplashOk] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
      }
      setPronto(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, session) => {
      if (session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
      } else {
        setUser(null)
        setProfile(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) setProfile(data)
  }

  // Mostra splash até os dois estarem prontos
  const mostrarSplash = !splashOk || !pronto

  if (mostrarSplash) {
    return <Splash onDone={() => setSplashOk(true)} />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
        <Route path="/cliente/:id" element={<PortalCliente />} />
        <Route path="/montador" element={<PrivateRoute><MontadorDashboard /></PrivateRoute>} />
        <Route path="/" element={user ? <RootRedirect /> : <Navigate to="/login" replace />} />
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
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}