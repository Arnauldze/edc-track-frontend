# EDC Track - Frontend

A modern project management application built with Next.js for infrastructure project tracking and management.

## 🚀 Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **State Management**: React Hooks
- **Authentication**: JWT-based auth with secure token management
- **HTTP Client**: Axios

## ✨ Key Features

- **Project Management**: Hierarchical project structure with components and activities
- **Advanced Planning**: MS Project-style Gantt charts with multiple planning types
- **Document Management**: Integrated document storage and version control
- **Financial Tracking**: Multi-currency support with detailed budget management
- **Team Collaboration**: Role-based access control with 5 distinct user roles
- **Real-time Updates**: Live notifications and alerts system
- **Responsive Design**: Mobile-first approach with modern UI/UX

## 🏗️ Project Structure

```
src/
├── app/              # Next.js App Router pages
├── components/       # Reusable React components
├── lib/             # Utilities and helpers
├── services/        # API integration layer
└── types/           # TypeScript type definitions
```

## 🔧 Environment Setup

Create a `.env.local` file with the following variable:

```env
NEXT_PUBLIC_API_URL=your_api_url
```

## 📦 Installation

```bash
npm install
```

## 🏃 Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## 🏭 Production Build

```bash
npm run build
npm start
```

## 📱 Deployment

The application is optimized for deployment on:
- Vercel (recommended for Next.js)
- AWS Amplify
- Netlify

## 🔐 Security Features

- Secure authentication flow with JWT tokens
- Protected routes and API endpoints
- Input validation and sanitization
- XSS protection
- CORS configuration

## 📄 License

Private project - All rights reserved

## 👤 Author

Arnauld ZEH
