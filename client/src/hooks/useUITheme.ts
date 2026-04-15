import { useState, useEffect } from 'react'

type UITheme = 'default' | 'material'

function applyTheme(theme: UITheme) {
  if (theme === 'material') {
    document.documentElement.classList.add('material')
  } else {
    document.documentElement.classList.remove('material')
  }
}

export function useUITheme() {
  const [theme, setTheme] = useState<UITheme>(() => {
    const stored = localStorage.getItem('ui-theme') as UITheme | null
    return stored === 'material' ? 'material' : 'default'
  })

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const toggle = () => {
    const next: UITheme = theme === 'default' ? 'material' : 'default'
    localStorage.setItem('ui-theme', next)
    setTheme(next)
  }

  return { isMaterial: theme === 'material', toggle }
}
