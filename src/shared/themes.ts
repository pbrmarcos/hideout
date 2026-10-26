import type { ThemeId } from './types'

export interface Theme {
  id: ThemeId
  name: string
  dark: boolean
  mono: boolean
  bg: string
  surface: string
  ink: string
  muted: string
  line: string
  tab: string
  primary: string
  onPrimary: string
  soft: string
  softInk: string
  dot: string
  warn: string
  warnSoft: string
  danger: string
  dangerSoft: string
  glow: string
}

const lightStatus = { warn: '#8A4B12', warnSoft: '#F5E7D6', danger: '#A33A3A', dangerSoft: '#F6E4E4', glow: 'none' }

export const THEMES: Theme[] = [
  { id: 'salvia', name: 'Sálvia', dark: false, mono: false, bg: '#EDF1EC', surface: '#F8FAF7', ink: '#1E2722', muted: '#56645B', line: '#DCE3DD', tab: '#E1E7E1', primary: '#47705A', onPrimary: '#FFFFFF', soft: '#DDE9E0', softInk: '#2F5843', dot: '#47705A', ...lightStatus },
  { id: 'lavanda', name: 'Lavanda', dark: false, mono: false, bg: '#EFEDF6', surface: '#FAF9FD', ink: '#24212F', muted: '#5E5872', line: '#E0DCEB', tab: '#E3E0EE', primary: '#6A5BA3', onPrimary: '#FFFFFF', soft: '#E6E1F4', softInk: '#4A3F80', dot: '#6A5BA3', ...lightStatus },
  { id: 'areia', name: 'Areia', dark: false, mono: false, bg: '#F1ECE4', surface: '#FBF8F3', ink: '#2A251D', muted: '#675D4E', line: '#E4DCCF', tab: '#E7E0D4', primary: '#7A6236', onPrimary: '#FFFFFF', soft: '#EDE3CF', softInk: '#5C4A26', dot: '#7A6236', ...lightStatus },
  { id: 'nevoa', name: 'Névoa', dark: false, mono: false, bg: '#EAEFF4', surface: '#F7F9FC', ink: '#1C2633', muted: '#546375', line: '#D9E1EA', tab: '#DEE5EC', primary: '#476A8E', onPrimary: '#FFFFFF', soft: '#DCE6F1', softInk: '#2E4D6E', dot: '#476A8E', ...lightStatus },
  { id: 'noite', name: 'Noite', dark: true, mono: false, bg: '#171C21', surface: '#1F252C', ink: '#E4E9EE', muted: '#9AA7B4', line: '#2E363F', tab: '#232A31', primary: '#8DBBA0', onPrimary: '#10241A', soft: '#2A3A33', softInk: '#B5D6C2', dot: '#8DBBA0', warn: '#E3B07A', warnSoft: '#3A2E22', danger: '#F09A9A', dangerSoft: '#3A2626', glow: 'none' },
  { id: 'oceano', name: 'Oceano', dark: false, mono: false, bg: '#F5F7FA', surface: '#FBFCFE', ink: '#0B1B33', muted: '#5C6B80', line: '#D8DFE8', tab: '#E3E9F0', primary: '#0077C8', onPrimary: '#FFFFFF', soft: '#DDEEFA', softInk: '#0D213A', dot: '#0094EC', ...lightStatus, glow: '0 0 0 2px #00D7EC' },
  { id: 'rubi', name: 'Rubi', dark: false, mono: false, bg: '#F6EEEE', surface: '#FCF8F8', ink: '#2A1A1B', muted: '#6E5557', line: '#EBDCDD', tab: '#EEE1E2', primary: '#B4232F', onPrimary: '#FFFFFF', soft: '#F6DEDF', softInk: '#8E1C26', dot: '#B4232F', ...lightStatus, danger: '#7E1420' },
  { id: 'matrix', name: 'Matrix', dark: true, mono: true, bg: '#050A06', surface: '#0B140D', ink: '#C8FFD4', muted: '#6FBF84', line: '#163A1E', tab: '#0F1E12', primary: '#00FF41', onPrimary: '#001A07', soft: '#0F2A16', softInk: '#39FF6A', dot: '#00FF41', warn: '#FFD166', warnSoft: '#2A2A0F', danger: '#FF6B6B', dangerSoft: '#2A1212', glow: '0 0 12px rgba(0,255,65,.55)' }
]

export function themeById(id: string | undefined | null): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}
