import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { aiService } from '../../services';
import { Modal, ModalFooter, Button } from '../ui';
import { cn } from '../../lib/utils';
import { motion as Motion, AnimatePresence } from 'framer-motion';


export function ConversationAnalysisModal({ open, onOpenChange, conversationId }) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const { data: analysis, isLoading, refetch } = useQuery({
        queryKey: ['conversationAnalysis', conversationId],
        queryFn: () => aiService.summarizeConversation(conversationId),
        enabled: false,
    });

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        await refetch();
        setIsAnalyzing(false);
    };

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            title="Conversation Insights"
            description="AI-powered analysis of this conversation"
            size="lg"
        >
            <div className="space-y-6">
                {!analysis && !isLoading && (
                    <div className="text-center py-8">
                        <div className="mb-4">
                            <svg
                                className="h-16 w-16 mx-auto text-gray-600"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                                />
                            </svg>
                        </div>
                        <p className="text-gray-400 mb-4">
                            Get AI-powered insights about this conversation
                        </p>
                        <Button
                            variant="default"
                            onClick={handleAnalyze}
                            loading={isAnalyzing}
                        >
                            Analyze Conversation
                        </Button>
                    </div>
                )}

                {(isLoading || isAnalyzing) && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin h-8 w-8 border-2 border-white border-t-transparent rounded-full" />
                        </div>
                        <p className="text-center text-gray-400 text-sm">
                            Analyzing conversation...
                        </p>
                    </div>
                )}

                {analysis && (
                    <Motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        <div className="glass rounded-lg p-4">
                            <h3 className="text-sm font-semibold text-white mb-2">
                                Summary
                            </h3>
                            <p className="text-sm text-gray-300">
                                {analysis.summary || 'No summary available'}
                            </p>
                        </div>

                        {analysis.key_points && analysis.key_points.length > 0 && (
                            <div className="glass rounded-lg p-4">
                                <h3 className="text-sm font-semibold text-white mb-3">
                                    Key Points
                                </h3>
                                <ul className="space-y-2">
                                    {analysis.key_points.map((point, index) => (
                                        <Motion.li
                                            key={index}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.1 }}
                                            className="flex items-start gap-2 text-sm text-gray-300"
                                        >
                                            <span className="text-white mt-0.5">•</span>
                                            <span>{point}</span>
                                        </Motion.li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            {analysis.sentiment && (
                                <div className="glass rounded-lg p-4">
                                    <h3 className="text-xs font-semibold text-gray-400 mb-2">
                                        Sentiment
                                    </h3>
                                    <p className={cn(
                                        'text-sm font-medium',
                                        analysis.sentiment === 'positive' && 'text-green-400',
                                        analysis.sentiment === 'negative' && 'text-red-400',
                                        analysis.sentiment === 'neutral' && 'text-gray-300'
                                    )}>
                                        {analysis.sentiment.charAt(0).toUpperCase() + analysis.sentiment.slice(1)}
                                    </p>
                                </div>
                            )}

                            {analysis.urgency && (
                                <div className="glass rounded-lg p-4">
                                    <h3 className="text-xs font-semibold text-gray-400 mb-2">
                                        Urgency
                                    </h3>
                                    <p className={cn(
                                        'text-sm font-medium',
                                        analysis.urgency === 'high' && 'text-red-400',
                                        analysis.urgency === 'medium' && 'text-yellow-400',
                                        analysis.urgency === 'low' && 'text-green-400'
                                    )}>
                                        {analysis.urgency.charAt(0).toUpperCase() + analysis.urgency.slice(1)}
                                    </p>
                                </div>
                            )}
                        </div>

                        {analysis.follow_up_required !== undefined && (
                            <div className="glass rounded-lg p-4">
                                <div className="flex items-center gap-2">
                                    {analysis.follow_up_required ? (
                                        <>
                                            <svg
                                                width="16"
                                                height="16"
                                                viewBox="0 0 15 15"
                                                fill="none"
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="text-yellow-400"
                                            >
                                                <path
                                                    d="M7.5 0.875C5.49797 0.875 3.875 2.49797 3.875 4.5C3.875 6.50203 5.49797 8.125 7.5 8.125C9.50203 8.125 11.125 6.50203 11.125 4.5C11.125 2.49797 9.50203 0.875 7.5 0.875Z"
                                                    fill="currentColor"
                                                />
                                            </svg>
                                            <span className="text-sm text-white">
                                                Follow-up action recommended
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <svg
                                                width="16"
                                                height="16"
                                                viewBox="0 0 15 15"
                                                fill="none"
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="text-green-400"
                                            >
                                                <path
                                                    d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L7.39799 11.092C7.29783 11.2452 7.13556 11.3467 6.95402 11.3699C6.77247 11.3931 6.58989 11.3355 6.45446 11.2124L3.70446 8.71241C3.44905 8.48022 3.43023 8.08494 3.66242 7.82953C3.89461 7.57412 4.28989 7.55529 4.5453 7.78749L6.75292 9.79441L10.6018 3.90792C10.7907 3.61902 11.178 3.53795 11.4669 3.72684Z"
                                                    fill="currentColor"
                                                    fillRule="evenodd"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                            <span className="text-sm text-white">
                                                No follow-up needed
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </Motion.div>
                )}
            </div>

            <ModalFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Close
                </Button>
                {analysis && (
                    <Button variant="default" onClick={handleAnalyze} loading={isAnalyzing}>
                        Re-analyze
                    </Button>
                )}
            </ModalFooter>
        </Modal>
    );
}
