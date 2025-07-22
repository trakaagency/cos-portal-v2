# CoS Portal v2

A comprehensive portal for processing emails, extracting PDFs, and managing applications with Gmail integration and AI-powered analysis.

## 🚀 Features

- **Email Processing**: Gmail integration with thread management
- **PDF Extraction**: AI-powered text extraction and analysis
- **Authentication**: Google OAuth with NextAuth.js
- **Admin Panel**: User management and analytics
- **Real-time Updates**: Live data synchronization
- **File Management**: Secure upload and storage system

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- PostgreSQL database (Supabase recommended)
- Google Cloud Platform account
- OpenAI API key

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/trakaagency/cos-portal-v2.git
   cd cos-portal-v2
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Then edit `.env.local` with your actual values (see Environment Variables section below).

4. **Set up the database**
   ```bash
   npx prisma db push
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

## 🔐 Environment Variables

Copy `.env.example` to `.env.local` and fill in your actual values:

### Required Variables:

```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback/google

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_here

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Database Configuration
DATABASE_URL=your_database_url_here
```

### Optional Variables:

```bash
# File Upload Configuration
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE="10485760"

# Environment Configuration
NODE_ENV="development"
DEBUG="true"

# Rate Limiting
RATE_LIMIT_REQUESTS="100"
RATE_LIMIT_WINDOW="3600000"

# CORS Configuration
CORS_ORIGIN="http://localhost:3000"
```

## 🔧 Setup Instructions for Developers

### 1. Google Cloud Platform Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Gmail API and Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`

### 2. Supabase Setup
1. Create a new Supabase project
2. Get your project URL and API keys
3. Set up PostgreSQL database
4. Configure authentication providers

### 3. OpenAI Setup
1. Sign up at [OpenAI](https://openai.com/)
2. Generate an API key
3. Add to environment variables

## 📁 Project Structure

```
cos-portal-v2/
├── app/                    # Next.js App Router
│   ├── admin/             # Admin panel pages
│   ├── components/        # React components
│   ├── dashboard/         # Dashboard pages
│   └── providers/         # Context providers
├── pages/api/             # API routes
├── prisma/                # Database schema
├── lib/                   # Utility functions
└── public/                # Static assets
```

## 🚀 Deployment

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Other Platforms
- **Netlify**: Similar to Vercel setup
- **Railway**: Supports PostgreSQL out of the box
- **Heroku**: Add PostgreSQL add-on

## 🔒 Security Notes

- Never commit `.env.local` files
- Use environment variables for all secrets
- Regularly rotate API keys
- Enable 2FA on all accounts
- Use HTTPS in production

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is proprietary software. All rights reserved.

## 🆘 Support

For support, please contact the development team or create an issue in the repository.
