# Progress Tracker Setup Guide

## Overview
The Progress Tracker now uses real artist data from PDF extractions and provides:
- Status tracking (Pending → Processing → Approved)
- JSON copying to clipboard
- Visa image upload to Supabase Storage
- Gmail draft creation with visa images

## Setup Steps

### 1. Supabase Storage Setup
Create the visa-images bucket in your Supabase project:

```bash
# Run the setup script
node scripts/setup-storage.js
```

Or manually create the bucket in Supabase Dashboard:
- Go to Storage in your Supabase project
- Create a new bucket called "visa-images"
- Set it as public
- Allow image/jpeg and image/png MIME types
- Set file size limit to 10MB

### 2. Database Schema Update
Apply the Prisma schema changes:

```bash
npx prisma db push
```

This adds the `VisaImage` model to track uploaded images.

### 3. Environment Variables
Add these to your `.env.local`:

```env
# Supabase (already configured)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Gmail API (optional - for draft creation)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=your_redirect_uri
GOOGLE_ACCESS_TOKEN=your_access_token
GOOGLE_REFRESH_TOKEN=your_refresh_token
# OR use service account
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

### 4. Gmail API Setup (Optional)
If you want Gmail draft creation:

1. Go to Google Cloud Console
2. Create a project and enable Gmail API
3. Create OAuth 2.0 credentials
4. Set up OAuth consent screen
5. Get access and refresh tokens

Or use a service account for server-to-server authentication.

## Usage

### Workflow
1. **Extract PDFs** → Artists appear in Progress Tracker as "Pending"
2. **Copy JSON** → Status changes to "Processing"
3. **Upload Visa Image** → Status changes to "Approved"
4. **Create Gmail Draft** → Sends confirmation email with visa image

### Features
- **Real-time tracking**: Artists appear automatically after PDF extraction
- **Status management**: Visual status indicators and automatic updates
- **Image upload**: Secure upload to Supabase Storage with metadata
- **Gmail integration**: Create drafts with visa images and artist details
- **JSON copying**: One-click copy of formatted JSON for Chrome extension

### API Endpoints
- `POST /api/upload-visa-image` - Upload visa images to Supabase Storage
- `POST /api/create-gmail-draft` - Create Gmail drafts with visa images

## Troubleshooting

### Image Upload Issues
- Check Supabase Storage bucket exists and is public
- Verify file size is under 10MB
- Ensure file is JPEG or PNG format

### Gmail Draft Issues
- Verify Google API credentials are configured
- Check OAuth tokens are valid and not expired
- Ensure Gmail API is enabled in Google Cloud Console

### Database Issues
- Run `npx prisma db push` to apply schema changes
- Check Supabase connection in environment variables

## Security Notes
- Visa images are stored in public bucket (accessible via URL)
- Consider implementing authentication for image access
- Gmail API requires proper OAuth setup for production use 