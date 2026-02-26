import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { aiService } from '../../services';
import { Modal, ModalFooter, Button, AILogo } from '../ui';
import { cn } from '../../lib/utils';
import { motion as Motion, AnimatePresence } from 'framer-motion';

export function ConversationAnalysisModal({ open, onOpenChange, conversationId }) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [activeTab, setActiveTab] = useState('summary');
    const queryClient = useQueryClient();

    const { data: analysis, isLoading, refetch } = useQuery({
        queryKey: ['conversationAnalysis', conversationId],
        queryFn: () => aiService.summarizeConversation(conversationId),
        enabled: false,
    });

    const { data: taskData, isLoading: isExtractingTasks } = useQuery({
        queryKey: ['conversationTasks', conversationId],
        queryFn: () => null,
        enabled: false,
    });

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        try {
            // Run both in parallel — summarize + extract tasks directly from messages
            const [, tasksResult] = await Promise.allSettled([
                refetch(),
                queryClient.fetchQuery({
                    queryKey: ['conversationTasks', conversationId],
                    queryFn: () => aiService.extractTasksFromConversation(conversationId),
                    staleTime: 0,
                }),
            ]);

            // If direct extraction failed, fallback to extracting from summary text
            if (tasksResult.status === 'rejected') {
                const analysisResult = queryClient.getQueryData(['conversationAnalysis', conversationId]);
                if (analysisResult) {
                    const summaryText = analysisResult.summary || '';
                    const keyPointsText = (analysisResult.key_points || []).join('. ');
                    const fullText = `${summaryText} ${keyPointsText}`.trim();
                    if (fullText) {
                        await queryClient.fetchQuery({
                            queryKey: ['conversationTasks', conversationId],
                            queryFn: () => aiService.extractTask(fullText),
                            staleTime: 0,
                        });
                    }
                }
            }
        } finally {
            setIsAnalyzing(false);
        }
    };

    const tabs = [
        { id: 'summary', label: 'Summary' },
        { id: 'tasks', label: 'Tasks' },
    ];

    const hasTasks = taskData?.tasks && taskData.tasks.length > 0;

    // Normalize a task object to handle both old and new field names
    const normalizeTask = (task) => {
        if (typeof task === 'string') return { title: task, description: null, date: null, priority: null, status: null };
        return {
            title: task.task_title || task.taskTitle || task.title || task.description || 'Untitled task',
            description: task.description || null,
            date: task.date || task.dueDate || null,
            priority: (task.priority || '').toLowerCase(),
            status: (task.status || 'pending').toLowerCase(),
            assignee: task.assignee || null,
        };
    };

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            title="Conversation Analysis"
            description="AI-powered insights from this conversation"
            size="lg"
        >
            <div className="space-y-5 py-2">
                {/* Initial State */}
                {!analysis && !isLoading && !isAnalyzing && (
                    <div className="flex flex-col items-center justify-center py-12 gap-6">
                        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                            <AILogo className="w-8 h-8 text-blue-400" />
                        </div>
                        <div className="text-center space-y-1.5">
                            <h3 className="text-base font-bold text-[var(--color-foreground)]">Analyze Conversation</h3>
                            <p className="text-xs text-[var(--color-gray-500)] max-w-[260px] leading-relaxed">
                                Extract key points, sentiment, action items, and tasks from this thread.
                            </p>
                        </div>
                        <Button
                            variant="default"
                            onClick={handleAnalyze}
                            className="text-xs font-semibold h-9 px-6"
                        >
                            Run Analysis
                        </Button>
                    </div>
                )}

                {/* Loading */}
                {(isLoading || isAnalyzing) && (
                    <div className="flex flex-col items-center justify-center py-16 gap-4">
                        <div className="w-10 h-10 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin" />
                        <div className="text-center">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">Analyzing…</p>
                            <p className="text-[10px] text-[var(--color-gray-500)] mt-0.5">Processing conversation data</p>
                        </div>
                    </div>
                )}

                {/* Results */}
                {analysis && !isAnalyzing && (
                    <Motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-5"
                    >
                        {/* Tabs */}
                        <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/5">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        "flex-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all",
                                        activeTab === tab.id
                                            ? "bg-white/10 text-[var(--color-foreground)]"
                                            : "text-[var(--color-gray-500)] hover:text-[var(--color-gray-300)]"
                                    )}
                                >
                                    {tab.label}
                                    {tab.id === 'tasks' && hasTasks && (
                                        <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[9px]">
                                            {taskData.tasks.length}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        <AnimatePresence mode="wait">
                            {activeTab === 'summary' && (
                                <Motion.div
                                    key="summary"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="space-y-4"
                                >
                                    {/* Summary */}
                                    <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-4">
                                        <h3 className="text-[10px] uppercase font-semibold tracking-wider text-[var(--color-gray-500)] mb-2">Summary</h3>
                                        <p className="text-sm text-[var(--color-gray-200)] leading-relaxed">
                                            {analysis.summary || 'No summary generated'}
                                        </p>
                                    </div>

                                    {/* Key Points */}
                                    {analysis.key_points && analysis.key_points.length > 0 && (
                                        <div className="space-y-1.5">
                                            <h3 className="text-[10px] uppercase font-semibold tracking-wider text-[var(--color-gray-500)] px-1">Key Points</h3>
                                            {analysis.key_points.map((point, index) => (
                                                <Motion.div
                                                    key={index}
                                                    initial={{ opacity: 0, y: 4 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: index * 0.04 }}
                                                    className="flex gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5"
                                                >
                                                    <span className="text-[10px] font-bold text-[var(--color-gray-500)] mt-px">{String(index + 1).padStart(2, '0')}</span>
                                                    <span className="text-xs text-[var(--color-gray-300)] leading-relaxed">{point}</span>
                                                </Motion.div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Metrics */}
                                    <div className="grid grid-cols-2 gap-3">
                                        {analysis.sentiment && (
                                            <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 text-center">
                                                <p className="text-[10px] uppercase font-medium tracking-wider text-[var(--color-gray-500)] mb-1.5">Sentiment</p>
                                                <span className={cn(
                                                    'px-2.5 py-0.5 rounded-full text-[10px] font-semibold',
                                                    analysis.sentiment.toLowerCase() === 'positive' && 'bg-green-500/10 text-green-400',
                                                    analysis.sentiment.toLowerCase() === 'negative' && 'bg-red-500/10 text-red-400',
                                                    analysis.sentiment.toLowerCase() === 'neutral' && 'bg-white/5 text-[var(--color-gray-300)]'
                                                )}>
                                                    {analysis.sentiment}
                                                </span>
                                            </div>
                                        )}
                                        {analysis.urgency && (
                                            <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 text-center">
                                                <p className="text-[10px] uppercase font-medium tracking-wider text-[var(--color-gray-500)] mb-1.5">Priority</p>
                                                <span className={cn(
                                                    'px-2.5 py-0.5 rounded-full text-[10px] font-semibold',
                                                    analysis.urgency.toLowerCase() === 'high' && 'bg-red-500/10 text-red-400',
                                                    analysis.urgency.toLowerCase() === 'medium' && 'bg-yellow-500/10 text-yellow-400',
                                                    analysis.urgency.toLowerCase() === 'low' && 'bg-green-500/10 text-green-400'
                                                )}>
                                                    {analysis.urgency}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </Motion.div>
                            )}

                            {activeTab === 'tasks' && (
                                <Motion.div
                                    key="tasks"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="space-y-3"
                                >
                                    {isExtractingTasks ? (
                                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                                            <div className="w-8 h-8 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin" />
                                            <p className="text-[10px] font-semibold text-blue-400">Extracting tasks…</p>
                                        </div>
                                    ) : hasTasks ? (
                                        <>
                                            {/* Task count summary */}
                                            <div className="flex items-center gap-2 px-1">
                                                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-gray-500)]">
                                                    {taskData.tasks.length} task{taskData.tasks.length !== 1 ? 's' : ''} found
                                                </span>
                                                {(() => {
                                                    const pending = taskData.tasks.filter(t => (t.status || '').toLowerCase() !== 'done').length;
                                                    const done = taskData.tasks.length - pending;
                                                    return (
                                                        <span className="text-[9px] text-[var(--color-gray-500)]">
                                                            ({pending} pending{done > 0 ? `, ${done} done` : ''})
                                                        </span>
                                                    );
                                                })()}
                                            </div>

                                            {taskData.tasks.map((rawTask, index) => {
                                                const task = normalizeTask(rawTask);
                                                const isDone = task.status === 'done';
                                                return (
                                                    <Motion.div
                                                        key={index}
                                                        initial={{ opacity: 0, y: 4 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: index * 0.04 }}
                                                        className={cn(
                                                            "flex gap-3 p-3 rounded-xl border",
                                                            isDone
                                                                ? "bg-green-500/[0.03] border-green-500/10"
                                                                : "bg-white/[0.02] border-white/5"
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            "mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0",
                                                            isDone ? "border-green-500/50 bg-green-500/10" :
                                                                task.priority === 'high' ? "border-red-500/50 bg-red-500/10" :
                                                                    task.priority === 'medium' ? "border-yellow-500/50 bg-yellow-500/10" :
                                                                        "border-white/20 bg-white/5"
                                                        )}>
                                                            {isDone ? (
                                                                <svg width="10" height="10" viewBox="0 0 15 15" fill="none" className="text-green-400">
                                                                    <path d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L7.39799 11.092C7.29783 11.2452 7.13556 11.3467 6.95402 11.3699C6.77247 11.3931 6.58989 11.3355 6.45446 11.2124L3.70446 8.71241C3.44905 8.48022 3.43023 8.08494 3.66242 7.82953C3.89461 7.57412 4.28989 7.55529 4.5453 7.78749L6.75292 9.79441L10.6018 3.90792C10.7907 3.61902 11.178 3.53795 11.4669 3.72684Z" fill="currentColor" />
                                                                </svg>
                                                            ) : (
                                                                <div className={cn(
                                                                    "w-1.5 h-1.5 rounded-full",
                                                                    task.priority === 'high' ? "bg-red-500" :
                                                                        task.priority === 'medium' ? "bg-yellow-400" : "bg-white/40"
                                                                )} />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className={cn(
                                                                "text-xs font-medium leading-relaxed",
                                                                isDone
                                                                    ? "text-[var(--color-gray-400)] line-through"
                                                                    : "text-[var(--color-foreground)]"
                                                            )}>
                                                                {task.title}
                                                            </p>
                                                            {task.description && task.description !== task.title && (
                                                                <p className="text-[10px] text-[var(--color-gray-500)] mt-0.5 leading-relaxed">{task.description}</p>
                                                            )}
                                                            {task.assignee && (
                                                                <p className="text-[10px] text-[var(--color-gray-500)] mt-0.5">→ {task.assignee}</p>
                                                            )}
                                                            {task.date && (
                                                                <p className={cn(
                                                                    "text-[10px] mt-0.5",
                                                                    isDone ? "text-green-400/60" : "text-blue-400/60"
                                                                )}>
                                                                    {isDone ? '✓ ' : '📅 '}{task.date}
                                                                </p>
                                                            )}
                                                        </div>
                                                        {task.priority && (
                                                            <span className={cn(
                                                                "text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded self-start",
                                                                task.priority === 'high' && "bg-red-500/10 text-red-400",
                                                                task.priority === 'medium' && "bg-yellow-500/10 text-yellow-400",
                                                                task.priority === 'low' && "bg-green-500/10 text-green-400"
                                                            )}>
                                                                {task.priority}
                                                            </span>
                                                        )}
                                                    </Motion.div>
                                                );
                                            })}
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                                            <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center">
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-gray-500)]">
                                                    <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                                                </svg>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-xs font-medium text-[var(--color-gray-400)]">No tasks found</p>
                                                <p className="text-[10px] text-[var(--color-gray-500)] mt-0.5">This conversation has no actionable items</p>
                                            </div>
                                        </div>
                                    )}
                                </Motion.div>
                            )}
                        </AnimatePresence>
                    </Motion.div>
                )}
            </div>

            <ModalFooter>
                <Button
                    variant="ghost"
                    onClick={() => onOpenChange(false)}
                    className="text-xs font-medium text-[var(--color-gray-400)]"
                >
                    Close
                </Button>
                {analysis && (
                    <Button
                        variant="default"
                        onClick={handleAnalyze}
                        loading={isAnalyzing}
                        className="text-xs font-semibold h-9 px-6"
                    >
                        Re-analyze
                    </Button>
                )}
            </ModalFooter>
        </Modal>
    );
}
