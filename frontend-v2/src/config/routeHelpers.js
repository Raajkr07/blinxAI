// Helper: all public paths (used to skip socket/WebRTC init)
import { publicRoutes, protectedRoutes } from './routes';

export const PUBLIC_PATHS = publicRoutes.map(r => r.path);

// Helper: build title map for dynamic <title> updates
export const TITLE_MAP = Object.fromEntries(
    [...publicRoutes, ...protectedRoutes].map(r => [r.path, r.title])
);