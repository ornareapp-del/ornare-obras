import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useStore } from './store/useStore'

import Splash from './pages/Splash'

const Login = lazy(() => import('./pages/Login'))
const PortalCliente = lazy(() => import('./pages/cliente/PortalCliente'))
const Layout = lazy(() => import('./components/Layout'))
const DashboardGestao = lazy(() => import('./pages/gestao/DashboardGestao'))
const Obras = lazy(() => import('./pages/gestao/Obras'))
const ObraDetalhe = lazy(() => import('./pages/gestao/ObraDetalhe'))
const NovaObra = lazy(() => import('./pages/gestao/NovaObra'))
const Agenda = lazy(() => import('./pages/gestao/Agenda'))
const Equipe = lazy(() => import('./pages/gestao/Equipe'))
const Ocorrencias = lazy(() => import('./pages/gestao/Ocorrencias'))
const Gastos = lazy(() => import('./pages/gestao/Gastos'))
const Tarefas = lazy(() => import('./pages/gestao/Tarefas'))
const Planejamento = lazy(() => import('./pages/gestao/Planejamento'))
const BibliotecaMestre = lazy(() => import('./pages/gestao/BibliotecaMestre'))
const DashboardSupervisor = lazy(() => import('./pages/supervisor/DashboardSupervisor'))
const MontadorDashboard = lazy(() => import('./pages/montador/MontadorDashboard'))

const ROLE_ALIASES = {
  vendedor: 'pos_venda',
}

function normalizeRole(role) {
  return ROLE_ALIASES[role] || role
}

function homeForProfile(profile) {
  const role = normalizeRole(profile?.role)

  switch (role) {
    case 'gestao':
      return '/dashboard'
    case 'supervisor':
      return '/supervisor'
    case 'pos_venda':
      return '/obras'
    case 'montador':
      return '/montador'
    case 'cliente':
      return '/cliente/' + (profile?.obra_id || 'acesso-pendente')
    default:
      return '/login'
  }
}

function LoadingAuth() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg, #F5F2EE)',
      color: 'var(--color-ink-muted, #5C5A54)',
      fontFamily: 'var(--font-sans, sans-serif)',
      fontSize: 13,
    }}>
      Carregando acesso...
    </div>
  )
}

function RedirectByRole({ user, profile }) {
  if (!user) return <Navigate to="/login" replace />
  if (!profile) return <LoadingAuth />
  return <Navigate to={homeForProfile(profile)} replace />
}

function PrivateLayout() {
  const { user, profile } = useStore()

  if (!user) return <Navigate to="/login" replace />
  if (!profile) return <LoadingAuth />

  const role = normalizeRole(profile.role)
  if (role === 'montador' || role === 'cliente') {
    return <Navigate to={homeForProfile(profile)} replace />
  }

  return <Layout />
}

function PrivateRoute({ children, allowedRoles }) {
  const { user, profile } = useStore()

  if (!user) return <Navigate to="/login" replace />
  if (!profile) return <LoadingAuth />

  if (allowedRoles) {
    const role = normalizeRole(profile.role)
    const allowed = allowedRoles.map(normalizeRole)
    if (!allowed.includes(role)) {
      return <Navigate to={homeForProfile(profile)} replace />
    }
  }

  return children
}

function RoleGuard({ allowedRoles, children }) {
  const { profile } = useStore()

  if (!profile) return <LoadingAuth />

  const role = normalizeRole(profile.role)
  const allowed = allowedRoles.map(normalizeRole)

  if (!allowed.includes(role)) {
    return <Navigate to={homeForProfile(profile)} replace />
  }

  return children
}

export default function App() {
  const { user, profile, setUser, setProfile } = useStore()
  const [showSplash, setShowSplash] = useState(true)
  const [authLoading, setAuthLoading] = useState(true)

  const fetchProfile = useCallback(async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    setProfile(data || null)
  }, [setProfile])

  useEffect(() => {
    let mounted = true

    async function hydrateSession() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!mounted) return

      if (session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
      } else {
        setUser(null)
        setProfile(null)
      }

      if (mounted) setAuthLoading(false)
    }

    hydrateSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setAuthLoading(true)

      if (session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
      } else {
        setUser(null)
        setProfile(null)
      }

      setAuthLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [fetchProfile, setProfile, setUser])

  if (showSplash) return <Splash onDone={() => setShowSplash(false)} />
  if (authLoading) return <LoadingAuth />

  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingAuth />}>
        <Routes>
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
          <Route path="/cliente/:id" element={<PortalCliente />} />

          <Route path="/" element={<RedirectByRole user={user} profile={profile} />} />

          <Route
            path="/montador"
            element={
              <PrivateRoute allowedRoles={['montador']}>
                <MontadorDashboard />
              </PrivateRoute>
            }
          />

          <Route element={<PrivateLayout />}>
            <Route
              path="/dashboard"
              element={
                <RoleGuard allowedRoles={['gestao']}>
                  <DashboardGestao />
                </RoleGuard>
              }
            />

            <Route
              path="/supervisor"
              element={
                <RoleGuard allowedRoles={['supervisor', 'gestao']}>
                  <DashboardSupervisor />
                </RoleGuard>
              }
            />

            <Route
              path="/obras"
              element={
                <RoleGuard allowedRoles={['gestao', 'supervisor', 'pos_venda', 'vendedor']}>
                  <Obras />
                </RoleGuard>
              }
            />

            <Route
              path="/obras/nova"
              element={
                <RoleGuard allowedRoles={['gestao']}>
                  <NovaObra />
                </RoleGuard>
              }
            />

            <Route
              path="/obras/:id"
              element={
                <RoleGuard allowedRoles={['gestao', 'supervisor', 'pos_venda', 'vendedor']}>
                  <ObraDetalhe />
                </RoleGuard>
              }
            />

            <Route
              path="/tarefas"
              element={
                <RoleGuard allowedRoles={['gestao', 'supervisor']}>
                  <Tarefas />
                </RoleGuard>
              }
            />

            <Route
              path="/agenda"
              element={
                <RoleGuard allowedRoles={['gestao', 'supervisor', 'pos_venda', 'vendedor']}>
                  <Agenda />
                </RoleGuard>
              }
            />

            <Route
              path="/planejamento"
              element={
                <RoleGuard allowedRoles={['gestao', 'supervisor', 'pos_venda', 'vendedor']}>
                  <Planejamento />
                </RoleGuard>
              }
            />

            <Route
              path="/biblioteca-mestre"
              element={
                <RoleGuard allowedRoles={['gestao', 'supervisor']}>
                  <BibliotecaMestre />
                </RoleGuard>
              }
            />

            <Route
              path="/equipe"
              element={
                <RoleGuard allowedRoles={['gestao', 'supervisor']}>
                  <Equipe />
                </RoleGuard>
              }
            />

            <Route
              path="/ocorrencias"
              element={
                <RoleGuard allowedRoles={['gestao', 'supervisor']}>
                  <Ocorrencias />
                </RoleGuard>
              }
            />

            <Route
              path="/gastos"
              element={
                <RoleGuard allowedRoles={['gestao', 'supervisor']}>
                  <Gastos />
                </RoleGuard>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
