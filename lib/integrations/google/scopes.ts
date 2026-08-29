// Non-sensitive scope: no Google verification, and the consent screen can be
// published to production so refresh tokens don't expire on the 7-day testing
// clock. The Drive Picker still lets the user browse their whole Drive (it runs
// on the user's own Google session); only the file they pick becomes visible to
// this token. drive.file also covers the Sheets API reads for picked files.
export const GOOGLE_SCOPE = "https://www.googleapis.com/auth/drive.file"
