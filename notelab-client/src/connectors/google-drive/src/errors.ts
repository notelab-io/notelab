export type GoogleDriveConnectorErrorOptions = {
  code?: string;
  status?: number;
};

export class GoogleDriveConnectorError extends Error {
  readonly code?: string;
  readonly status?: number;

  constructor(message: string, options: GoogleDriveConnectorErrorOptions = {}) {
    super(message);
    this.name = "GoogleDriveConnectorError";
    this.code = options.code;
    this.status = options.status;
  }
}
