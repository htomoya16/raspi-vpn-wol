export type ThemeVarMap = Record<string, string>

export function applyThemeVars(root: HTMLElement, vars: ThemeVarMap): void {
  Object.entries(vars).forEach(([name, value]) => {
    root.style.setProperty(name, value)
  })
}
