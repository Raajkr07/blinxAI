import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';

export default function SummaryModal({ isOpen, onClose, summaryData }) {
    // Graceful fallback if data is missing
    if (!summaryData) return null;

    return (
        <Transition show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[200]" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    {/* Backdrop */}
                    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" />
                </Transition.Child>

                <div className="fixed inset-0 z-10 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            enterTo="opacity-100 translate-y-0 sm:scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                        >
                            <Dialog.Panel className="relative transform overflow-hidden rounded-2xl bg-[#0f172a] border border-white/10 text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                                <div className="px-6 py-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <Dialog.Title as="h3" className="text-xl font-bold text-white flex items-center gap-2">
                                            <span className="text-2xl">✨</span> Conversation Insights
                                        </Dialog.Title>
                                        <button
                                            onClick={onClose}
                                            className="text-slate-400 hover:text-white transition-colors rounded-full p-1 hover:bg-white/5 focus:outline-none"
                                        >
                                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>

                                    <div className="space-y-6">
                                        {/* Sentiment & Urgency Badges */}
                                        <div className="flex flex-wrap gap-3">
                                            <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${summaryData.sentiment === 'positive' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                    summaryData.sentiment === 'negative' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                        'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                                }`}>
                                                {summaryData.sentiment || 'Neutral'}
                                            </div>
                                            <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${summaryData.urgency === 'high' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                    summaryData.urgency === 'medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                        'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                                }`}>
                                                {summaryData.urgency || 'Low'} Urgency
                                            </div>
                                        </div>

                                        {/* Summary */}
                                        <div className="bg-slate-900/50 rounded-xl p-4 border border-white/5">
                                            <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Summary</h4>
                                            <p className="text-slate-200 leading-relaxed text-sm">
                                                {summaryData.summary}
                                            </p>
                                        </div>

                                        {/* Key Points */}
                                        <div>
                                            <h4 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wide">Key Points</h4>
                                            <ul className="space-y-2">
                                                {summaryData.key_points?.map((point, i) => (
                                                    <li key={i} className="flex gap-3 text-sm text-slate-300">
                                                        <span className="text-indigo-400 mt-0.5">•</span>
                                                        {point}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        {/* Follow Up Check */}
                                        {summaryData.follow_up_required && (
                                            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 flex items-start gap-3">
                                                <div className="p-1.5 bg-indigo-500/20 rounded-lg">
                                                    <span className="text-indigo-300 text-lg">💡</span>
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-semibold text-indigo-300">Follow-up Recommended</h4>
                                                    <p className="text-xs text-indigo-300/70 mt-0.5">
                                                        This conversation likely requires further action.
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-black/20 px-6 py-4 flex justify-end">
                                    <button
                                        onClick={onClose}
                                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors border border-white/5 shadow-sm"
                                    >
                                        Close
                                    </button>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}
