/**
 * steamUser.ts – manages a Steam account connection via steam-user (CM protocol).
 * Supports two auth methods:
 *   1. QR code  – user scans with Steam mobile app (via steam-session)
 *   2. Cookie   – user pastes steamLoginSecure cookie value (refresh token)
 *
 * Persona state (invisible/restore) is changed via the steam:// URL protocol,
 * which routes through the running Steam client itself — zero network traffic,
 * no CM session conflict, 100% reliable.
 *
 * IMPORTANT: The steam:// protocol works independently of the steam-user CM
 * session. setInvisible() and restoreStatus() only require that:
 *   a) The user has logged in at least once (_accountId is known), AND
 *   b) Steam client is running (always true if idling is active)
 * They do NOT require _isLoggedOn to be true.
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

/**
 * Read the user's CURRENT desired persona state from localconfig.vdf.
 * Called fresh right before setInvisible() so we always capture the
 * actual current state, not a potentially stale value from login time.
 */
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
function setPersonaViaProtocol(state: 'online' | 'away' | 'invisible' | 'offline' | 'busy' | 'snooze'): void {
  shell.openExternal(`steam://friends/status/${state}`).catch(e => {
    console.error(`[steam-account] Failed to open steam:// URL for state "${state}":`, e)
  })
}

export class SteamAccountManager extends EventEmitter {
  private client: SteamUser | null = null
  private qrSession: LoginSession | null = null
  private _accountId: number | null = null
  // Captured fresh from localconfig.vdf right before setInvisible() is called.
  // Stored so restoreStatus() can use it even after steam-user disconnects.
  private _preIdleStateName: string | null = null
  private _isLoggedOn = false
  private _username: string | null = null
  private _status: SteamAccountConnectionStatus = 'disconnected'

  // True if the user has ever logged in this session (accountId is known).
  // Used as the guard for steam:// protocol calls — does NOT require
  // steam-user CM session to be active.
  get hasAccount(): boolean { return this._accountId !== null }
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

      // autoRelogin: false — prevents an infinite reconnect loop when Steam
      // sends LoggedInElsewhere (which happens because the main Steam client
      // is already using the same account on the same CM server).
      const client = new SteamUser({ autoRelogin: false, renewRefreshTokens: false })
      this.client = client

      let settled = false

      const onLoggedOn = () => {
        // Capture accountId from client.steamID (set by steam-user after logon).
        // Note: The loggedOn event's `details` arg is a raw protobuf object that
        // does NOT contain a usable SteamID — always use client.steamID instead.
        const accountId = client.steamID?.accountid ?? null
        if (accountId && !this._accountId) {
          this._accountId = accountId
          console.log(`[steam-account] AccountId captured: ${accountId}`)
        }
      }

      const onAccountInfo = (name: string) => {
        this._username = name
        if (!settled) {
          settled = true
          cleanup()
          this._isLoggedOn = true
          this._setStatus('connected')
          resolve()
        }
      }

      const onError = (err: Error & { eresult?: number }) => {
        const isElsewhere = err?.eresult === 6 || err?.message?.includes('LoggedInElsewhere')
        if (isElsewhere) {
          console.warn('[steam-account] LoggedInElsewhere — steam-user CM session conflicted with main Steam client. Disconnecting gracefully.')
        } else {
          console.error('[steam-account] steam-user error:', err?.message)
        }
        this._isLoggedOn = false
        this._username = null
        this._setStatus('disconnected')
        // logOff() cleanly terminates the session without triggering autoRelogin
        // (autoRelogin is already false, but this also cancels any pending reconnect)
        try { client.logOff() } catch { /* ok */ }

        if (!settled) {
          settled = true
          cleanup()
          reject(err)
        }
      }

      const cleanup = () => {
        client.removeListener('loggedOn',     onLoggedOn)
        client.removeListener('accountInfo',  onAccountInfo)
        client.removeListener('error',        onError)
      }

      client.on('loggedOn', onLoggedOn)
      client.once('accountInfo', onAccountInfo)
      client.once('error', onError)

      // Persistent handlers for reconnect events (autoRelogin=false so these
      // only fire if steam-user internally retries before giving up)
      client.on('disconnected', (_eresult: number, msg?: string) => {
        if (this._isLoggedOn) {
          this._isLoggedOn = false
          this._setStatus('disconnected')
          console.log(`[steam-account] Disconnected: ${msg}`)
        }
      })

      // Forward game launch/quit events so IdleManager can detect manual
      // game launches and stop idling automatically.
      client.on('appLaunched', (appId: number) => {
        console.log(`[steam-account] CM event: appLaunched appId=${appId}`)
        this.emit('game-launched', appId)
      })
      client.on('appQuit', (appId: number) => {
        console.log(`[steam-account] CM event: appQuit appId=${appId}`)
        this.emit('game-quit', appId)
      })

      // Persistent error handler after the initial login — prevents
      // UnhandledPromiseRejection on subsequent errors (e.g. session expiry)
      client.on('error', (err: Error & { eresult?: number }) => {
        if (!settled) return // let the once handler deal with it
        // Post-login error: handle without rejecting the already-resolved promise
        const isElsewhere = err?.eresult === 6 || err?.message?.includes('LoggedInElsewhere')
        if (isElsewhere) {
          console.warn('[steam-account] Post-login LoggedInElsewhere — disconnecting gracefully.')
        } else {
          console.error('[steam-account] Post-login error:', err?.message)
        }
        this._isLoggedOn = false
        this._username = null
        this._setStatus('disconnected')
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
      onEvent({ type: 'success' })
      try {
        await this.loginWithRefreshToken(refreshToken)
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
    this._accountId = null
    this._preIdleStateName = null
    this._setStatus('disconnected')
  }

  // ─── Status helpers ───────────────────────────────────────────────────────

  /**
   * Read the user's current status from localconfig.vdf and go Invisible.
   * Guard: requires _accountId (set at first login) — NOT _isLoggedOn,
   * because the steam:// protocol works even after steam-user disconnects.
   */
  setInvisible(): void {
    if (!this._accountId) return

    // Read the CURRENT state fresh from disk right before we change it,
    // so restoreStatus() always restores to what the user actually had,
    // not a potentially stale value captured at login time.
    const stateNum = readPersonaStateDesired(this._accountId)
    const stateName = PERSONA_STATE_NAMES[stateNum] ?? 'online'

    // Don't override a previously captured pre-idle state if it's already set
    // (e.g. setInvisible called twice before a restoreStatus)
    if (!this._preIdleStateName) {
      this._preIdleStateName = stateName
    }

    setPersonaViaProtocol('invisible')
    console.log(`[steam-account] Status → Invisible (was: ${this._preIdleStateName})`)
  }

  /**
   * Restore the status that was active before setInvisible() was called.
   * Safe to call even if steam-user has since disconnected.
   */
  restoreStatus(): void {
    if (!this._accountId) return

    const state = (this._preIdleStateName ?? 'online') as Parameters<typeof setPersonaViaProtocol>[0]
    this._preIdleStateName = null  // clear so next idle session captures fresh
    setPersonaViaProtocol(state)
    console.log(`[steam-account] Status restored → ${state}`)
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
