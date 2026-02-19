import React from 'react';
import { motion as Motion } from 'framer-motion';
import { BlinkingFace } from '../BlinkingFace';
import { env } from '../../config/env';

const TermsOfService = () => {
    return (
        <div className="h-screen w-full bg-black flex flex-col items-center justify-start p-4 md:p-8 relative overflow-y-auto font-['Inter'] custom-scrollbar">
            {/* Background Globs */}
            <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-blue-500/5 blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-purple-500/5 blur-3xl animate-pulse" />
            </div>

            <Motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-4xl relative z-10 py-12"
            >
                <div className="flex flex-col items-center mb-12 text-center">
                    <BlinkingFace className="w-20 h-20 mb-6" />
                    <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight">Terms of Service</h1>
                    <div className="h-1 w-24 bg-purple-500/50 rounded-full mt-6 mb-4" />
                    <p className="text-slate-500 font-medium uppercase tracking-[0.2em] text-sm mb-2">{env.APP_NAME} - Educational Project</p>
                    <p className="text-xs text-slate-600">Site: <span className="text-purple-500/70">{env.APP_DOMAIN}</span></p>
                </div>

                <div className="glass-strong rounded-[2.5rem] p-8 md:p-14 text-slate-300 leading-relaxed shadow-2xl border border-white/10">
                    <section className="mb-12">
                        <div className="flex items-center gap-4 mb-6">
                            <span className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold">01</span>
                            <h2 className="text-2xl font-bold text-white">Project Nature</h2>
                        </div>
                        <p className="text-lg opacity-90">
                            <strong>Blinx AI Assistant</strong> is an experimental, non-commercial application created solely for educational and academic evaluation. It is not a commercial product.
                        </p>
                    </section>

                    <section className="mb-12">
                        <div className="flex items-center gap-4 mb-6">
                            <span className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-bold">02</span>
                            <h2 className="text-2xl font-bold text-white">Google Integration</h2>
                        </div>
                        <p className="opacity-90 mb-4">
                            By connecting your Google account, you grant Blinx AI Assistant access to your Gmail and Calendar data. This access is limited to the functionality of the AI MCP tools within the app.
                        </p>
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-sm italic text-slate-400">
                            "Blinx AI Assistant complies with the Google API Services User Data Policy, ensuring your restricted data is used according to the Limited Use requirements."
                        </div>
                    </section>

                    <section className="mb-12">
                        <div className="flex items-center gap-4 mb-6">
                            <span className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">03</span>
                            <h2 className="text-2xl font-bold text-white">Limitations of Use</h2>
                        </div>
                        <div className="glass p-8 rounded-3xl border border-white/10 space-y-4">
                            <p className="text-sm text-slate-400">
                                <strong className="text-white block mb-1">No Commercial Use:</strong> You may not use this application for any commercial or business operations.
                            </p>
                            <p className="text-sm text-slate-400">
                                <strong className="text-white block mb-1">No Warranties:</strong> The service is provided "AS IS". We make no guarantees regarding security, uptime, or data accuracy.
                            </p>
                            <p className="text-sm text-slate-400">
                                <strong className="text-white block mb-1">Assumption of Risk:</strong> Users acknowledge that this is a student project and use it at their own discretion and risk.
                            </p>
                        </div>
                    </section>

                    <section className="mb-12">
                        <div className="flex items-center gap-4 mb-6">
                            <span className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 font-bold">04</span>
                            <h2 className="text-2xl font-bold text-white">Termination</h2>
                        </div>
                        <p className="opacity-90">
                            We reserve the right to terminate access to the application or its Google-integrated features at any time during this academic evaluation phase.
                        </p>
                    </section>

                    <div className="mt-12 pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 text-sm">
                        <div className="text-slate-500 font-medium">
                            Last Updated: <span className="text-slate-400">Feb 15, 2026</span>
                        </div>
                        <div className="flex gap-4">
                            <a href="/privacy-policy" className="text-slate-400 hover:text-white transition-colors">Privacy Policy</a>
                            <a href="/" className="px-6 py-2 rounded-full glass hover:bg-white/10 transition-all font-bold text-white">← App Index</a>
                        </div>
                    </div>
                </div>

                <p className="text-center mt-8 text-[10px] text-slate-600 uppercase tracking-widest">
                    {env.APP_NAME} - Educational Project • {env.CONTACT_EMAIL}
                </p>
            </Motion.div>
        </div>
    );
};

export default TermsOfService;
