import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { decryptTokens, encryptTokens } from "./encryption";

// ============================================
// GOOGLE DRIVE CLIENT
// Handles Google Drive API operations
// ============================================

const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

/**
 * Create OAuth2 client
 */
export function createOAuth2Client(): OAuth2Client {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google Drive OAuth credentials not configured");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Generate authorization URL
 */
export function getAuthUrl(state?: string): string {
  const oauth2Client = createOAuth2Client();

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // Force consent to get refresh token
    state: state || "",
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function getTokensFromCode(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  scope?: string;
  token_type?: string;
}> {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  return {
    access_token: tokens.access_token!,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
    scope: tokens.scope,
    token_type: tokens.token_type,
  };
}

/**
 * Create authenticated Drive client from encrypted tokens
 */
export function createDriveClient(encryptedTokens: string) {
  const oauth2Client = createOAuth2Client();
  const tokens = decryptTokens(encryptedTokens);

  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
    scope: tokens.scope,
    token_type: tokens.token_type,
  });

  return google.drive({ version: "v3", auth: oauth2Client });
}

/**
 * Refresh access token if expired
 */
export async function refreshTokenIfNeeded(
  encryptedTokens: string,
): Promise<string> {
  const oauth2Client = createOAuth2Client();
  const tokens = decryptTokens(encryptedTokens);

  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  });

  // Check if token is expired or will expire soon (within 5 minutes)
  const expiryDate = tokens.expiry_date || 0;
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  if (expiryDate < now + fiveMinutes) {
    // Refresh token
    const { credentials } = await oauth2Client.refreshAccessToken();

    const newTokens = {
      access_token: credentials.access_token!,
      refresh_token: credentials.refresh_token || tokens.refresh_token,
      expiry_date: credentials.expiry_date,
      scope: credentials.scope,
      token_type: credentials.token_type,
    };

    return encryptTokens(newTokens);
  }

  return encryptedTokens;
}

/**
 * Get user's email from Google
 */
export async function getUserEmail(encryptedTokens: string): Promise<string> {
  const oauth2Client = createOAuth2Client();
  const tokens = decryptTokens(encryptedTokens);

  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  });

  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();

  return data.email || "";
}

/**
 * List files in a folder
 */
export async function listFiles(
  encryptedTokens: string,
  folderId?: string,
  pageToken?: string,
) {
  const drive = createDriveClient(encryptedTokens);

  const query = folderId
    ? `'${folderId}' in parents and trashed = false`
    : `'root' in parents and trashed = false`;

  const response = await drive.files.list({
    q: query,
    pageSize: 100,
    pageToken: pageToken || undefined,
    fields:
      "nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink, iconLink, thumbnailLink)",
    orderBy: "folder,name",
  });

  return {
    files: response.data.files || [],
    nextPageToken: response.data.nextPageToken,
  };
}

/**
 * Get file metadata
 */
export async function getFile(encryptedTokens: string, fileId: string) {
  const drive = createDriveClient(encryptedTokens);

  const response = await drive.files.get({
    fileId,
    fields:
      "id, name, mimeType, size, createdTime, modifiedTime, webViewLink, iconLink, thumbnailLink, parents",
  });

  return response.data;
}

/**
 * Download file
 */
export async function downloadFile(
  encryptedTokens: string,
  fileId: string,
  mimeType?: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const drive = createDriveClient(encryptedTokens);

  // Google Apps native files must be exported, not downloaded
  const GOOGLE_APPS_MIME_TYPES: Record<string, string> = {
    "application/vnd.google-apps.document": "application/pdf",
    "application/vnd.google-apps.spreadsheet": "application/pdf", // or application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
    "application/vnd.google-apps.presentation": "application/pdf",
    "application/vnd.google-apps.drawing": "application/pdf",
  };

  if (mimeType && GOOGLE_APPS_MIME_TYPES[mimeType]) {
    const exportMimeType = GOOGLE_APPS_MIME_TYPES[mimeType];
    const response = await drive.files.export(
      {
        fileId,
        mimeType: exportMimeType,
      },
      { responseType: "arraybuffer" },
    );
    return {
      buffer: Buffer.from(response.data as ArrayBuffer),
      mimeType: exportMimeType,
    };
  }

  // Standard binary files
  const response = await drive.files.get(
    {
      fileId,
      alt: "media",
    },
    { responseType: "arraybuffer" },
  );

  return {
    buffer: Buffer.from(response.data as ArrayBuffer),
    mimeType: mimeType || "application/octet-stream",
  };
}

/**
 * Upload file to Google Drive
 */
export async function uploadFile(
  encryptedTokens: string,
  file: {
    name: string;
    mimeType: string;
    buffer: Buffer;
  },
  folderId?: string,
) {
  const drive = createDriveClient(encryptedTokens);

  const fileMetadata: any = {
    name: file.name,
  };

  if (folderId) {
    fileMetadata.parents = [folderId];
  }

  const media = {
    mimeType: file.mimeType,
    body: require("stream").Readable.from(file.buffer),
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: "id, name, mimeType, size, createdTime, webViewLink",
  });

  return response.data;
}

/**
 * Create folder in Google Drive
 */
export async function createFolder(
  encryptedTokens: string,
  folderName: string,
  parentFolderId?: string,
) {
  const drive = createDriveClient(encryptedTokens);

  const fileMetadata: any = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
  };

  if (parentFolderId) {
    fileMetadata.parents = [parentFolderId];
  }

  const response = await drive.files.create({
    requestBody: fileMetadata,
    fields: "id, name",
  });

  return response.data;
}

/**
 * Delete file from Google Drive
 */
export async function deleteFile(encryptedTokens: string, fileId: string) {
  const drive = createDriveClient(encryptedTokens);
  await drive.files.delete({ fileId });
}
