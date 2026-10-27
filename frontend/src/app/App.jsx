import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { setNavigator } from './nav'
import * as Tooltip from '@radix-ui/react-tooltip'
import { AppShell } from '../components/layout/AppShell'
import { Skeleton } from '../components/ui'
import { ErrorBoundary } from './ErrorBoundary'
import { useAuth } from '../store/useAuth'
import { AppLoading } from '../components/ui/AppLoading'
import AuthPage from '../pages/AuthPage'
import TodayPage from '../pages/TodayPage'
import LogPage from '../pages/LogPage'

// Route-level code splitting: heavy pages (charts, import/export) load on demand.
const AnalyticsPage = lazy(() => import('../pages/AnalyticsPage'))
const ReportsPage = lazy(() => import('../pages/ReportsPage'))
const DataPage = lazy(() => import('../pages/DataPage'))
const SettingsPage = lazy(() => import('../pages/SettingsPage'))
const LandingPage = lazy(() => import('../pages/LandingPage'))
const TeamPage = lazy(() => import('../pages/TeamPage'))
const TeamProjectPage = lazy(() => import('../pages/TeamProjectPage'))
const JoinPage = lazy(() => import('../pages/JoinPage'))
const ProjectsPage = lazy(() => import('../pages/ProjectsPage'))
const ProjectPage = lazy(() => import('../pages/ProjectPage'))

const Loading = () => <div className="space-y-3"><Skeleton className="h-10 w-64" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>

const Splash = AppLoading

/** Signed-out visitors go to /login and come back to the page they asked for. */
function RequireAuth() {
  const status = useAuth((s) => s.status)
  const location = useLocation()
  const lost = useAuth((s) => s.sessionLost)
  if (status === 'loading') return <Splash />
  // a session that ended on its own goes to the landing page, a plain visitor to the sign-in page
  if (status === 'anon') return <Navigate to={lost ? '/' : '/login'} replace state={lost ? undefined : { from: location }} />
  return <Outlet />
}

/** "/" is the public landing page for visitors and the Today screen (inside the app shell) once signed in. */
function HomeGate() {
  const status = useAuth((s) => s.status)
  if (status === 'loading') return <Splash />
  if (status === 'anon') return <Suspense fallback={<Splash />}><LandingPage /></Suspense>
  return <AppShell />
}

/** Login/register are for signed-out visitors only. */
function PublicOnly() {
  const status = useAuth((s) => s.status)
  const from = useLocation().state?.from
  if (status === 'loading') return <Splash />
  if (status === 'authed') return <Navigate to={from?.pathname ? `${from.pathname}${from.search || ''}` : '/'} replace />
  return <Outlet />
}

/** Gives the sync engine access to the router (for redirecting to the landing page). */
function NavBridge() {
  const navigate = useNavigate()
  useEffect(() => {
    setNavigator(navigate)
    return () => setNavigator(null)
  }, [navigate])
  return null
}

export default function App() {
  const init = useAuth((s) => s.init)
  useEffect(() => { init() }, [init])

  return (
    <ErrorBoundary>
      <Tooltip.Provider>
        <BrowserRouter>
          <NavBridge />
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="join" element={<JoinPage />} />
              <Route element={<PublicOnly />}>
                <Route path="login" element={<AuthPage mode="login" />} />
                <Route path="register" element={<AuthPage mode="register" />} />
              </Route>
              <Route path="/" element={<HomeGate />}>
                <Route index element={<TodayPage />} />
              </Route>
              <Route element={<RequireAuth />}>
              <Route element={<AppShell />}>
                <Route path="log" element={<Navigate to="/log/day" replace />} />
                <Route path="log/:view" element={<LogPage />} />
                <Route path="team" element={<TeamPage />} />
                <Route path="team/:id" element={<TeamProjectPage />} />
                <Route path="projects" element={<ProjectsPage />} />
                <Route path="projects/:id" element={<ProjectPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="data" element={<DataPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </Tooltip.Provider>
    </ErrorBoundary>
  )
}
