export type GoogleDriveConnectorScope =
  | "openid"
  | "email"
  | "profile"
  | "https://www.googleapis.com/auth/drive.readonly"
  | "https://www.googleapis.com/auth/drive.metadata.readonly";

export type GoogleDriveOAuthTokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
  id_token?: string;
};

export type GoogleDriveGoogleIdTokenClaims = {
  aud?: string;
  email?: string;
  email_verified?: boolean;
  exp?: number;
  hd?: string;
  iat?: number;
  iss?: string;
  sub?: string;
};

export type GoogleDriveFile = {
  createdTime?: string;
  description?: string;
  driveId?: string;
  explicitlyTrashed?: boolean;
  exportLinks?: Record<string, string>;
  fileExtension?: string;
  folderColorRgb?: string;
  fullFileExtension?: string;
  hasThumbnail?: boolean;
  headRevisionId?: string;
  iconLink?: string;
  id: string;
  kind?: string;
  md5Checksum?: string;
  mimeType?: string;
  modifiedTime?: string;
  name?: string;
  originalFilename?: string;
  ownedByMe?: boolean;
  owners?: GoogleDriveUser[];
  parents?: string[];
  quotaBytesUsed?: string;
  shared?: boolean;
  size?: string;
  starred?: boolean;
  thumbnailLink?: string;
  trashed?: boolean;
  viewedByMeTime?: string;
  webContentLink?: string;
  webViewLink?: string;
};

export type GoogleDriveUser = {
  displayName?: string;
  emailAddress?: string;
  kind?: string;
  me?: boolean;
  permissionId?: string;
  photoLink?: string;
};

export type GoogleDriveFilesResponse = {
  files?: GoogleDriveFile[];
  incompleteSearch?: boolean;
  kind?: string;
  nextPageToken?: string;
};

export type GoogleDriveAbout = {
  user?: GoogleDriveUser;
  storageQuota?: {
    limit?: string;
    usage?: string;
    usageInDrive?: string;
    usageInDriveTrash?: string;
  };
};

export type GoogleDriveFileSummary = {
  createdTime?: string;
  id: string;
  mimeType?: string;
  modifiedTime?: string;
  name?: string;
  owners?: GoogleDriveUser[];
  size?: string;
  webViewLink?: string;
};
