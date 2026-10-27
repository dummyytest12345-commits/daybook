import { beforeEach, describe, expect, it } from 'vitest'
import { THEME_KEY, applyTheme, resolveTheme, useTheme } from '../store/useTheme'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.className = ''
})

describe('theme', () => {
  it('resolves explicit choices and applies the dark class', () => {
    expect(resolveTheme('dark')).toBe('dark')
    expect(resolveTheme('light')).toBe('light')
    expect(applyTheme('dark')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(applyTheme('light')).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('stores the preference on the device and toggles', () => {
    useTheme.getState().setPref('dark')
    expect(localStorage.getItem(THEME_KEY)).toBe('dark')
    expect(useTheme.getState().resolved).toBe('dark')
    useTheme.getState().toggle()
    expect(useTheme.getState().pref).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
