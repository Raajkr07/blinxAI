// routes.jsx — Centralised route definitions for Blinx AI Assistant.
// Public routes  → accessible without authentication.
// Protected routes → require authentication (fallback to AuthPage).
// Catch-all      → 404 Not Found page.

import { lazy } from 'react';

// Lazy-loaded pages
const AuthPage = lazy(() => import('../pages/AuthPage'));
const ChatPage = lazy(() => import('../pages/ChatPage'));
const PrivacyPolicy = lazy(() => import('../pages/verification/PrivacyPolicy'));
const TermsOfService = lazy(() => import('../pages/verification/TermsOfService'));
const DataDeletion = lazy(() => import('../pages/verification/DataDeletion'));
const VerifyPage = lazy(() => import('../pages/verification/VerifyPage'));
const OAuthFallback = lazy(() => import('../pages/OAuthFallback'));
const RedirectToChat = lazy(() => import('../pages/RedirectToChat'));
const NotFound = lazy(() => import('../pages/NotFound'));

// Public routes — no authentication required.
// Each entry: { path, element, title? }
export const publicRoutes = [
    {
        path: '/auth',
        element: AuthPage,
        title: 'Login | Blinx AI Assistant',
    },
    {
        path: '/privacy-policy',
        element: PrivacyPolicy,
        title: 'Privacy Policy | Blinx AI Assistant',
    },
    {
        path: '/terms',
        element: TermsOfService,
        title: 'Terms of Service | Blinx AI Assistant',
    },
    {
        path: '/data-deletion',
        element: DataDeletion,
        title: 'Data Deletion | Blinx AI Assistant',
    },
    {
        path: '/verify',
        element: VerifyPage,
        title: 'Verifying Account | Blinx AI Assistant',
    },
    {
        path: '/oauth-error',
        element: OAuthFallback,
        title: 'Login Failed | Blinx AI Assistant',
    },
];

// Protected routes — require authentication.
// Unauthenticated users are shown AuthPage instead.
export const protectedRoutes = [
    {
        path: '/chat',
        element: ChatPage,
        title: 'Blinx AI Assistant | Chat',
    },
    {
        path: '/',
        element: RedirectToChat,
        title: 'Blinx AI Assistant | Chat',
    },
];

// Fallback route — 404 Not Found.
export const notFoundRoute = {
    path: '*',
    element: NotFound,
    title: 'Page Not Found | Blinx AI Assistant',
};
