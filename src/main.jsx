import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './styles/tokens.css'
import './styles/app.css'
import CatalogPage from './pages/CatalogPage'
import { StateScreen, LoadingScreen } from './pages/StateScreens'

// El panel se descarga solo cuando alguien entra a /panel (el catálogo sigue liviano)
const PanelApp = lazy(() => import('./panel/PanelApp'))
const AdminApp = lazy(() => import('./panel/AdminApp'))
const AuthApp = lazy(() => import('./panel/Login'))


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* La raíz es la puerta de ingreso (superadmin y proveedores). Los catálogos viven en /c/:slug */}
        <Route path="/" element={<Navigate to="/entrar" replace />} />
        <Route path="/c/:slug" element={<CatalogPage />} />
        <Route path="/panel/*" element={<Suspense fallback={<LoadingScreen />}><PanelApp /></Suspense>} />
        {['/entrar', '/registro', '/clave'].map(p => <Route key={p} path={p} element={<Suspense fallback={<LoadingScreen />}><AuthApp /></Suspense>} />)}
        <Route path="/admin/*" element={<Suspense fallback={<LoadingScreen />}><AdminApp /></Suspense>} />
        <Route path="*" element={<StateScreen title="Página no encontrada" text="El enlace no existe o cambió." />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
