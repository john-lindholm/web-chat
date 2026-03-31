# WebChat - Real-time Chat Application

A full-stack real-time chat application with Google OAuth authentication, image sharing, and mobile-responsive design.

## Features

- **Google OAuth Login** - Secure authentication using Google accounts
- **Contact Management** - Add contacts by email, accept/decline contact requests
- **Real-time Messaging** - Instant message delivery using Socket.io
- **Image Sharing** - Upload and share images (stored locally or on S3)
- **Emoji Support** - Rich emoji picker for expressions
- **Mobile Responsive** - Works seamlessly on desktop and mobile devices
- **Typing Indicators** - See when someone is typing

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- Socket.io Client (real-time)
- React Router (navigation)
- @react-oauth/google (Google OAuth)

### Backend
- Node.js + Express
- TypeScript
- Socket.io (WebSocket server)
- SQLite (local database - no server needed!)
- JWT (authentication)
- Multer (file uploads)

## Quick Start - Local Development (No External Resources!)

### Prerequisites

- Node.js 18+

That's it! No PostgreSQL, no AWS account needed for local development.

### 1. Clone the repository

```bash
git clone <repository-url>
cd web-chat
```

### 2. Backend Setup

```bash
cd backend
npm install

# Copy environment file
cp .env.example .env

# Edit .env and add your Google OAuth credentials
# (See Google OAuth Setup below)
```

### 3. Frontend Setup

```bash
cd frontend
npm install

# Copy environment file
cp .env.example .env

# Edit .env and add your Google OAuth Client ID
```

### 4. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google OAuth2 APIs
4. Go to Credentials > Create Credentials > OAuth 2.0 Client ID
5. Application type: **Web application**
6. Set authorized redirect URI: `http://localhost:3000/auth/google/callback`
7. Copy the Client ID and Client Secret to your `.env` files

**Backend `.env`:**
```
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
JWT_SECRET=your_random_secret_here
FRONTEND_URL=http://localhost:3000
```

**Frontend `.env`:**
```
VITE_API_URL=http://localhost:4000
VITE_GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
VITE_GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
```

### 5. Run Development Servers

Terminal 1 (Backend):
```bash
cd backend
npm run dev
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

Open http://localhost:3000 in your browser.

## AWS Deployment (Optional)

When ready to deploy to production on AWS:

### With AWS Copilot

```bash
cd backend
copilot app init webchat
copilot env init --name prod --profile default
copilot deploy --name backend
```

### Frontend Deployment

```bash
cd frontend
npm run build
aws s3 sync dist/ s3://your-bucket-name --delete
```

## Database

The app uses **SQLite** for local development - no database server required! The database file is automatically created at `backend/data/chat.db`.

Tables created automatically on first run:
- `users` - User accounts (Google OAuth)
- `contacts` - Contact relationships
- `conversations` - Chat conversations
- `conversation_participants` - Conversation membership
- `messages` - Chat messages

## API Endpoints

### Authentication
- `GET /auth/google/callback` - Google OAuth callback
- `GET /auth/me` - Get current user
- `POST /auth/logout` - Logout

### Contacts
- `GET /contacts` - Get all contacts
- `POST /contacts` - Add new contact
- `PUT /contacts/:id/accept` - Accept contact request
- `DELETE /contacts/:id` - Delete contact

### Conversations
- `GET /conversations` - Get all conversations
- `POST /conversations/direct/:email` - Get or create direct conversation

### Upload
- `POST /upload/image` - Upload image (multipart/form-data)

## Socket.io Events

### Client -> Server
- `conversation:join` - Join conversation room
- `conversation:leave` - Leave conversation room
- `message:send` - Send a message
- `typing:start` - Start typing indicator
- `typing:stop` - Stop typing indicator

### Server -> Client
- `message:new` - New message received
- `typing:started` - User started typing
- `typing:stopped` - User stopped typing
- `user:online` - User came online
- `user:offline` - User went offline

## Project Structure

```
web-chat/
├── backend/
│   ├── copilot/           # AWS Copilot config
│   ├── data/              # SQLite database (auto-created)
│   ├── uploads/           # Uploaded images (auto-created)
│   ├── src/
│   │   ├── config/        # Database, storage config
│   │   ├── routes/        # API routes
│   │   ├── sockets/       # Socket.io handlers
│   │   └── server.ts      # Entry point
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── context/       # React context (Auth, Socket)
│   │   ├── pages/         # Page components
│   │   ├── lib/           # API client
│   │   └── types/         # TypeScript types
│   └── package.json
└── README.md
```

## License

MIT
