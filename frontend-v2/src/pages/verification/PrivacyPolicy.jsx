import React from 'react';
import { motion as Motion } from 'framer-motion';
import { BlinkingFace } from '../BlinkingFace';

const PrivacyPolicy = () => {
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
                    <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight">Privacy Policy</h1>
                    <div className="h-1 w-24 bg-blue-500/50 rounded-full mt-6 mb-4" />
                    <p className="text-slate-500 font-medium uppercase tracking-[0.2em] text-sm mb-2">Blink Assistant - Educational Project</p>
                    <p className="text-xs text-slate-600">Hosted at: <span className="text-blue-500/70">blinx-app.netlify.app</span></p>
                </div>

                <div className="glass-strong rounded-[2.5rem] p-8 md:p-14 text-slate-300 leading-relaxed shadow-2xl border border-white/10">

                    {/* CRITICAL GOOGLE COMPLIANCE STATEMENT */}
                    <div className="mb-12 p-6 rounded-3xl bg-blue-500/5 border border-blue-500/20">
                        <h2 className="text-blue-400 font-bold mb-3 flex items-center gap-2 text-lg">
                            <span className="text-xl">⚖️</span> Google API Disclosure
                        </h2>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            Blink Assistant's use and transfer of information received from Google APIs to any other app will adhere to
                            <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline mx-1">
                                Google API Services User Data Policy
                            </a>,
                            including the <strong>Limited Use</strong> requirements. We do not use your Google data to display advertisements or for any other commercial purposes.
                        </p>
                    </div>

                    <section className="mb-12">
                        <div className="flex items-center gap-4 mb-6">
                            <span className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold">01</span>
                            <h2 className="text-2xl font-bold text-white">Introduction</h2>
                        </div>
                        <p className="text-lg opacity-90">
                            <strong>Blink Assistant</strong> is an AI-powered productivity tool developed as an educational project.
                            We are committed to protecting your privacy and being transparent about our data practices. This policy details how we handle information accessed through Google OAuth 2.0.
                        </p>
                    </section>

                    <section className="mb-12">
                        <div className="flex items-center gap-4 mb-6">
                            <span className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-bold">02</span>
                            <h2 className="text-2xl font-bold text-white">Specific Data Access & Scopes</h2>
                        </div>
                        <p className="mb-8 opacity-90">
                            To enable the <strong>Model Context Protocol (MCP)</strong> features, we require the following restricted scopes:
                        </p>

                        <div className="space-y-6">
                            <div className="glass p-6 rounded-3xl border border-white/10">
                                <h3 className="text-white font-bold mb-3 flex items-center gap-3">
                                    <span className="text-xl">📧</span> Gmail API (https://www.googleapis.com/auth/gmail.modify)
                                </h3>
                                <p className="text-sm text-slate-400 mb-4">
                                    <strong>Usage:</strong> Our AI assistant reads email headers and content only when you explicitly ask it to summarize your inbox or find information. It can draft replies which are only sent upon your final confirmation.
                                </p>
                            </div>

                            <div className="glass p-6 rounded-3xl border border-white/10">
                                <h3 className="text-white font-bold mb-3 flex items-center gap-3">
                                    <span className="text-xl">📅</span> Calendar API (https://www.googleapis.com/auth/calendar)
                                    )</h3>
                                <p className="text-sm text-slate-400 mb-4">
                                    <strong>Usage:</strong> The AI tool reads your availability to suggest meeting times and writes to your calendar to create events or reminders based on your chat instructions.
                                </p>
                            </div>
                        </div>
                    </section>

                    <section className="mb-12">
                        <div className="flex items-center gap-4 mb-6">
                            <span className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">03</span>
                            <h2 className="text-2xl font-bold text-white">Data Storage & Security</h2>
                        </div>
                        <div className="space-y-4 opacity-90">
                            <p>
                                • <strong>Minimal Persistence:</strong> We do not store your Gmail or Calendar data on our permanent servers. Data is fetched on-the-fly and processed in temporary memory (RAM) during your session.
                            </p>
                            <p>
                                • <strong>Encryption:</strong> All communication between Blink, your browser, and Google servers is encrypted using Industry-standard TLS (Transport Layer Security).
                            </p>
                            <p>
                                • <strong>No Selling:</strong> Your data is never sold to third parties, used for marketing, or leveraged by external AI models for training.
                            </p>
                        </div>
                    </section>

                    <section className="mb-12">
                        <div className="flex items-center gap-4 mb-6">
                            <span className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 font-bold">04</span>
                            <h2 className="text-2xl font-bold text-white">Your Control</h2>
                        </div>
                        <p className="opacity-90 mb-6">
                            You have absolute control over your data:
                        </p>
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <li className="p-4 rounded-2xl bg-white/5 border border-white/5 text-sm">
                                <strong className="text-white block mb-1">Revoke Access</strong>
                                Disconnect anytime via your Google Security portal.
                            </li>
                            <li className="p-4 rounded-2xl bg-white/5 border border-white/5 text-sm">
                                <strong className="text-white block mb-1">Data Deletion</strong>
                                Request account wipe via <span className="text-blue-400 font-mono">rk8210032@gmail.com</span>.
                            </li>
                        </ul>
                    </section>

                    <div className="mt-12 pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 text-sm">
                        <div className="text-slate-500">
                            Last Updated: <span className="text-slate-400 font-medium">Feb 15, 2026</span>
                        </div>
                        <div className="flex gap-6">
                            <a href="/data-deletion" className="text-blue-400 hover:text-blue-300 transition-colors">Data Deletion</a>
                            <a href="/" className="px-6 py-2 rounded-full glass hover:bg-white/10 transition-all font-bold text-white">← App Home</a>
                        </div>
                    </div>
                </div>

                <p className="text-center mt-8 text-[10px] text-slate-600 uppercase tracking-widest">
                    Blink Assistant is a student-led educational initiative • rk8210032@gmail.com
                </p>
            </Motion.div>
        </div>
    );
};

export default PrivacyPolicy;
