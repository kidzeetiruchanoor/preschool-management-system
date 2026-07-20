import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import KioskApp from './kiosk/KioskApp.jsx'

// No routing library — the whole app is one bundle, we just decide
// which top-level component to render based on the URL path. The
// existing vercel.json SPA rewrite already serves index.html for any
// path (including /kiosk), so this is all that's needed.
const isKiosk = window.location.pathname.startsWith('/kiosk')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isKiosk ? <KioskApp /> : <App />}
  </StrictMode>
)
