import { google, gmail_v1 } from 'googleapis';

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.metadata',
];

export function getGmailClientFromSession(accessToken: string, refreshToken?: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing Google OAuth credentials in environment variables');
  }

  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret);
  
  if (refreshToken) {
    oAuth2Client.setCredentials({ 
      access_token: accessToken,
      refresh_token: refreshToken 
    });
  } else {
    oAuth2Client.setCredentials({ access_token: accessToken });
  }
  
  return google.gmail({ version: 'v1', auth: oAuth2Client });
}

// Legacy function for backward compatibility
export function getGmailClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing Google OAuth credentials in environment variables');
  }

  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oAuth2Client.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: 'v1', auth: oAuth2Client });
}

export async function fetchEmailsWithAttachments(userId = 'me', maxResults = 20, accessToken?: string, refreshToken?: string) {
  const gmail = accessToken ? 
    getGmailClientFromSession(accessToken, refreshToken) : 
    getGmailClient();
    
  const res = await gmail.users.messages.list({
    userId,
    maxResults,
    q: 'has:attachment',
  });
  const messages = res.data.messages || [];

  const emails = await Promise.all(
    messages.map(async (msg: gmail_v1.Schema$Message) => {
      const msgRes = await gmail.users.messages.get({ userId, id: msg.id! });
      const payload = msgRes.data.payload;
      const headers = payload?.headers || [];
      const subject = headers.find((h: gmail_v1.Schema$MessagePartHeader) => h.name === 'Subject')?.value || '';
      const sender = headers.find((h: gmail_v1.Schema$MessagePartHeader) => h.name === 'From')?.value || '';
      const date = headers.find((h: gmail_v1.Schema$MessagePartHeader) => h.name === 'Date')?.value || '';
      const attachments = (payload?.parts || [])
        .filter((part: gmail_v1.Schema$MessagePart) => part.filename && (
          part.filename.endsWith('.pdf') ||
          part.filename.endsWith('.doc') ||
          part.filename.endsWith('.docx')
        ))
        .map((part: gmail_v1.Schema$MessagePart) => ({
          filename: part.filename,
          mimeType: part.mimeType,
          attachmentId: part.body?.attachmentId,
          size: part.body?.size,
        }));
      return {
        id: msg.id!,
        subject,
        sender,
        received_at: date,
        has_attachment: attachments.length > 0,
        attachments,
        gmail_id: msg.id!,
        cos_relevant: true, // You can add logic to determine this
        thread_id: msg.threadId,
      };
    })
  );
  return emails;
}

export async function downloadAttachment(accessToken: string, messageId: string, attachmentId: string) {
  const gmail = getGmailClientFromSession(accessToken);
  
  const response = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId: messageId,
    id: attachmentId,
  });
  
  return response.data;
} 