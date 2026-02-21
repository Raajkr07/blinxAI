import { useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Login } from './Login';
import { Signup } from './Signup';
import { BlinkingFace } from './BlinkingFace';
import { cn } from '../lib/utils';

const AuthPage = () => {
    const [mode, setMode] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        const urlMode = params.get('mode');
        return (urlMode === 'signup' || urlMode === 'login') ? urlMode : 'login';
    });
    const [initialIdentifier] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('v');
        if (token) {
            try { return atob(token).split(':')[1] || ''; } catch { return ''; }
        }
        return params.get('identifier') || '';
    });
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div className="min-h-screen w-full bg-black flex items-center justify-center p-4 relative overflow-hidden">
            <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-blue-500/5 blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-purple-500/5 blur-3xl animate-pulse" />
            </div>

            {/* Google Features Info Icon - Top Right */}
            <div className="fixed right-6 top-6 z-50 flex flex-col items-end gap-3">
                <Motion.button
                    onHoverStart={() => setIsHovered(true)}
                    onHoverEnd={() => setIsHovered(false)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300",
                        "glass border border-white/10 hover:border-blue-500/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]",
                        isHovered ? "bg-blue-500/20" : "bg-white/5"
                    )}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("transition-colors", isHovered ? "text-blue-400" : "text-white")}>
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                </Motion.button>

                <AnimatePresence>
                    {isHovered && (
                        <Motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            className="w-72 glass-strong p-6 rounded-2xl border border-white/10 shadow-2xl relative mt-2"
                        >
                            <div className="absolute right-4 top-[-8px] w-4 h-4 glass-strong rotate-45 border-t border-l border-white/10" />
                            <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-3">
                                <BlinkingFace className="w-6 h-6" />
                                <span>Unlock Features</span>
                            </h3>
                            <p className="text-xs text-slate-500 mb-2 italic">
                                Blinx AI Assistant is a next-gen, AI-powered chat application.</p>
                            <p className="text-sm text-slate-400 leading-relaxed">
                                To use our <span className="text-blue-400 font-semibold">AI Tools</span> for sending emails and managing your calendar, please
                                <span className="text-white font-medium"> Login or Signup with Google</span>.
                            </p>
                            <p className="text-xs text-slate-500 m-2 italic">
                                Note: For better visibility change window size to 90%. "CTRL" + "-"
                            </p>
                            <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-3">
                                <div className="flex -space-x-2">
                                    <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-[10px]">📧</div>
                                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-[10px]">📅</div>
                                </div>
                                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Ready for Action</span>
                            </div>
                        </Motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="w-full max-w-[448px] mx-auto">
                <Motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-8"
                >
                    <div className="flex justify-center mb-4">
                        <BlinkingFace className="w-20 h-20" />
                    </div>
                    <h1 className="text-5xl font-bold tracking-tight mb-2 text-white text-nowrap">Blinx AI Assistant</h1>
                </Motion.div>

                <AnimatePresence mode="wait">
                    {mode === 'login' ? (
                        <Motion.div
                            key="login"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                        >
                            <Login onSwitchToSignup={() => setMode('signup')} initialIdentifier={initialIdentifier} />
                        </Motion.div>
                    ) : (
                        <Motion.div
                            key="signup"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <Signup onSwitchToLogin={() => setMode('login')} initialIdentifier={initialIdentifier} />
                        </Motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="fixed bottom-8 left-0 right-0 flex justify-center gap-8 text-[10px] uppercase tracking-widest text-slate-500 font-bold z-50">
                <Link to="/privacy-policy" className="hover:text-blue-400 transition-all duration-300 glass px-4 py-2 rounded-full border border-white/5 hover:border-blue-500/30">Privacy</Link>
                <Link to="/terms" className="hover:text-blue-400 transition-all duration-300 glass px-4 py-2 rounded-full border border-white/5 hover:border-blue-500/30">Terms</Link>
                <Link to="/data-deletion" className="hover:text-blue-400 transition-all duration-300 glass px-4 py-2 rounded-full border border-white/5 hover:border-blue-500/30">Data Deletion</Link>
            </div>
        </div>
    );
};

export default AuthPage;
