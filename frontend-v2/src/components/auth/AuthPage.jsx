import { useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Login } from './Login';
import { Signup } from './Signup';

export function AuthPage() {
    const [mode, setMode] = useState('login');

    return (
        <div className="min-h-screen w-full bg-black flex items-center justify-center p-4 overflow-y-auto">
            <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-white/5 blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-white/5 blur-3xl animate-pulse" />
            </div>

            <div className="w-full max-w-[448px] mx-auto">
                <Motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-8"
                >
                    <h1 className="text-5xl font-bold tracking-tight glow-strong mb-2">
                        Blink
                    </h1>
                    <p className="text-base text-gray-400">Futuristic Chat Experience</p>
                </Motion.div>

                <AnimatePresence mode="wait">
                    {mode === 'login' ? (
                        <Motion.div
                            key="login"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                        >
                            <Login onSwitchToSignup={() => setMode('signup')} />
                        </Motion.div>
                    ) : (
                        <Motion.div
                            key="signup"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <Signup onSwitchToLogin={() => setMode('login')} />
                        </Motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
