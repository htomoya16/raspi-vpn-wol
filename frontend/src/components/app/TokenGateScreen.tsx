import { SettingsPanel } from '../SettingsDialog'
import type { AppearanceMode, EffectiveAppearanceMode, ThemeOption } from '../../theme/types'

interface TokenGateScreenProps {
  isTokenValidationPending: boolean
  isTokenInvalid: boolean
  selectedThemeId: string
  appearanceMode: AppearanceMode
  effectiveAppearanceMode: EffectiveAppearanceMode
  themeOptions: ThemeOption[]
  onThemeChange: (themeId: string) => void
  onAppearanceChange: (mode: AppearanceMode) => void
}

function TokenGateScreen({
  isTokenValidationPending,
  isTokenInvalid,
  selectedThemeId,
  appearanceMode,
  effectiveAppearanceMode,
  themeOptions,
  onThemeChange,
  onAppearanceChange,
}: TokenGateScreenProps) {
  return (
    <section className="panel app-token-gate" aria-labelledby="token-gate-title">
      <div className="app-token-gate__lead">
        <h2 id="token-gate-title">APIトークンを設定してください</h2>
        <p>有効なトークンが確認できるまで、PC一覧・操作ログ・稼働時間は表示されません。</p>
      </div>
      {isTokenValidationPending ? <p className="feedback feedback--notice">トークンを確認しています...</p> : null}
      {isTokenInvalid ? (
        <p className="feedback feedback--error">
          保存中のAPIトークンが無効です。正しいトークンを入力して保存してください。
        </p>
      ) : null}
      <SettingsPanel
        selectedThemeId={selectedThemeId}
        appearanceMode={appearanceMode}
        effectiveAppearanceMode={effectiveAppearanceMode}
        themeOptions={themeOptions}
        initialSection="tokens"
        onThemeChange={onThemeChange}
        onAppearanceChange={onAppearanceChange}
      />
    </section>
  )
}

export default TokenGateScreen
