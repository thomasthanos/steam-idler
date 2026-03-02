/**
 * steamUser.ts – manages a Steam account connection via steam-user (CM protocol).
 * Supports two auth methods:
 *   1. QR code  – user scans with Steam mobile app (via steam-session)
 *   2. Cookie   – user pastes steamLoginSecure cookie value (refresh token)
 *
 * Once connected, can set persona state to Invisible while idling and restore it afterwards.
 * Completely optional: if no credentials are configured the idle manager works without touching status.
 */

import { EventEmitter } from 'events'
import SteamUser from 'steam-user'
import { LoginSession, EAuthTokenPlatformType } from 'steam-session'
import * as QRCode from 'qrcode'
import { SteamAccountConnectionStatus, SteamAccountStatusInfo, QrLoginEvent } from '../../shared/types'

export class SteamAccountManager extends EventEmitter {
  private client: SteamUser | null = null
  private qrSession: LoginSession | null = null
  private originalPersonaState: SteamUser.EPersonaState = SteamUser.EPersonaState.Online
  private _isLoggedOn = false
  private _username: string | null = null
  private _status: SteamAccountConnectionStatus = 'disconnected'

  get isConnected(): boolean { return this._isLoggedOn }
  get username(): string | null { return this._username }

  getStatusInfo(): SteamAccountStatusInfo {
    return { status: this._status, username: this._username }
  }

  // ─── Login with refresh token ─────────────────────────────────────────────
  loginWithRefreshToken(refreshToken: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this._teardownClient()
      this._setStatus('connecting')

      const client = new SteamUser({ autoRelogin: true, renewRefreshTokens: false })
      this.client = client

      const onLoggedOn = () => {
        cleanup()
        this._isLoggedOn = true
        this.originalPersonaState = SteamUser.EPersonaState.Online
        this._setStatus('connected')
        resolve()
      }

      const onError = (err: Error) => {
        cleanup()
        this._isLoggedOn = false
        this._username = null
        this._setStatus('disconnected')
        reject(err)
      }

      const cleanup = () => {
        client.removeListener('loggedOn', onLoggedOn)
        client.removeListener('error', onError)
      }

      client.once('loggedOn', onLoggedOn)
      client.once('error', onError)

      // Try to get display name from accountInfo event
      client.once('accountInfo', (name: string) => {
        this._username = name
        // Re-emit status-changed so renderer shows the name
        this._setStatus('connected')
      })

      client.on('disconnected', () => {
        if (this._isLoggedOn) {
          this._isLoggedOn = false
          this._setStatus('disconnected')
        }
      })

      client.on('loggedOn', () => {
        if (!this._isLoggedOn) {
          this._isLoggedOn = true
          this._setStatus('connected')
        }
      })

      client.logOn({ refreshToken })
    })
  }

  // ─── QR Code login ────────────────────────────────────────────────────────
  async startQrLogin(onEvent: (evt: QrLoginEvent) => void): Promise<void> {
    this.cancelQrLogin()

    const session = new LoginSession(EAuthTokenPlatformType.SteamClient)
    this.qrSession = session
    session.loginTimeout = 120_000 // 2 minutes

    let response: Awaited<ReturnType<typeof session.startWithQR>>
    try {
      response = await session.startWithQR()
    } catch (e: any) {
      this.qrSession = null
      onEvent({ type: 'error', message: e.message })
      return
    }

    // Generate QR image as data URL (dark on white — best for scanning)
    try {
      const challengeUrl = response.qrChallengeUrl
      if (!challengeUrl) throw new Error('No QR challenge URL received')
      const dataUrl = await QRCode.toDataURL(challengeUrl, {
        width: 200,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      })
      onEvent({ type: 'qr-code', dataUrl })
    } catch (e: any) {
      session.cancelLoginAttempt()
      this.qrSession = null
      onEvent({ type: 'error', message: `QR generation failed: ${e.message}` })
      return
    }

    session.on('remoteInteraction', () => {
      onEvent({ type: 'scanned' })
    })

    session.once('authenticated', async () => {
      this.qrSession = null
      const refreshToken = session.refreshToken
      // Notify renderer so it can show "Logging in…"
      onEvent({ type: 'success' })
      try {
        await this.loginWithRefreshToken(refreshToken)
        // Emit so handlers.ts can save the refresh token
        this.emit('qr-login-complete', refreshToken)
      } catch (e: any) {
        onEvent({ type: 'error', message: e.message })
      }
    })

    session.once('timeout', () => {
      this.qrSession = null
      onEvent({ type: 'timeout' })
    })

    session.once('error', (err: Error) => {
      this.qrSession = null
      onEvent({ type: 'error', message: err.message })
    })
  }

  cancelQrLogin(): void {
    if (this.qrSession) {
      try { this.qrSession.cancelLoginAttempt() } catch { /* ok */ }
      this.qrSession.removeAllListeners()
      this.qrSession = null
    }
  }

  // ─── Logout ───────────────────────────────────────────────────────────────
  logout(): void {
    this.cancelQrLogin()
    this._teardownClient()
    this._username = null
    this._setStatus('disconnected')
  }

  // ─── Status helpers ───────────────────────────────────────────────────────
  setInvisible(): void {
    if (!this.client || !this._isLoggedOn) return
    this.client.setPersona(SteamUser.EPersonaState.Invisible)
    console.log('[steam-account] Status set to Invisible')
  }

  restoreStatus(): void {
    if (!this.client || !this._isLoggedOn) return
    this.client.setPersona(this.originalPersonaState)
    console.log(`[steam-account] Status restored to ${this.originalPersonaState}`)
  }

  setPlayingGame(appId: number): void {
    if (!this.client || !this._isLoggedOn) return
    this.client.gamesPlayed([appId])
  }

  clearPlayingGame(): void {
    if (!this.client || !this._isLoggedOn) return
    this.client.gamesPlayed([])
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────
  destroy(): void {
    this.logout()
    this.removeAllListeners()
  }

  // ─── Private ──────────────────────────────────────────────────────────────
  private _teardownClient(): void {
    if (this.client) {
      try { this.client.logOff() } catch { /* ok */ }
      this.client.removeAllListeners()
      this.client = null
      this._isLoggedOn = false
    }
  }

  private _setStatus(status: SteamAccountConnectionStatus): void {
    this._status = status
    this.emit('status-changed', this.getStatusInfo())
  }
}
