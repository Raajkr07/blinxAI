import { motion as Motion } from 'framer-motion';
import { BlinkingFace } from '../../pages/BlinkingFace';
import { toast } from 'react-hot-toast';

export const LegalLayout = ({ title, lastUpdated, children }) => {
    const handleSupportClick = () => {
        toast.success('Opening email for support...', {
            icon: '✉️',
            style: {
                borderRadius: '12px',
                background: '#333',
                color: '#fff',
                fontSize: '12px',
                fontWeight: '600'
            }
        });
    };

    return (
        <div className="h-screen bg-[var(--color-background)] text-[var(--color-foreground)] selection:bg-blue-500/30 overflow-y-auto">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-background)]/80 backdrop-blur-xl">
                <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <BlinkingFace className="w-8 h-8" />
                        <span className="font-bold text-xl tracking-tight">Blinx AI</span>
                    </div>
                    <a
                        href="/"
                        className="text-sm font-medium text-[var(--color-gray-400)] hover:text-[var(--color-foreground)] transition-colors"
                    >
                        Back to Home
                    </a>
                </div>
            </header>

            {/* Content */}
            <main className="pt-32 pb-24 px-6">
                <Motion.article
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="max-w-3xl mx-auto"
                >
                    <header className="mb-12">
                        <h1 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-[var(--color-foreground)] to-[var(--color-gray-400)]">
                            {title}
                        </h1>
                        <p className="text-[var(--color-gray-500)] text-sm font-medium flex items-center gap-2">
                            <span className="w-4 h-px bg-[var(--color-border)]"></span>
                            Last Updated: {lastUpdated}
                        </p>
                    </header>

                    <div className="space-y-12 pb-12 text-[var(--color-gray-300)] leading-relaxed">
                        {children}
                    </div>
                </Motion.article>
            </main>

            {/* Footer */}
            <footer className="border-t border-[var(--color-border)] py-12 px-6 bg-black/5 flex-shrink-0">
                <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex flex-col items-center md:items-start gap-2 text-center md:text-left">
                        <p className="text-sm font-medium">Blinx AI Assistant</p>
                        <p className="text-xs text-[var(--color-gray-500)]">
                            &copy; {new Date().getFullYear()} blinxAI.me All rights reserved.
                        </p>
                    </div>

                    <nav className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-xs font-semibold uppercase tracking-widest text-[var(--color-gray-500)]">
                        <a href="/terms" className="hover:text-blue-500 transition-colors">Terms</a>
                        <a href="/privacy-policy" className="hover:text-blue-500 transition-colors">Privacy</a>
                        <a href="/data-deletion" className="hover:text-blue-500 transition-colors">Deletion</a>
                        <a
                            href="mailto:rk8210032@gmail.com"
                            onClick={handleSupportClick}
                            className="hover:text-blue-500 transition-colors"
                        >
                            Support
                        </a>
                    </nav>
                </div>
            </footer>
        </div>
    );
};
