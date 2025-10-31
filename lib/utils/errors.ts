export class UserSafeError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = 'UserSafeError'
    this.status = status
  }
}

export function safeMessage(err: unknown, fallback = 'Something went wrong.') {
  if (err instanceof UserSafeError) return err.message
  if (err instanceof Error) return err.message
  return fallback
}


