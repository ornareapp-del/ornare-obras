import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useStore } from './store/useStore'
import Login from './pages/Login'
import Layout from './components/Layout'
import DashboardGestao from './pages/gestao/DashboardGestao'
import Obras from './pages/gestao/Obras'
import ObraDetalhe from './pages/gestao/ObraDetalhe'
import Agenda from './pages/gestao/Agenda'
import Equipe from './pages/gestao/Equipe'
import Ocorrencias from './pages/gestao/Ocorrencias'
import Gastos from './pages/gestao/Gastos'
import Tarefas from './pages/gestao/Tarefas'
import NovaObra from './pages/gestao/NovaObra'
import PortalCliente from './pages/cliente/PortalCliente'
// dentro do <Route element={<PrivateLayout />}>:
function AppRoutes() {
  return (
    <Routes>
      {/* Aqui dentro você coloca as rotas do seu layout privado */}
      <Route element={<PrivateLayout />}>
        <Route path="/obras/nova" element={<NovaObra />} />
        <Route path="/cliente/:id" element={<PortalCliente />} />
      </Route>
    </Routes>
  );
}

function PrivateLayout() {
  const { user } = useStore()
  if (!user) return <Navigate to="/login" />
  return <Layout />
}

function App() {
  const { user, setUser, setProfile } = useStore()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) { setUser(session.user); fetchProfile(session.user.id) }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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
        <Route element={<PrivateLayout />}>
          <Route path="/" element={<DashboardGestao />} />
          <Route path="/obras" element={<Obras />} />
          <Route path="/obras/:id" element={<ObraDetalhe />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/equipe" element={<Equipe />} />
          <Route path="/ocorrencias" element={<Ocorrencias />} />
          <Route path="/gastos" element={<Gastos />} />
          <Route path="/tarefas" element={<Tarefas />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App