import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { EmbedProvider } from '@/lib/embed'
import './index.css'
import App from './App.tsx'

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <EmbedProvider>
        <App />
      </EmbedProvider>
    </BrowserRouter>
  </StrictMode>,
)
