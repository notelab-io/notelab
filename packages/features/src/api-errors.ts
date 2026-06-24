export const ACTIVE_ORGANIZATION_MISMATCH_CODE = "ACTIVE_ORGANIZATION_MISMATCH"

export class ActiveOrganizationMismatchError extends Error {
  readonly code = ACTIVE_ORGANIZATION_MISMATCH_CODE
  readonly status = 409
  readonly organizationId: string

  constructor(organizationId: string, message?: string) {
    super(message ?? "Switch to the workspace organization to continue.")
    this.name = "ActiveOrganizationMismatchError"
    this.organizationId = organizationId
  }
}

export function isActiveOrganizationMismatchError(
  error: unknown,
): error is ActiveOrganizationMismatchError {
  return error instanceof ActiveOrganizationMismatchError
}

export function parseActiveOrganizationMismatchError(
  error: unknown,
): ActiveOrganizationMismatchError | null {
  if (isActiveOrganizationMismatchError(error)) {
    return error
  }

  if (
    typeof error !== "object" ||
    error === null ||
    !("status" in error) ||
    error.status !== 409
  ) {
    return null
  }

  const body = "body" in error ? error.body : null

  if (!body || typeof body !== "object") {
    return null
  }

  const record = body as {
    code?: unknown
    error?: unknown
    organizationId?: unknown
  }

  if (
    record.code !== ACTIVE_ORGANIZATION_MISMATCH_CODE ||
    typeof record.organizationId !== "string" ||
    record.organizationId.length === 0
  ) {
    return null
  }

  const message =
    typeof record.error === "string"
      ? record.error
      : "Switch to the workspace organization to continue."

  return new ActiveOrganizationMismatchError(record.organizationId, message)
}