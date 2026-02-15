import React from 'react';
import { motion as Motion } from 'framer-motion';
import { BlinkingFace } from '../BlinkingFace';

const DataDeletion = () => {
    return (
        <div className="h-screen w-full bg-black flex flex-col items-center justify-start p-4 md:p-8 relative overflow-y-auto font-['Inter'] custom-scrollbar">
            {/* Background Globs */}
            <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-blue-500/5 blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-purple-500/5 blur-3xl animate-pulse" />
            </div>

            <Motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-4xl relative z-10 py-12"
            >
                <div className="flex flex-col items-center mb-12 text-center">
                    <BlinkingFace className="w-20 h-20 mb-6" />
                    <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight">Data Deletion</h1>
                    <div className="h-1 w-24 bg-rose-500/50 rounded-full mt-6 mb-4" />
                    <p className="text-slate-500 font-medium uppercase tracking-[0.2em] text-sm mb-2">Privacy & Security Control</p>
                    <p className="text-xs text-slate-600">Blink (blinx-app.netlify.app)</p>
                </div>

                <div className="glass-strong rounded-[2.5rem] p-8 md:p-14 text-slate-300 leading-relaxed shadow-2xl border border-white/10">
                    <p className="text-xl mb-12 text-center opacity-90 mx-auto max-w-2xl font-light italic">
                        "Your privacy is a priority. We offer clear, actionable ways to revoke access and permanently remove your data."
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                        <section className="glass p-8 rounded-[2rem] border border-white/10 hover:border-blue-500/30 transition-all flex flex-col justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                                    <span className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm">01</span>
                                    Google Access
                                </h2>
                                <p className="text-sm text-slate-400 mb-6">You can disconnect Blink from your Google account at any time using Google's official security dashboard.</p>
                            </div>
                            <a
                                href="https://myaccount.google.com/permissions"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-blue-400 font-bold hover:text-blue-300 transition-colors group"
                            >
                                Security Dashboard
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                            </a>
                        </section>

                        <section className="glass p-8 rounded-[2rem] border border-white/10 hover:border-rose-500/30 transition-all">
                            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center text-rose-400 text-sm">02</span>
                                Request Deletion
                            </h2>
                            <p className="text-sm text-slate-400 mb-6">To permanently delete your Blink account and all associated temporary metadata, contact us.</p>
                            <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/10 transition-colors">
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Direct Support Email</p>
                                <p className="text-sm font-mono text-white select-all">rk8210032@gmail.com</p>
                            </div>
                        </section>
                    </div>

                    <div className="space-y-6">
                        <section className="glass p-8 rounded-[2rem] border border-white/10">
                            <h2 className="text-xl font-bold text-white mb-2">Policy on Data Persistence</h2>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Because Blink is an educational project, we follow a strict <strong>Minimal Storage Policy</strong>.
                                Most Google user data is never stored on our database. When you disconnect your Google Account,
                                the application automatically loses the ability to fetch new data, and any cached session tokens are invalidated instantly.
                            </p>
                        </section>

                        <section className="glass p-8 rounded-[2rem] border border-white/10 text-center">
                            <h2 className="text-xl font-bold text-white mb-2">SLA for Deletion Requests</h2>
                            <p className="text-slate-400 text-sm">All email requests for data deletion are processed within <span className="text-white font-bold">7 business days</span>. We will send a final verification email once the wipe is complete.</p>
                        </section>
                    </div>

                    <div className="pt-10 border-t border-white/5 flex justify-center mt-10">
                        <a href="/" className="px-10 py-3 rounded-full glass hover:bg-white/10 transition-all font-bold text-white text-sm tracking-widest uppercase">Return to Blink</a>
                    </div>
                </div>
            </Motion.div>

            <p className="text-center mt-8 text-[10px] text-slate-600 uppercase tracking-widest pb-10">
                Educational Project • Security & Privacy Compliance
            </p>
        </div>
    );
};

export default DataDeletion;
