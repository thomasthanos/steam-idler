/**
 * steamUser.ts – manages a Steam account connection via steam-user (CM protocol).
 * Supports two auth methods:
 *   1. QR code  – user scans with Steam mobile app (via steam-session)
 *   2. Cookie   – user pastes steamLoginSecure cookie value (refresh token)
 *
 * Persona state (invisible/restore) is changed via the steam:// URL protocol,
 * which routes through the running Steam client itself — zero network traffic,
 * no CM session conflict, 100% reliable.
 */

import { EventEmitter } from 'events'
import { shell } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import SteamUser from 'steam-user'
import { LoginSession, EAuthTokenPlatformType } from 'steam-session'
import * as QRCode from 'qrcode'
import { SteamAccountConnectionStatus, SteamAccountStatusInfo, QrLoginEvent } from '../../shared/types'
import { getSteamPath, parseTextVdf, VdfObject } from './steamPaths'

// EPersonaState values used in localconfig.vdf
const PERSONA_STATE_NAMES: Record<number, string> = {
  0: 'offline',
  1: 'online',
  2: 'busy',
  3: 'away',
  4: 'snooze',
  7: 'invisible',
}

/** Read PersonaStateDesired from userdata/<accountId>/config/localconfig.vdf */
function readPersonaStateDesired(accountId: number): number {
  try {
    const vdfPath = path.join(getSteamPath(), 'userdata', String(accountId), 'config', 'localconfig.vdf')
    if (!fs.existsSync(vdfPath)) return 1
    const text = fs.readFileSync(vdfPath, 'utf8')
    const data = parseTextVdf(text)
    const store = (data['UserLocalConfigStore'] ?? data['userLocalConfigStore'] ?? {}) as VdfObject
    const friends = (store['friends'] ?? store['Friends'] ?? {}) as VdfObject
    const val = parseInt(String(friends['PersonaStateDesired'] ?? '1'))
    return isNaN(val) ? 1 : val
  } catch {
    return 1 // default: Online
  }
}

/** Change Steam persona state via the steam:// URL protocol (no CM traffic). */
async function setPersonaViaProtocol(state: 'online' | 'away' | 'invisible' | 'offline' | 'busy' | 'snooze'): Promise<void> {
  await shell.openExternal(`steam://friends/status/${state}`)
}

export class SteamAccountManager extends EventEmitter {
  private client: SteamUser | null = null
  private qrSession: LoginSession | null = null
  private _originalPersonaStateName: string = 'online'
  private _accountId: number | null = null
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
        // originalPersonaState removed — state is read from localconfig.vdf
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

      // Grab display name and accountId from accountInfo
      client.once('accountInfo', (name: string) => {
        this._username = name
        this._setStatus('connected')
      })

      // Save original persona state before we ever touch it
      client.once('loggedOn', (details: { client_steamid?: { accountid?: number } }) => {
        const accountId = details?.client_steamid?.accountid ?? null
        if (accountId) {
          this._accountId = accountId
          const stateNum = readPersonaStateDesired(accountId)
          this._originalPersonaStateName = PERSONA_STATE_NAMES[stateNum] ?? 'online'
          console.log(`[steam-account] Original persona state: ${this._originalPersonaStateName} (${stateNum})`)
        }
      })

      client.on('disconnected', (_eresult: number, msg?: string) => {
        if (this._isLoggedOn) {
          this._isLoggedOn = false
          this._setStatus('disconnected')
          console.log(`[steam-account] Disconnected: ${msg}`)
        }
      })

      client.on('loggedOn', () => {
        if (!this._isLoggedOn) {
          this._isLoggedOn = true
          this._setStatus('connected')
        }
      })

      // Persistent error handler — prevents UnhandledPromiseRejection crashes.
      // LoggedInElsewhere happens when steam-user opens a second CM session
      // while the main Steam client is already logged in with the same account.
      // We handle it gracefully: disconnect silently without crashing.
      client.on('error', (err: Error & { eresult?: number }) => {
        const isElsewhere = err?.eresult === 6 || err?.message?.includes('LoggedInElsewhere')
        if (isElsewhere) {
          console.warn('[steam-account] LoggedInElsewhere — steam-user session conflicted with main Steam client. Disconnecting gracefully.')
        } else {
          console.error('[steam-account] steam-user error:', err?.message)
        }
        this._isLoggedOn = false
        this._username = null
        this._setStatus('disconnected')
        // Tear down silently so autoRelogin doesn't keep retrying
        try { client.logOff() } catch { /* ok */ }
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
    if (!this._isLoggedOn) return
    setPersonaViaProtocol('invisible')
    console.log('[steam-account] Status set to Invisible (via steam:// protocol)')
  }

  restoreStatus(): void {
    if (!this._isLoggedOn) return
    const state = this._originalPersonaStateName as Parameters<typeof setPersonaViaProtocol>[0]
    setPersonaViaProtocol(state)
    console.log(`[steam-account] Status restored to ${state} (via steam:// protocol)`)
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
