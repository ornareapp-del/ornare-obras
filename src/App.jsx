import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useStore } from './store/useStore'

// pages publicas
import Login        from './pages/Login'
import PortalCliente from './pages/cliente/PortalCliente'
import Splash       from './pages/Splash'

// layout com sidebar
import Layout from './components/Layout'

// pages gestao
import DashboardGestao  from './pages/gestao/DashboardGestao'
import Obras            from './pages/gestao/Obras'
import ObraDetalhe      from './pages/gestao/ObraDetalhe'
import NovaObra         from './pages/gestao/NovaObra'
import Agenda           from './pages/gestao/Agenda'
import Equipe           from './pages/gestao/Equipe'
import Ocorrencias      from './pages/gestao/Ocorrencias'
import Gastos           from './pages/gestao/Gastos'
import Tarefas          from './pages/gestao/Tarefas'

// pages por perfil
import DashboardSupervisor from './pages/supervisor/DashboardSupervisor'
import MontadorDashboard   from './pages/montador/MontadorDashboard'

// ─── REDIRECT INICIAL POR ROLE ────────────────────────────────────────────────
function RedirectByRole({ user, profile }) {
  if (!user)    return <Navigate to="/login"   replace />
  if (!profile) return <Navigate to="/dashboard" replace />  // aguarda hydrate

  switch (profile.role) {
    case 'montador':    return <Navigate to="/montador"   replace />
    case 'supervisor':  return <Navigate to="/supervisor" replace />
    case 'vendedor':    return <Navigate to="/obras"      replace />  // vendedor vai direto para obras
    case 'cliente':     return <Navigate to={'/cliente/' + (profile.obra_id || '')} replace />
    default:            return <Navigate to="/dashboard"  replace />  // gestao
  }
}

// ─── GUARDS ───────────────────────────────────────────────────────────────────
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

// Bloqueia acesso a rotas por role.
// allowedRoles: se o role do usuario NAO esta na lista, redireciona.
function RoleGuard({ allowedRoles, children, fallback = '/dashboard' }) {
  const { profile } = useStore()
  if (!profile) return null
  if (!allowedRoles.includes(profile.role)) return <Navigate to={fallback} replace />
  return children
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const { user, profile, setUser, setProfile } = useStore()
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
      }
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

  if (showSplash) return <Splash onDone={() => setShowSplash(false)} />

  return (
    <BrowserRouter>
      <Routes>

        {/* ── PUBLICAS ──────────────────────────────────────────────────── */}
        <Route path="/login"       element={!user ? <Login /> : <Navigate to="/" replace />} />
        <Route path="/cliente/:id" element={<PortalCliente />} />

        {/* ── RAIZ — redireciona por role ───────────────────────────────── */}
        <Route path="/" element={<RedirectByRole user={user} profile={profile} />} />

        {/* ── MONTADOR — layout proprio mobile ──────────────────────────── */}
        <Route
          path="/montador"
          element={
            <PrivateRoute>
              <MontadorDashboard />
            </PrivateRoute>
          }
        />

        {/* ── SIDEBAR LAYOUT — gestao, supervisor, vendedor ─────────────── */}
        <Route element={<PrivateLayout />}>

          {/* Dashboard gestao — apenas gestao */}
          <Route
            path="/dashboard"
            element={
              <RoleGuard allowedRoles={['gestao']} fallback="/supervisor">
                <DashboardGestao />
              </RoleGuard>
            }
          />

          {/* Dashboard supervisor */}
          <Route
            path="/supervisor"
            element={
              <RoleGuard allowedRoles={['supervisor', 'gestao']} fallback="/dashboard">
                <DashboardSupervisor />
              </RoleGuard>
            }
          />

          {/* Obras — gestao, supervisor, vendedor (vendedor ve somente leitura no componente) */}
          <Route path="/obras"       element={<Obras />} />
          <Route path="/obras/nova"  element={
            <RoleGuard allowedRoles={['gestao']} fallback="/obras">
              <NovaObra />
            </RoleGuard>
          } />
          <Route path="/obras/:id"   element={<ObraDetalhe />} />

          {/* Tarefas — gestao, supervisor */}
          <Route
            path="/tarefas"
            element={
              <RoleGuard allowedRoles={['gestao', 'supervisor']} fallback="/obras">
                <Tarefas />
              </RoleGuard>
            }
          />

          {/* Agenda — todos com sidebar */}
          <Route path="/agenda" element={<Agenda />} />

          {/* Equipe — gestao e supervisor */}
          <Route
            path="/equipe"
            element={
              <RoleGuard allowedRoles={['gestao', 'supervisor']} fallback="/obras">
                <Equipe />
              </RoleGuard>
            }
          />

          {/* Ocorrencias — gestao e supervisor */}
          <Route
            path="/ocorrencias"
            element={
              <RoleGuard allowedRoles={['gestao', 'supervisor']} fallback="/obras">
                <Ocorrencias />
              </RoleGuard>
            }
          />

          {/* Gastos — gestao e supervisor */}
          <Route
            path="/gastos"
            element={
              <RoleGuard allowedRoles={['gestao', 'supervisor']} fallback="/obras">
                <Gastos />
              </RoleGuard>
            }
          />

          {/* Fallback dentro do layout */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Route>

      </Routes>
    </BrowserRouter>
  )
}
