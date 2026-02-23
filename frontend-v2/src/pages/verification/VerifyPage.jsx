import { useEffect, useState, useRef } from 'react';
import { motion as Motion } from 'framer-motion';
import { BlinkingFace } from '../BlinkingFace';
import { authService, userService } from '../../services';
import { useAuthStore } from '../../stores';
import { Button } from '../../components/ui';
import { cn } from '../../lib/utils';

const VerifyPage = () => {
    const [status, setStatus] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return !params.get('v') ? 'error' : 'verifying';
    });
    const [message, setMessage] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return !params.get('v')
            ? 'Invalid verification link.'
            : 'Verifying your credentials...';
    });
    const { setUser, setTokens } = useAuthStore();
    const hasAttempted = useRef(false);

    useEffect(() => {
        if (hasAttempted.current) return;

        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('v');

        if (!token) return;

        const performVerification = async () => {
            hasAttempted.current = true;
            try {
                // Decode token (Base64)
                let decoded;
                try {
                    decoded = atob(token);
                } catch (error) {
                    void error;
                    throw new Error('Invalid verification link.');
                }

                const [otp, identifier] = decoded.split(':');
                if (!otp || !identifier) throw new Error('Malformed verification token');

                const normalizedId = identifier.trim().includes('@') ? identifier.trim().toLowerCase() : identifier.trim();

                // Call login directly which handles OTP verification
                const loginData = await authService.login({
                    identifier: normalizedId,
                    otp: otp.trim()
                });

                if (loginData.accessToken) {
                    setTokens(loginData.accessToken, loginData.refreshToken);
                    const userData = await userService.getMe();
                    setUser(userData);

                    setStatus('success');
                    setMessage('Identity verified! Redirecting to chat...');
                    setTimeout(() => { window.location.href = '/chat'; }, 2000);
                } else {
                    setStatus('error');
                    setMessage('Verification failed.');
                }
            } catch (err) {
                const errorMessage = err?.message;

                if (errorMessage === 'Profile incomplete') {
                    setStatus('success');
                    setMessage('Redirecting to set up your profile...');
                    setTimeout(() => {
                        window.location.href = `/auth?mode=signup&v=${encodeURIComponent(token)}`;
                    }, 2000);
                    return;
                }

                setStatus('error');
                setMessage('Verification failed. Please try again.');
            }
        };

        performVerification();
    }, [setUser, setTokens]);

    return (
        <div className="min-h-screen w-full bg-[var(--color-background)] flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-300">
            <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none opacity-20 transition-opacity duration-300">
                <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-blue-500 blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-purple-500 blur-3xl animate-pulse" />
            </div>

            <Motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                    "w-full max-w-md glass-strong p-8 rounded-[2.5rem] border shadow-2xl text-center",
                    "border-white/10 dark:border-white/10 light:border-black/5"
                )}
            >
                <div className="flex justify-center mb-6">
                    <BlinkingFace className="w-20 h-20" />
                </div>

                <h1 className="text-3xl font-bold text-[var(--color-foreground)] mb-4">Account Verification</h1>

                <div className="space-y-6">
                    {status === 'verifying' && (
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                            <p className="text-[var(--color-gray-400)] font-medium">{message}</p>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </div>
                            <p className="text-emerald-500 font-bold text-lg">{message}</p>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center border border-rose-500/20">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </div>
                            <p className="text-rose-500 font-medium">{message}</p>
                            <Button
                                onClick={() => window.location.href = '/auth'}
                                variant="glass"
                                className="mt-4 rounded-full px-8"
                            >
                                Back to Login
                            </Button>
                        </div>
                    )}
                </div>
            </Motion.div>
        </div>
    );
};

export default VerifyPage;
