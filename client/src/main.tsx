import React from 'react'
import ReactDOM from 'react-dom/client'
// Register @material/web custom elements before React renders
// so they are defined when components first mount.
import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/button/text-button.js'
import '@material/web/textfield/filled-text-field.js'
import '@material/web/select/filled-select.js'
import '@material/web/select/select-option.js'
import '@material/web/dialog/dialog.js'
import '@material/web/checkbox/checkbox.js'
import '@material/web/progress/circular-progress.js'
import App from './App'
import './index.css'

// Apply persisted UI theme before first render to prevent flash
const storedUITheme = localStorage.getItem('ui-theme')
if (storedUITheme === 'material') document.documentElement.classList.add('material')

// Apply persisted color palette before first render to prevent flash
const storedPalette = localStorage.getItem('material-palette') ?? 'palette-purple'
document.documentElement.classList.add(storedPalette)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Register service worker (only in production to avoid HMR conflicts)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // silent fail
    })
  })
}
