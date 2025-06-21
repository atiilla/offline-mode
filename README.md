# Offline Mode Next.js App

A Next.js application with offline functionality, PWA support, and background job processing.

## Features

- **Next.js 15** with App Router
- **TypeScript** throughout the project
- **Tailwind CSS** for styling
- **PWA Support** with service worker
- **Offline Form Handling** with local storage
- **Background Job Processing** (ready for BullMQ integration)
- **Redis Integration** (ready for implementation)

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

- `src/app/` - Next.js App Router pages and API routes
- `src/components/` - React components
- `src/hooks/` - Custom React hooks
- `src/lib/` - Utility functions and libraries
- `public/` - Static assets and PWA manifest

## Environment Variables

Copy `.env.example` to `.env.local` and configure your environment variables.

## PWA Features

This app includes:
- Service worker for offline functionality
- Web app manifest for installability
- Offline form submission with local storage
- Online/offline status detection

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint