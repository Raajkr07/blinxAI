import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/ui/Button';

// Developer Humor

const DEV_QUOTES = [
    { text: "It's not a bug — it's an undocumented feature.", author: 'Every developer ever' },
    { text: 'There are only 10 types of people: those who understand binary and those who don\'t.', author: 'Anonymous' },
    { text: '404 errors are just the internet\'s way of saying "you had one job."', author: 'Stack Overflow wisdom' },
    { text: 'A QA engineer walks into a bar. Orders 1 beer. Orders 0 beers. Orders 99999999 beers. Orders -1 beers. Orders a lizard.', author: 'r/ProgrammerHumor' },
    { text: 'The page you\'re looking for is in another castle.', author: 'Super Mario, probably' },
    { text: 'This page went to get milk and never came back.', author: 'The Internet' },
    { text: '// TODO: add this page (opened 3 years ago)', author: 'GitHub Issues' },
    { text: 'git commit -m "deleted the page you were looking for, sorry"', author: 'Some intern' },
    { text: 'Have you tried turning the URL off and on again?', author: 'IT Crowd methodology' },
    { text: 'This page passed all tests in staging.', author: 'Famous last words' },
];

const SUGGESTED_PAGES = [
    { path: '/', label: 'Chat', icon: '💬', desc: 'Jump into conversations' },
    { path: '/auth', label: 'Login', icon: '🔐', desc: 'Sign in to your account' },
    { path: '/privacy-policy', label: 'Privacy', icon: '🛡️', desc: 'How we handle your data' },
    { path: '/terms', label: 'Terms', icon: '📜', desc: 'Service agreement' },
];

// Terminal Log (typewriter effect)

const TerminalLog = ({ pathname }) => {
    const [lines, setLines] = useState([]);
    const termRef = useRef(null);

    const logLines = useMemo(() => [
        { color: 'text-gray-500', text: `$ curl -I https://blinxai.me${pathname}` },
        { color: 'text-yellow-400', text: 'HTTP/1.1  404 Not Found' },
        { color: 'text-gray-500', text: 'Content-Type: text/html; charset=utf-8' },
        { color: 'text-gray-500', text: `X-Request-Path: ${pathname}` },
        { color: 'text-red-400', text: `Error: ENOENT — no such route '${pathname}'` },
        { color: 'text-gray-500', text: '  at Router.resolve (react-router-dom/dist/index.js:42:17)' },
        { color: 'text-gray-500', text: '  at matchRoutes (routes.jsx:1:1)' },
        { color: 'text-green-400', text: '// but hey, at least the server is running 🎉' },
    ], [pathname]);

    useEffect(() => {
        let active = true;
        const built = [];
        const timers = logLines.map((_, i) =>
            setTimeout(() => {
                if (!active) return;
                built.push(logLines[i]);
                setLines([...built]);
            }, 400 + i * 320)
        );
        return () => { active = false; timers.forEach(clearTimeout); };
    }, [logLines]);

    useEffect(() => {
        if (termRef.current) {
            termRef.current.scrollTop = termRef.current.scrollHeight;
        }
    }, [lines]);

    return (
        <Motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.5 }}
            className="w-full max-w-md mx-auto"
        >
            <div className="rounded-xl border border-white/[0.06] bg-[#0d1117] overflow-hidden shadow-2xl shadow-black/40">
                {/* Title bar */}
                <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.06]">
                    <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                    <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
                    <span className="w-3 h-3 rounded-full bg-[#28c840]" />
                    <span className="ml-3 text-[11px] text-gray-500 font-mono">blinx — debug console</span>
                </div>
                {/* Lines */}
                <div ref={termRef} className="p-4 font-mono text-[11px] leading-[1.7] max-h-48 overflow-y-auto scroll-smooth">
                    <AnimatePresence>
                        {lines.map((line, i) => (
                            <Motion.p
                                key={i}
                                initial={{ opacity: 0, x: -6 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.18 }}
                                className={line.color}
                            >
                                {line.text}
                            </Motion.p>
                        ))}
                    </AnimatePresence>
                    {lines.length < logLines.length && (
                        <span className="inline-block w-2 h-4 bg-green-400/80 animate-pulse ml-0.5 align-middle" />
                    )}
                </div>
            </div>
        </Motion.div>
    );
};

// Floating Particles

// Pre-computed outside component so Math.random() is not called during render
const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    x: (i * 37 + 13) % 100,
    y: (i * 53 + 7) % 100,
    size: 1.5 + (i % 5) * 0.6,
    duration: 6 + (i % 7) * 1.5,
    delay: (i % 4) * 1.2,
    opacity: 0.08 + (i % 6) * 0.025,
    drift: ((i % 3) - 1) * 15,
}));

const FloatingParticles = () => (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {PARTICLES.map(p => (
            <Motion.div
                key={p.id}
                className="absolute rounded-full bg-green-400"
                style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, opacity: p.opacity }}
                animate={{
                    y: [0, -40, 0],
                    x: [0, p.drift, 0],
                    opacity: [p.opacity, p.opacity * 2, p.opacity],
                }}
                transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
            />
        ))}
    </div>
);

// Glitch Text

const GlitchText = ({ text }) => (
    <span className="relative inline-block select-none">
        <span className="relative z-10">{text}</span>
        <Motion.span
            className="absolute inset-0 text-red-500/30 z-0"
            aria-hidden="true"
            animate={{ x: [0, -2, 2, -1, 0], y: [0, 1, -1, 0.5, 0] }}
            transition={{ duration: 0.3, repeat: Infinity, repeatDelay: 3 }}
        >
            {text}
        </Motion.span>
        <Motion.span
            className="absolute inset-0 text-cyan-500/20 z-0"
            aria-hidden="true"
            animate={{ x: [0, 2, -2, 1, 0], y: [0, -1, 1, -0.5, 0] }}
            transition={{ duration: 0.3, repeat: Infinity, repeatDelay: 3, delay: 0.05 }}
        >
            {text}
        </Motion.span>
    </span>
);

// Lizard on Tree (cursor-following eyes)

const LizardOnTree = () => {
    const svgRef = useRef(null);
    const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!svgRef.current) return;
            const rect = svgRef.current.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const dx = e.clientX - cx;
            const dy = e.clientY - cy;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const maxOffset = 3;
            setEyeOffset({ x: (dx / dist) * maxOffset, y: (dy / dist) * maxOffset });
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    return (
        <Motion.svg
            ref={svgRef}
            viewBox="0 0 400 300"
            className="w-full max-w-md mx-auto drop-shadow-[0_0_60px_rgba(76,175,80,0.12)]"
            initial={{ opacity: 0, y: 30, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
            {/* Tree trunk */}
            <rect x="175" y="180" width="50" height="120" rx="8" fill="#5D4037" />
            <rect x="180" y="185" width="8" height="110" rx="3" fill="#4E342E" opacity="0.4" />
            <rect x="200" y="190" width="5" height="100" rx="2" fill="#6D4C41" opacity="0.3" />
            {/* Bark texture */}
            <line x1="190" y1="200" x2="192" y2="230" stroke="#4E342E" strokeWidth="1" opacity="0.25" />
            <line x1="208" y1="210" x2="210" y2="260" stroke="#4E342E" strokeWidth="1" opacity="0.2" />

            {/* Branch */}
            <path d="M60 170 Q120 155 200 165 Q280 175 360 155" stroke="#6D4C41" strokeWidth="18" fill="none" strokeLinecap="round" />
            <path d="M70 165 Q130 150 200 160 Q270 170 350 150" stroke="#8D6E63" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.4" />
            {/* Knots on branch */}
            <circle cx="150" cy="162" r="4" fill="#5D4037" />
            <circle cx="260" cy="166" r="3" fill="#5D4037" />

            {/* Leaves cluster - left */}
            <ellipse cx="80" cy="145" rx="25" ry="15" fill="#2E7D32" opacity="0.7" />
            <ellipse cx="65" cy="152" rx="18" ry="10" fill="#388E3C" opacity="0.6" />
            <ellipse cx="95" cy="138" rx="15" ry="9" fill="#43A047" opacity="0.5" />

            {/* Leaves cluster - right */}
            <ellipse cx="330" cy="135" rx="28" ry="14" fill="#2E7D32" opacity="0.7" />
            <ellipse cx="350" cy="142" rx="20" ry="11" fill="#388E3C" opacity="0.6" />
            <ellipse cx="315" cy="128" rx="14" ry="8" fill="#43A047" opacity="0.5" />

            {/* Leaves cluster - top center */}
            <ellipse cx="200" cy="130" rx="20" ry="10" fill="#2E7D32" opacity="0.45" />
            <ellipse cx="185" cy="136" rx="12" ry="7" fill="#388E3C" opacity="0.35" />

            {/* Lizard body */}
            <g>
                {/* Tail - curly */}
                <Motion.path
                    d="M115 158 Q95 140 100 120 Q105 100 120 110 Q130 118 125 130"
                    stroke="#66BB6A" strokeWidth="5" fill="none" strokeLinecap="round"
                    animate={{ d: ['M115 158 Q95 140 100 120 Q105 100 120 110 Q130 118 125 130', 'M115 158 Q92 142 98 118 Q103 96 122 108 Q132 120 126 132', 'M115 158 Q95 140 100 120 Q105 100 120 110 Q130 118 125 130'] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                />
                <path d="M115 158 Q95 140 100 120 Q105 100 120 110 Q130 118 125 130" stroke="#81C784" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5" />

                {/* Back legs */}
                <path d="M135 162 L120 178 L115 176" stroke="#4CAF50" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="114" cy="176" r="2" fill="#4CAF50" />
                <path d="M140 168 L128 185 L123 183" stroke="#4CAF50" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="122" cy="183" r="2" fill="#4CAF50" />

                {/* Torso */}
                <ellipse cx="175" cy="158" rx="52" ry="12" fill="#66BB6A" />
                <ellipse cx="175" cy="162" rx="42" ry="5" fill="#A5D6A7" opacity="0.5" />
                {/* Scale pattern */}
                <circle cx="155" cy="153" r="3" fill="#43A047" opacity="0.5" />
                <circle cx="170" cy="150" r="2.5" fill="#43A047" opacity="0.4" />
                <circle cx="188" cy="152" r="3.5" fill="#43A047" opacity="0.5" />
                <circle cx="200" cy="155" r="2" fill="#43A047" opacity="0.3" />
                <circle cx="145" cy="156" r="2" fill="#43A047" opacity="0.3" />
                <circle cx="162" cy="148" r="1.8" fill="#43A047" opacity="0.25" />

                {/* Front legs */}
                <path d="M210 162 L222 180 L228 178" stroke="#4CAF50" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="229" cy="178" r="2" fill="#4CAF50" />
                <path d="M215 168 L230 186 L236 184" stroke="#4CAF50" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="237" cy="184" r="2" fill="#4CAF50" />

                {/* Neck */}
                <ellipse cx="225" cy="155" rx="15" ry="10" fill="#66BB6A" />

                {/* Head */}
                <ellipse cx="248" cy="150" rx="22" ry="16" fill="#66BB6A" />
                <ellipse cx="248" cy="140" rx="12" ry="4" fill="#4CAF50" opacity="0.4" />
                <path d="M232 155 Q248 165 268 153" stroke="#4CAF50" strokeWidth="1.5" fill="none" opacity="0.4" />

                {/* Snout */}
                <ellipse cx="268" cy="148" rx="8" ry="6" fill="#66BB6A" />
                <circle cx="274" cy="146" r="1.2" fill="#2E7D32" />
                <path d="M264 152 Q270 154 276 151" stroke="#2E7D32" strokeWidth="1" fill="none" strokeLinecap="round" />

                {/* Eyes — cursor tracking */}
                <circle cx="240" cy="144" r="7" fill="#FFF9C4" stroke="#33691E" strokeWidth="1.5" />
                <circle cx={240 + eyeOffset.x} cy={144 + eyeOffset.y} r="3.5" fill="#1B5E20" />
                <circle cx={240 + eyeOffset.x + 1} cy={144 + eyeOffset.y - 1} r="1.2" fill="white" opacity="0.8" />

                <circle cx="255" cy="142" r="7" fill="#FFF9C4" stroke="#33691E" strokeWidth="1.5" />
                <circle cx={255 + eyeOffset.x} cy={142 + eyeOffset.y} r="3.5" fill="#1B5E20" />
                <circle cx={255 + eyeOffset.x + 1} cy={142 + eyeOffset.y - 1} r="1.2" fill="white" opacity="0.8" />

                {/* Tongue */}
                <Motion.path
                    d="M276 151 Q285 153 290 148 M285 153 Q290 158 295 155"
                    stroke="#EF5350" strokeWidth="1.5" fill="none" strokeLinecap="round"
                    animate={{ opacity: [1, 0.2, 1], scaleX: [1, 0.7, 1] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                />
            </g>

            {/* Falling leaves (multiple) */}
            <Motion.g
                animate={{ y: [0, 90], x: [0, 18], rotate: [0, 200] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            >
                <ellipse cx="300" cy="100" rx="6" ry="3" fill="#81C784" opacity="0.6" />
            </Motion.g>
            <Motion.g
                animate={{ y: [0, 110], x: [0, -12], rotate: [0, -160] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
            >
                <ellipse cx="120" cy="95" rx="5" ry="2.5" fill="#A5D6A7" opacity="0.45" />
            </Motion.g>
            <Motion.g
                animate={{ y: [0, 70], x: [0, 10], rotate: [0, 120] }}
                transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
            >
                <ellipse cx="220" cy="105" rx="4" ry="2" fill="#66BB6A" opacity="0.35" />
            </Motion.g>

            {/* Speech bubble from lizard */}
            <Motion.g
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.8, duration: 0.5, ease: 'easeOut' }}
            >
                <rect x="270" y="95" width="105" height="36" rx="10" fill="white" opacity="0.9" />
                <polygon points="275,131 285,131 270,140" fill="white" opacity="0.9" />
                <text x="322" y="113" textAnchor="middle" fill="#1B5E20" fontSize="9" fontWeight="700" fontFamily="monospace">
                    404? Not my fault!
                </text>
            </Motion.g>
        </Motion.svg>
    );
};

// Quote Rotator

const QuoteRotator = () => {
    const [index, setIndex] = useState(() => Math.floor(Math.random() * DEV_QUOTES.length));

    const nextQuote = useCallback(() => {
        setIndex(prev => (prev + 1) % DEV_QUOTES.length);
    }, []);

    useEffect(() => {
        const timer = setInterval(nextQuote, 6000);
        return () => clearInterval(timer);
    }, [nextQuote]);

    const quote = DEV_QUOTES[index];

    return (
        <Motion.button
            onClick={nextQuote}
            className="w-full max-w-md mx-auto text-center cursor-pointer group"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4, duration: 0.5 }}
            title="Click for another quote"
        >
            <div className="relative px-5 py-4 rounded-xl border border-white/[0.06] bg-white/[0.02] transition-all duration-300 group-hover:border-green-500/20 group-hover:bg-green-500/[0.03]">
                <span className="absolute -top-2 left-4 text-green-500/40 text-lg font-serif">&ldquo;</span>
                <AnimatePresence mode="wait">
                    <Motion.div
                        key={index}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.3 }}
                    >
                        <p className="text-[13px] text-gray-400 italic leading-relaxed">{quote.text}</p>
                        <p className="text-[10px] text-gray-600 mt-2 font-mono">— {quote.author}</p>
                    </Motion.div>
                </AnimatePresence>
                <span className="absolute -bottom-2 right-4 text-green-500/40 text-lg font-serif">&rdquo;</span>
            </div>
            <p className="text-[9px] text-gray-700 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                click for more dev wisdom
            </p>
        </Motion.button>
    );
};

// Quick-Nav Cards

const QuickNav = () => (
    <Motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.5 }}
        className="w-full max-w-md mx-auto"
    >
        <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-bold mb-3 text-center">
            Maybe you were looking for
        </p>
        <div className="grid grid-cols-2 gap-2">
            {SUGGESTED_PAGES.map(({ path, label, icon, desc }) => (
                <Link
                    key={path}
                    to={path}
                    className="group flex items-start gap-3 p-3 rounded-xl border border-white/[0.05] bg-white/[0.02] hover:border-green-500/20 hover:bg-green-500/[0.04] transition-all duration-200"
                >
                    <span className="text-lg mt-0.5 group-hover:scale-110 transition-transform">{icon}</span>
                    <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-gray-300 group-hover:text-white transition-colors truncate">{label}</p>
                        <p className="text-[10px] text-gray-600 leading-snug mt-0.5">{desc}</p>
                    </div>
                </Link>
            ))}
        </div>
    </Motion.div>
);

// HTTP Status Badge

const StatusBadge = () => (
    <Motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15, duration: 0.4, ease: 'backOut' }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20"
    >
        <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
        <span className="text-[11px] font-mono font-bold text-red-400 tracking-wide">HTTP 404</span>
    </Motion.div>
);

// Main Page

const NotFound = () => {
    const { pathname } = useLocation();
    const [elapsed, setElapsed] = useState(0);

    // Time wasted counter (developer humour)
    useEffect(() => {
        const t = setInterval(() => setElapsed(s => s + 1), 1000);
        return () => clearInterval(t);
    }, []);

    const formatTime = (s) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
    };

    return (
        <div className="h-screen w-full bg-black flex flex-col items-center relative overflow-y-auto overflow-x-hidden">
          <div className="w-full flex flex-col items-center justify-start py-10 px-5">
            {/* Background */}
            <FloatingParticles />
            <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/5 h-[500px] w-[500px] rounded-full bg-green-500/[0.04] blur-[120px]" />
                <div className="absolute bottom-1/4 right-1/5 h-[400px] w-[400px] rounded-full bg-blue-500/[0.03] blur-[100px]" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-purple-500/[0.02] blur-[150px]" />
            </div>

            {/* Grid pattern overlay */}
            <div
                className="fixed inset-0 -z-10 opacity-[0.03] pointer-events-none"
                style={{
                    backgroundImage: 'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
                    backgroundSize: '60px 60px',
                }}
            />

            <div className="w-full max-w-lg mx-auto flex flex-col items-center gap-7 relative z-10">
                {/* Status badge */}
                <StatusBadge />

                {/* Lizard illustration */}
                <LizardOnTree />

                {/* 404 headline */}
                <Motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="text-center -mt-2"
                >
                    <h1 className="text-[7rem] sm:text-[9rem] font-black tracking-tighter text-white/[0.06] select-none leading-none">
                        <GlitchText text="404" />
                    </h1>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white -mt-6 tracking-tight">
                        Page Not Found
                    </h2>
                    <p className="text-gray-400 mt-3 text-sm max-w-sm mx-auto leading-relaxed">
                        Looks like this page wandered off into the wild.
                        Even our lizard friend up there can&apos;t spot it — and those eyes follow
                        <em> everything</em>.
                    </p>
                    {/* Path badge */}
                    <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                        <span className="text-[11px] text-gray-600 font-mono">→</span>
                        <code className="text-[11px] text-red-400/80 font-mono">{pathname}</code>
                    </div>
                </Motion.div>

                {/* Actions */}
                <Motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6, duration: 0.5 }}
                    className="flex flex-wrap justify-center gap-3"
                >
                    <Link to="/">
                        <Button variant="default" size="lg" className="rounded-full px-8 shadow-lg shadow-white/5">
                            ← Take Me Home
                        </Button>
                    </Link>
                    <Link to="/auth">
                        <Button variant="glass" size="lg" className="rounded-full px-8">
                            Sign In
                        </Button>
                    </Link>
                </Motion.div>

                {/* Terminal log */}
                <TerminalLog pathname={pathname} />

                {/* Quick nav */}
                <QuickNav />

                {/* Dev quote rotator */}
                <QuoteRotator />

                {/* Time wasted */}
                <Motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2 }}
                    className="text-[10px] text-gray-700 font-mono text-center"
                >
                    Time spent on this 404 page: <span className="text-green-500/60">{formatTime(elapsed)}</span>
                    {elapsed >= 10 && <span className="ml-1 text-gray-600">— you could be coding right now 👀</span>}
                    {elapsed >= 30 && <span className="ml-1 text-gray-600">…seriously</span>}
                    {elapsed >= 60 && <span className="ml-1 text-gray-600">🦎 even the lizard left</span>}
                </Motion.p>

                {/* Footer links */}
                <Motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.6 }}
                    className="flex justify-center gap-6 mt-4 pb-6 text-[10px] uppercase tracking-widest text-slate-700 font-bold"
                >
                    <Link to="/privacy-policy" className="hover:text-green-400 transition-colors">Privacy</Link>
                    <Link to="/terms" className="hover:text-green-400 transition-colors">Terms</Link>
                    <Link to="/data-deletion" className="hover:text-green-400 transition-colors">Data Deletion</Link>
                </Motion.div>
            </div>
          </div>
        </div>
    );
};

export default NotFound;
