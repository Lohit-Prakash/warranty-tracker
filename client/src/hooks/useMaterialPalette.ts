import { useState, useEffect } from 'react'

export interface PaletteOption {
  id: string
  label: string
  primary: string
}

export const PALETTES: PaletteOption[] = [
  { id: 'palette-purple', label: 'Purple',  primary: '#534AB7' },
  { id: 'palette-blue',   label: 'Blue',    primary: '#1967D2' },
  { id: 'palette-green',  label: 'Green',   primary: '#1B8043' },
  { id: 'palette-teal',   label: 'Teal',    primary: '#00766A' },
  { id: 'palette-rose',   label: 'Rose',    primary: '#B71C3B' },
  { id: 'palette-indigo', label: 'Indigo',  primary: '#3949AB' },
]

const STORAGE_KEY = 'material-palette'
const DEFAULT_PALETTE = 'palette-purple'

export function useMaterialPalette() {
  const [palette, setPaletteState] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) ?? DEFAULT_PALETTE,
  )

  useEffect(() => {
    const html = document.documentElement
    PALETTES.forEach((p) => html.classList.remove(p.id))
    html.classList.add(palette)
  }, [palette])

  const setPalette = (id: string) => {
    localStorage.setItem(STORAGE_KEY, id)
    setPaletteState(id)
  }

  return { palette, setPalette, PALETTES }
}
