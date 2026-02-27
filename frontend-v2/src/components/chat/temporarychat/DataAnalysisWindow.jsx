import { useRef, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { Button } from '../../ui';
import { useTempViewsStore } from '../../../stores';
import { aiService } from '../../../services';
import toast from 'react-hot-toast';
import {
    ResponsiveContainer,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    BarChart,
    Bar,
    LineChart,
    Line,
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    ScatterChart,
    Scatter,
    ComposedChart
} from 'recharts';

export function DataAnalysisWindow({ onClose }) {
    const fileInputRef = useRef(null);
    const { isCrunching, setIsCrunching, analysisStatus, setAnalysisStatus } = useTempViewsStore();
    const [selectedChart, setSelectedChart] = useState('bar');

    const chartTypes = [
        { id: 'bar', label: 'Bar', icon: '📊' },
        { id: 'line', label: 'Line', icon: '📈' },
        { id: 'area', label: 'Area', icon: '🌊' },
        { id: 'composed', label: 'Composed', icon: '🧩' },
        { id: 'pie', label: 'Pie', icon: '🥧' },
        { id: 'donut', label: 'Donut', icon: '🍩' },
        { id: 'scatter', label: 'Scatter', icon: '📉' },
        { id: 'barHorizontal', label: 'Bar (H)', icon: '📐' }
    ];

    const resolveChartType = () => {
        const serverChartType = analysisStatus?.chartType;
        const isKnown = chartTypes.some((c) => c.id === serverChartType);
        return isKnown ? serverChartType : selectedChart;
    };

    const toChartValues = (payload) => {
        if (!payload || typeof payload !== 'object') return [];

        // Preferred: explicit categories + values
        if (Array.isArray(payload.labels) && Array.isArray(payload.values)) {
            return payload.labels.map((label, index) => ({ name: String(label), value: Number(payload.values[index] ?? 0), index }));
        }

        // Common: { data: [{name,value}, ...] }
        if (Array.isArray(payload.data) && payload.data.every((d) => d && typeof d === 'object')) {
            const normalized = payload.data
                .map((d, index) => ({
                    name: d.name ?? d.label ?? d.x ?? `P${index + 1}`,
                    value: d.value ?? d.y ?? d.count ?? d.amount,
                    index
                }))
                .filter((d) => d.value !== undefined);
            if (normalized.length) {
                return normalized.map((d) => ({ ...d, name: String(d.name), value: Number(d.value) }));
            }
        }

        // Existing backend mock: chartHeights
        if (Array.isArray(payload.chartHeights)) {
            return payload.chartHeights.map((v, index) => ({ name: `P${index + 1}`, value: Number(v), index }));
        }

        // Fallback: series array
        if (Array.isArray(payload.series) && payload.series.length) {
            const s0 = payload.series[0];
            const values = Array.isArray(s0?.data) ? s0.data : [];
            return values.map((v, index) => ({ name: `P${index + 1}`, value: Number(v), index }));
        }

        return [];
    };

    const getChartData = () => {
        const values = toChartValues(analysisStatus);
        if (!values.length) return [];
        return values.map((d) => ({
            name: d.name,
            value: Number.isFinite(d.value) ? d.value : 0,
            x: d.index,
            y: Number.isFinite(d.value) ? d.value : 0
        }));
    };

    const sanitizeText = (text) => {
        if (text === null || text === undefined) return '';
        const s = String(text);
        // Remove common markdown tokens requested by user (** # .) and list markers.
        return s
            .replace(/\*\*/g, '')
            .replace(/^\s*#+\s*/gm, '')
            .replace(/^\s*[-•]+\s*/gm, '')
            .replace(/^\s*\d+\.(\s+)/gm, '')
            .trim();
    };

    const renderSummary = () => {
        const summary = analysisStatus?.summary;

        const datasetType = sanitizeText(summary?.datasetType ?? '');
        const overview = sanitizeText(summary?.overview ?? '');
        const outcomes = Array.isArray(summary?.outcomes) ? summary.outcomes.map(sanitizeText).filter(Boolean) : [];
        const dataQuality = Array.isArray(summary?.dataQuality) ? summary.dataQuality.map(sanitizeText).filter(Boolean) : [];
        const nextSteps = Array.isArray(summary?.recommendedNextSteps) ? summary.recommendedNextSteps.map(sanitizeText).filter(Boolean) : [];

        const hasAny = Boolean(datasetType || overview || outcomes.length || dataQuality.length || nextSteps.length);

        const fallbackOverview = `Processed ${analysisStatus?.rowsParsed ?? ''} rows and prepared a ${resolveChartType()} chart.`;
        const fallbackOutcomes = [
            analysisStatus?.rowsParsed ? `Rows parsed: ${analysisStatus.rowsParsed}` : null,
            analysisStatus?.anomalies ? `Estimated anomalies: ${analysisStatus.anomalies}` : null,
            analysisStatus?.chartType ? `Chart type: ${analysisStatus.chartType}` : null
        ].filter(Boolean).map(sanitizeText);

        return (
            <div className="border border-border bg-background/50 rounded-xl p-4 w-full min-w-0">
                <div className="flex items-center justify-between gap-2 mb-3 flex-nowrap min-w-0">
                    <h4 className="text-sm font-semibold text-foreground leading-none">Summary</h4>
                    {datasetType && (
                        <span className="inline-flex items-center text-[11px] leading-none text-gray-500 border border-border bg-background/60 rounded-lg px-2 py-1 max-w-45 truncate shrink-0">
                            {datasetType}
                        </span>
                    )}
                </div>

                <div className="space-y-3">
                    <div className="text-xs text-gray-400 leading-relaxed">
                        {hasAny ? (overview || 'Summary is ready.') : sanitizeText(fallbackOverview)}
                    </div>

                    {(hasAny ? outcomes : fallbackOutcomes).length > 0 && (
                        <div>
                            <p className="text-xs text-gray-500 mb-1">Outcomes</p>
                            <ul className="text-xs text-gray-400 space-y-1">
                                {(hasAny ? outcomes : fallbackOutcomes).map((item, idx) => (
                                    <li key={idx} className="flex gap-2">
                                        <span className="text-blue-400">•</span>
                                        <span className="leading-relaxed">{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {hasAny && dataQuality.length > 0 && (
                        <div>
                            <p className="text-xs text-gray-500 mb-1">Data quality</p>
                            <ul className="text-xs text-gray-400 space-y-1">
                                {dataQuality.map((item, idx) => (
                                    <li key={idx} className="flex gap-2">
                                        <span className="text-blue-400">•</span>
                                        <span className="leading-relaxed">{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {hasAny && nextSteps.length > 0 && (
                        <div>
                            <p className="text-xs text-gray-500 mb-1">Next steps</p>
                            <ul className="text-xs text-gray-400 space-y-1">
                                {nextSteps.map((item, idx) => (
                                    <li key={idx} className="flex gap-2">
                                        <span className="text-blue-400">•</span>
                                        <span className="leading-relaxed">{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const ChartTooltip = ({ active, payload, label }) => {
        if (!active || !payload || !payload.length) return null;
        const v = payload[0]?.value;
        return (
            <div
                className="rounded-lg border border-border bg-background/90 px-3 py-2 text-xs"
                style={{ backdropFilter: 'blur(10px)' }}
            >
                <div className="text-gray-400">{label}</div>
                <div className="font-mono text-foreground">{v}</div>
            </div>
        );
    };

    const renderChart = () => {
        const type = resolveChartType();
        const chartData = getChartData();

        if (!chartData.length) {
            return (
                <div className="h-56 w-full border border-border bg-background rounded-xl flex items-center justify-center p-4">
                    <p className="text-xs text-gray-500">No chartable data returned by AI.</p>
                </div>
            );
        }

        const common = {
            margin: { top: 10, right: 16, left: 0, bottom: 0 }
        };

        const axisStyle = {
            fontSize: 11,
            fill: 'var(--color-gray-400)'
        };

        const gridStroke = 'var(--color-border)';

        if (type === 'barHorizontal') {
            return (
                <div className="h-72 w-full border border-border bg-background rounded-xl p-3 text-blue-400">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical" {...common}>
                            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
                            <XAxis type="number" tick={axisStyle} />
                            <YAxis type="category" dataKey="name" tick={axisStyle} width={40} />
                            <Tooltip content={<ChartTooltip />} />
                            <Bar dataKey="value" fill="currentColor" fillOpacity={0.25} stroke="currentColor" strokeOpacity={0.8} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            );
        }

        if (type === 'line') {
            return (
                <div className="h-72 w-full border border-border bg-background rounded-xl p-3 text-blue-400">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} {...common}>
                            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={axisStyle} />
                            <YAxis tick={axisStyle} />
                            <Tooltip content={<ChartTooltip />} />
                            <Legend wrapperStyle={{ color: 'var(--color-gray-400)', fontSize: 11 }} />
                            <Line type="monotone" dataKey="value" stroke="currentColor" strokeWidth={2} dot={{ r: 2, fill: 'currentColor' }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            );
        }

        if (type === 'area') {
            return (
                <div className="h-72 w-full border border-border bg-background rounded-xl p-3 text-blue-400">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} {...common}>
                            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={axisStyle} />
                            <YAxis tick={axisStyle} />
                            <Tooltip content={<ChartTooltip />} />
                            <Legend wrapperStyle={{ color: 'var(--color-gray-400)', fontSize: 11 }} />
                            <Area type="monotone" dataKey="value" stroke="currentColor" fill="currentColor" fillOpacity={0.18} strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            );
        }

        if (type === 'scatter') {
            return (
                <div className="h-72 w-full border border-border bg-background rounded-xl p-3 text-blue-400">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart {...common}>
                            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
                            <XAxis type="number" dataKey="x" tick={axisStyle} />
                            <YAxis type="number" dataKey="y" tick={axisStyle} />
                            <Tooltip content={<ChartTooltip />} />
                            <Scatter name="Series" data={chartData} fill="currentColor" fillOpacity={0.35} />
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
            );
        }

        if (type === 'pie' || type === 'donut') {
            const isDonut = type === 'donut';
            const opacities = [0.85, 0.55, 0.35, 0.25, 0.18, 0.12, 0.08];
            return (
                <div className="h-72 w-full border border-border bg-background rounded-xl p-3 text-blue-400">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Tooltip content={<ChartTooltip />} />
                            <Legend wrapperStyle={{ color: 'var(--color-gray-400)', fontSize: 11 }} />
                            <Pie
                                data={chartData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={isDonut ? '55%' : 0}
                                outerRadius="80%"
                                stroke="var(--color-border)"
                                strokeWidth={1}
                            >
                                {chartData.map((_, index) => (
                                    <Cell
                                        key={index}
                                        fill="currentColor"
                                        fillOpacity={opacities[index % opacities.length]}
                                    />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            );
        }

        if (type === 'composed') {
            return (
                <div className="h-72 w-full border border-border bg-background rounded-xl p-3 text-blue-400">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} {...common}>
                            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={axisStyle} />
                            <YAxis tick={axisStyle} />
                            <Tooltip content={<ChartTooltip />} />
                            <Legend wrapperStyle={{ color: 'var(--color-gray-400)', fontSize: 11 }} />
                            <Bar dataKey="value" fill="currentColor" fillOpacity={0.18} stroke="currentColor" strokeOpacity={0.6} />
                            <Line type="monotone" dataKey="value" stroke="currentColor" strokeWidth={2} dot={false} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            );
        }

        // Default: bar
        return (
            <div className="h-72 w-full border border-border bg-background rounded-xl p-3 text-blue-400">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} {...common}>
                        <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={axisStyle} />
                        <YAxis tick={axisStyle} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend wrapperStyle={{ color: 'var(--color-gray-400)', fontSize: 11 }} />
                        <Bar dataKey="value" fill="currentColor" fillOpacity={0.25} stroke="currentColor" strokeOpacity={0.8} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        );
    };

    const handleUploadClick = () => {
        if (fileInputRef.current) fileInputRef.current.click();
    };

    const handleFileChange = async (e) => {
        if (!e.target.files?.length) return;
        const file = e.target.files[0];
        setIsCrunching(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('chartType', selectedChart);
            const data = await aiService.crunchDataAnalysis(formData);
            setAnalysisStatus(data);
            if (data?.chartType && chartTypes.some((c) => c.id === data.chartType)) {
                setSelectedChart(data.chartType);
            }
        } catch {
            toast.error("Failed to crunch data.");
        } finally {
            setIsCrunching(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };
    return (
        <Motion.div
            initial={{ opacity: 0, scale: 0.97, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 15 }}
            transition={{ duration: 0.4, type: "spring", stiffness: 300, damping: 25 }}
            className="flex-1 flex flex-col h-full bg-background text-foreground"
        >
            {/* Header */}
            <div className="h-14 px-6 flex items-center justify-between border-b border-border bg-background/40 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 border border-blue-500/30">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 3v18h18" />
                            <path d="m19 9-5 5-4-4-3 3" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="font-semibold text-blue-400 text-sm tracking-wide">Analytics Engine</h1>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-gray-500 hover:text-foreground rounded-full hover:bg-foreground/10">
                        <svg width="14" height="14" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                        </svg>
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-8 flex flex-col items-center justify-center text-center relative z-10 custom-scrollbar">
                {!isCrunching && !analysisStatus && (
                    <>
                        <div className="p-4 rounded-3xl bg-blue-500/10 mb-6 shadow-[inset_0_0_20px_rgba(59,130,246,0.1)]">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-500">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <line x1="3" y1="9" x2="21" y2="9" />
                                <line x1="9" y1="21" x2="9" y2="9" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold mb-2 text-foreground">Data Cruncher</h2>
                        <p className="text-sm text-gray-400 max-w-sm mx-auto mb-6 leading-relaxed">
                            Upload massive files or raw JSON objects to generate dynamic charts, and summarize data lakes.
                        </p>

                        <div className="grid grid-cols-4 gap-2 mb-6 w-full max-w-sm mx-auto">
                            {chartTypes.map(chart => (
                                <button
                                    key={chart.id}
                                    onClick={() => setSelectedChart(chart.id)}
                                    className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${selectedChart === chart.id
                                            ? 'bg-blue-500/20 border-blue-500/50 text-blue-400 shadow-[inset_0_0_10px_rgba(59,130,246,0.1)]'
                                            : 'bg-background/60 border-border text-gray-400 hover:border-gray-500'
                                        }`}
                                >
                                    <span className="text-xl">{chart.icon}</span>
                                    <span className="text-[10px] font-medium">{chart.label}</span>
                                </button>
                            ))}
                        </div>

                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                        <Button onClick={handleUploadClick} variant="default" className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-500/20">
                            Upload Dataset
                        </Button>
                    </>
                )}

                {isCrunching && (
                    <div className="flex flex-col items-center gap-4">
                        <div className="flex items-center gap-1.5 animate-pulse">
                            <div className="w-2 h-6 bg-blue-500/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-10 bg-blue-500/70 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-8 bg-blue-500/90 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            <div className="w-2 h-12 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '450ms' }} />
                            <div className="w-2 h-5 bg-blue-500/60 rounded-full animate-bounce" style={{ animationDelay: '600ms' }} />
                        </div>
                        <p className="text-sm text-blue-400">Crunching Dataset... Searching for patterns...</p>
                    </div>
                )}

                {analysisStatus && analysisStatus.status === 'ready' && (
                    <div className="w-full max-w-4xl bg-background/60 border border-border rounded-2xl p-6 shadow-xl text-left animate-slide-in-up">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></svg></div>
                            <h3 className="font-semibold text-foreground">Dataset Analysis Complete</h3>
                            <span className="ml-auto text-xs text-gray-500 max-w-30 truncate" title={analysisStatus.filename}>{analysisStatus.filename}</span>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl border border-border bg-background/50">
                                    <p className="text-xs text-gray-500 mb-1">Rows Parsed</p>
                                    <p className="text-xl font-bold font-mono text-blue-400">{analysisStatus.rowsParsed}</p>
                                </div>
                                <div className="p-4 rounded-xl border border-border bg-background/50">
                                    <p className="text-xs text-gray-500 mb-1">Anomalies</p>
                                    <p className="text-xl font-bold font-mono text-red-400">{analysisStatus.anomalies}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-4">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-xs text-gray-500">Chart</p>
                                        <div className="flex flex-wrap gap-1.5 justify-end">
                                            {chartTypes.map((chart) => (
                                                <button
                                                    key={chart.id}
                                                    onClick={() => setSelectedChart(chart.id)}
                                                    className={`px-2 py-1 rounded-lg border text-[11px] transition-all ${resolveChartType() === chart.id
                                                            ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                                                            : 'bg-background/60 border-border text-gray-400 hover:border-gray-500'
                                                        }`}
                                                >
                                                    {chart.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {renderChart()}
                                </div>

                                {renderSummary()}
                            </div>
                        </div>

                        <Button onClick={() => setAnalysisStatus(null)} variant="ghost" className="mt-6 w-full text-gray-400 hover:text-blue-400 hover:bg-blue-500/10">
                            Process Another File
                        </Button>
                    </div>
                )}
            </div>
        </Motion.div>
    );
}
