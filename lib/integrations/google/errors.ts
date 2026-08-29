/** Google is configured but the stored refresh token is missing/expired/revoked
 *  ("reconnect_required"), or no credentials are saved at all ("not_configured").
 *  Routes map this to 409; the opportunistic sync swallows it into status:"error". */
export class GoogleAuthError extends Error {
  readonly reason: "reconnect_required" | "not_configured"
  constructor(message: string, reason: GoogleAuthError["reason"]) {
    super(message)
    this.name = "GoogleAuthError"
    this.reason = reason
  }
}

/** A non-2xx from the Sheets or Drive REST API. */
export class GoogleApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = "GoogleApiError"
    this.status = status
  }
}
