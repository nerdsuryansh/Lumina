import {
    ChangeEvent, DragEvent, KeyboardEvent,
    useRef, useState, useEffect, useCallback
} from "react";
import ReactMarkdown from "react-markdown";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Metal } from "argentui";
import { LiquidMetalCard } from "./components/LiquidMetalCard";
import "argentui/styles.css";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ───────────────────────────────────────────────────────────────────

type LabResult = {
    test_name: string;
    value: string;
    normal_range: string;
    status_badge: "Low" | "Normal" | "High";
};
type MedicalSummary = { summary: string; results: LabResult[] };
type HistoryEntry = {
    id: string; date: string; fileName: string;
    summary: string; results: LabResult[]; chat?: ChatMsg[];
};
type ChatMsg = { role: "user" | "assistant"; content: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractNums(s: string): number[] {
    if (!s) return [];
    return (String(s).replace(/,/g, '').match(/\d+\.?\d*/g) || []).map(Number);
}
function buildContext(data: MedicalSummary, file: string): string {
    return [
        `Medical Report: ${file}`,
        `Summary: ${data.summary}`,
        "Lab Results:",
        ...data.results.map(r => `- ${r.test_name}: ${r.value} (${r.normal_range}) — ${r.status_badge}`)
    ].join("\n");
}
const STORE = "lumina_history";
const loadHistory = (): HistoryEntry[] => { try { return JSON.parse(localStorage.getItem(STORE) || "[]"); } catch { return []; } };
const saveHistory = (h: HistoryEntry[]) => localStorage.setItem(STORE, JSON.stringify(h));

// ─── Icons ──────────────────────────────

const Icons = {
    upload: () => <svg style={{ display: "block" }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>,
    x: () => <svg style={{ display: "block" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
    send: () => <svg style={{ display: "block" }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>,
    history: () => <svg style={{ display: "block" }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="12 8 12 12 14 14" /><path d="M3.05 11a9 9 0 1 0 .5-4" /><polyline points="3 3 3 7 7 7" /></svg>,
    export: () => <svg style={{ display: "block" }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>,
    trash: () => <svg style={{ display: "block" }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>,
    warn: () => <svg style={{ display: "block" }} width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /></svg>,
    check: () => <svg style={{ display: "block" }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
    sparkles: () => <svg style={{ display: "block" }} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /><path d="M20 3v4" /><path d="M22 5h-4" /><path d="M4 17v2" /><path d="M5 18H3" /></svg>,
    expand: () => <svg style={{ display: "block" }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>,
    shrink: () => <svg style={{ display: "block" }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" /></svg>,
    fileText: () => <svg style={{ display: "block" }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>,
    barChart: () => <svg style={{ display: "block" }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></svg>,
    messageCircle: () => <svg style={{ display: "block" }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>,
    user: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
    panel: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="9" y1="3" x2="9" y2="21" /></svg>,
    minus: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>,
    plus: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
    settings: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
    info: () => <svg style={{ display: 'block' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>,
};
// ─── Sub-components ───────────────────────────────────────────────────────────

const AnimatedCard = ({ children, style, className }: any) => {
    const [isVisible, setIsVisible] = useState(false);
    const domRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    if (domRef.current) observer.unobserve(domRef.current);
                }
            });
        }, { threshold: 0.1, rootMargin: "0px 0px -40px 0px" });
        if (domRef.current) observer.observe(domRef.current);
        return () => { if (domRef.current) observer.unobserve(domRef.current); }
    }, []);
    return (
        <article
            ref={domRef}
            className={className}
            style={{
                ...style,
                animation: "none",
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateY(0) scale(1)" : "translateY(40px) scale(0.98)",
                transition: "opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)"
            }}
        >
            {children}
        </article>
    );
};

const Badge = ({ s }: { s: "Low" | "Normal" | "High" }) => {
    const isNormal = s === "Normal";
    
    const bg = isNormal ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)";
    const border = isNormal ? "rgba(34, 197, 94, 0.4)" : "rgba(239, 68, 68, 0.4)";
    const textColor = isNormal ? "#4ade80" : "#f87171";

    return (
        <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            background: bg,
            border: `1px solid ${border}`,
            borderRadius: 8, padding: "4px 12px",
            fontSize: 11, fontWeight: 800, color: textColor,
            fontFamily: "inherit",
            textTransform: "uppercase",
            letterSpacing: 1,
            boxShadow: `0 0 12px ${bg}`
        }}>
            {s}
        </span>
    );
};

const RangeBar = ({ value, normal_range, status }: { value: string; normal_range: string; status: "Low" | "Normal" | "High" }) => {
    const vNums = extractNums(value);
    const rNums = extractNums(normal_range);
    if (!vNums.length || !rNums.length) return null;

    const isUpperOnly = rNums.length === 1 || (
        normal_range.includes('<') && !normal_range.match(/\d+.*-.*\d+/)
    );
    const rMin = isUpperOnly ? 0 : rNums[0];
    const rMax = isUpperOnly ? rNums[0] : rNums[rNums.length - 1];
    if (rMin >= rMax) return null;

    const hasLessThanPrefix = /^</.test(value.trim());
    const val = hasLessThanPrefix ? rMin + (rMax - rMin) * 0.35 : vNums[0];

    let bMin = Math.min(rMin, val);
    let bMax = Math.max(rMax, val);
    const actualSpan = bMax - bMin || 1;
    bMin = Math.max(0, bMin - actualSpan * 0.15);
    bMax = bMax + actualSpan * 0.15;
    const bSpan = bMax - bMin;
    
    let percent = Math.max(0, Math.min(100, ((val - bMin) / bSpan) * 100));
    if (percent < 2) percent = 2;
    if (percent > 98) percent = 98;

    const isLow = status === "Low";
    const isHigh = status === "High";

    // Soft gradient fill colors for aesthetic
    const fillGradient = (isLow || isHigh) 
        ? "linear-gradient(90deg, rgba(239, 68, 68, 0.4) 0%, rgba(239, 68, 68, 0.9) 100%)" 
        : "linear-gradient(90deg, rgba(14, 165, 233, 0.4) 0%, rgba(14, 165, 233, 0.9) 100%)";

    const rangeLabel = isUpperOnly ? `< ${rMax}` : `${rMin} – ${rMax}`;

    return (
        <div style={{ marginTop: 22 }}>
            <div style={{ 
                height: 26, 
                background: "rgba(255,255,255,0.03)", 
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 999, 
                position: "relative",
                display: "flex",
                alignItems: "center",
                overflow: "hidden", // CRITICAL: Fixes the square clipping issue!
                boxShadow: "inset 0 2px 10px rgba(0,0,0,0.2)"
            }}>
                {/* Curvy Colored Fill Bar */}
                <div style={{ 
                    position: "absolute", 
                    left: 0, 
                    top: 0,
                    height: "100%",
                    width: `${percent}%`, 
                    background: fillGradient, 
                    borderRadius: 999, 
                    zIndex: 2,
                    transition: "width 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
                    boxShadow: "0 0 12px rgba(255,255,255,0.1)"
                }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>
                <span>{bMin.toFixed(1)}</span>
                <span style={{ color: "rgba(255,255,255,0.4)" }}>Normal: {rangeLabel}</span>
                <span>{bMax.toFixed(1)}</span>
            </div>
        </div>
    );
};

const TrendChart = ({ name, entries }: { name: string; entries: HistoryEntry[] }) => {
    const pts = entries.flatMap(e => {
        const r = e.results.find(r => r.test_name.toLowerCase() === name.toLowerCase());
        if (!r) return [];
        const n = extractNums(r.value)[0];
        if (n === undefined) return [];
        return [{ date: new Date(e.date).toLocaleDateString("en", { month: "short", day: "numeric" }), val: n, s: r.status_badge }];
    });
    if (pts.length < 2) return <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 12, padding: "10px 0 20px", textAlign: "center" }}>Need ≥2 reports for "{name}"</p>;
    const W = 480, H = 90, P = 18;
    const vals = pts.map(p => p.val), mn = Math.min(...vals), mx = Math.max(...vals), vSpan = mx - mn || 1;
    const xS = (W - P * 2) / (pts.length - 1);
    const tx = (i: number) => P + i * xS;
    const ty = (v: number) => H - P - ((v - mn) / vSpan) * (H - P * 2);
    const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${tx(i)} ${ty(p.val)}`).join(" ");
    const dotColor = (s: string) => s === "Normal" ? "#22c55e" : s === "High" ? "#eab308" : "#ef4444";
    return (
        <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>{name}</p>
            <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
                <defs><linearGradient id={`g${name}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" /><stop offset="100%" stopColor="#3b82f6" stopOpacity="0" /></linearGradient></defs>
                <path d={d + ` L ${tx(pts.length - 1)} ${H} L ${tx(0)} ${H} Z`} fill={`url(#g${name})`} />
                <path d={d} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                {pts.map((p, i) => (
                    <g key={i}>
                        <circle cx={tx(i)} cy={ty(p.val)} r={4} fill={dotColor(p.s)} stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
                        <text x={tx(i)} y={H - 3} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.3)">{p.date}</text>
                        <text x={tx(i)} y={ty(p.val) - 9} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.55)">{p.val}</text>
                    </g>
                ))}
            </svg>
        </div>
    );
};

// ─── Skeleton ────────────────────────────────────────────────────────────────
const Skel = ({ w, h }: { w: string | number; h: number }) => (
    <div style={{ width: w, height: h, background: "rgba(255,255,255,0.07)", borderRadius: 6, animation: "lm-pulse 1.6s ease-in-out infinite" }} />
);



// ─── Main ────────────────────────────────────────────────────────────────────


export const Desktop = (): JSX.Element => {
    const fileRef = useRef<HTMLInputElement>(null);
    const chatScrollRef = useRef<HTMLDivElement>(null);
    const [fileName, setFileName] = useState("");
    const [dragging, setDragging] = useState(false);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<MedicalSummary | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
    const [showHist, setShowHist] = useState(false);
    const [showAbout, setShowAbout] = useState(false);
    const [histTab, setHistTab] = useState<"history" | "trends">("history");
    const [chat, setChat] = useState<ChatMsg[]>([]);
    const [chatIn, setChatIn] = useState("");
    const [chatLoading, setChatLoading] = useState(false);
    const [ctx, setCtx] = useState("");
    const [visible, setVisible] = useState<Set<number>>(new Set());
    const [lastFile, setLastFile] = useState<File | null>(null);
    const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem("lumina_model") || "llama-3.3-70b-versatile");
    const [customApiKey, setCustomApiKey] = useState(() => localStorage.getItem("lumina_custom_api_key") || "");
    const [apiKeyErr, setApiKeyErr] = useState<{ type: "quota" | "invalid" | "network" | "settings" | null }>({ type: null });
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [hasSeenChatTooltip, setHasSeenChatTooltip] = useState(() => localStorage.getItem("lumina_chat_tooltip_seen") === "true");
    const [isChatFullScreen, setIsChatFullScreen] = useState(false);
    const [isChatMinimized, setIsChatMinimized] = useState(false);
    const [isPdfHidden, setIsPdfHidden] = useState(false);
    const [renderChat, setRenderChat] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);
    const [cooldown, setCooldown] = useState(0);
    const [ripples, setRipples] = useState<{ x: number, y: number, id: number }[]>([]);
    const rippleId = useRef(0);

    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setInterval(() => setCooldown(c => c - 1), 1000);
        return () => clearInterval(t);
    }, [cooldown]);

    useEffect(() => {
        // Force Metal WebGL component to re-render during CSS transitions
        const start = Date.now();
        const timer = setInterval(() => {
            window.dispatchEvent(new Event('resize'));
            if (Date.now() - start > 600) clearInterval(timer);
        }, 16);
        return () => clearInterval(timer);
    }, [isChatMinimized, isChatFullScreen, chat.length]);
    const exportPdf = async () => {
        setIsExporting(true);
        try {
            const el = document.getElementById("report-content");
            if (!el) return;
            const canvas = await html2canvas(el, { 
                scale: 2, 
                useCORS: true, 
                backgroundColor: "#152331",
                ignoreElements: (node) => node.classList && node.classList.contains("no-print")
            });
            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [canvas.width / 2, canvas.height / 2] });
            pdf.addImage(imgData, "PNG", 0, 0, canvas.width / 2, canvas.height / 2);
            pdf.save("Lumina_Medical_Summary.pdf");
        } catch (err) {
            console.error("Export err:", err);
            setErr(err instanceof Error ? err.message : String(err));
        } finally {
            setIsExporting(false);
        }
    };

    useEffect(() => {
        if (isChatOpen) setRenderChat(true);
        else {
            const t = setTimeout(() => setRenderChat(false), 200);
            return () => clearTimeout(t);
        }
    }, [isChatOpen]);

    // Animate cards in on data load via CSS (no opacity gating)
    useEffect(() => {
        if (!data) return;
    }, [data, loading, isPdfHidden]);

    // Auto-minimize chat on scroll down
    useEffect(() => {
        let lastScroll = 0;
        const handleScroll = (e: any) => {
            if (isChatFullScreen) return;
            
            // Ignore scrolls inside the chat box itself!
            if (e.target && e.target.classList && e.target.classList.contains("ai-chat-scroll")) {
                return;
            }

            // Get scroll position from window, document, or the specific scrolling target
            const currentScroll = window.scrollY || document.documentElement.scrollTop || (e.target.scrollTop || 0);
            
            if (currentScroll - lastScroll > 50 && currentScroll > 300) {
                setIsChatMinimized(true);
            }
            lastScroll = currentScroll;
        };
        
        // Use capture: true to catch scroll events even if a child element hijacked the document scroll
        window.addEventListener("scroll", handleScroll, { passive: true, capture: true });
        return () => window.removeEventListener("scroll", handleScroll, { capture: true } as any);
    }, [isChatFullScreen]);

    useEffect(() => {
        if (chatScrollRef.current && chat.length > 1) {
            // Only scroll for subsequent messages, let the first one just expand naturally
            setTimeout(() => {
                const el = chatScrollRef.current;
                if (el && el.lastElementChild) {
                    const targetTop = (el.lastElementChild as HTMLElement).offsetTop - el.offsetTop;
                    el.scrollTo({ top: targetTop, behavior: "smooth" });
                }
            }, 50);
        }
    }, [chat]);

    const doUpload = useCallback(async (file: File) => {
        if (file.size > 20 * 1024 * 1024) { setErr("File too large — max 20 MB."); return; }
        setLoading(true); setErr(null); setData(null); setChat([]); setIsPdfHidden(true);
        setPdfUrl(URL.createObjectURL(file));
        const fd = new FormData(); fd.append("file", file);
        fd.append("model", selectedModel);
        const headers: Record<string, string> = {};
        if (customApiKey) headers["Authorization"] = `Bearer ${customApiKey}`;
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 120000);
            const res = await fetch(`${API_BASE_URL}/upload/`, { method: "POST", headers, body: fd, signal: controller.signal });
            clearTimeout(timeout);
            if (res.status === 401) { setApiKeyErr({ type: "invalid" }); setPdfUrl(null); setLoading(false); setIsPdfHidden(false); return; }
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                const msg = body.detail || `Server error ${res.status}`;
                if (res.status === 429) {
                    const match = msg.match(/wait ([\dhms.]+)/);
                    if (match) {
                        const timeStr = match[1];
                        if (timeStr.includes('h') || timeStr.includes('m')) {
                            setErr(`Daily limit reached. Resets in ${timeStr}. Add your own API key in Settings to bypass.`);
                            setApiKeyErr({ type: "quota" });
                        } else {
                            const secs = parseFloat(timeStr) || parseInt(timeStr);
                            setCooldown(Math.ceil(secs));
                            setErr(`Rate limit reached. Please wait ${timeStr} before uploading again.`);
                        }
                    } else {
                        setApiKeyErr({ type: "quota" });
                    }
                    setPdfUrl(null); setLoading(false); setIsPdfHidden(false); return;
                }
                if (msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED")) { setApiKeyErr({ type: "quota" }); setPdfUrl(null); setLoading(false); setIsPdfHidden(false); return; }
                if (msg.includes("UNAUTHENTICATED") || msg.includes("Invalid API key")) { setApiKeyErr({ type: "invalid" }); setPdfUrl(null); setLoading(false); setIsPdfHidden(false); return; }
                if (res.status === 503 || msg.includes("overloaded") || msg.includes("UNAVAILABLE")) {
                    throw new Error("AI service temporarily unavailable — please try again.");
                }
                throw new Error(msg);
            }
            const d: MedicalSummary = await res.json();
            setData(d);
            setIsPdfHidden(true);
            const c = buildContext(d, file.name); setCtx(c);
            const entry: HistoryEntry = { id: Date.now().toString(), date: new Date().toISOString(), fileName: file.name, summary: d.summary, results: d.results };
            setCurrentEntryId(entry.id);
            const updated = [entry, ...history].slice(0, 25);
            setHistory(updated); saveHistory(updated);
        } catch (e: any) {
            if (e.name === "AbortError") { setErr("Request timed out — the AI took too long. Try again."); }
            else if (e.message?.includes("fetch") || e.message?.includes("Load failed") || e.message?.includes("NetworkError")) {
                setApiKeyErr({ type: "network" });
            }
            else { setErr(e.message || "Failed to reach backend."); }
            setPdfUrl(null);
            setIsPdfHidden(false);
        }
        finally { setLoading(false); }
    }, [history, customApiKey, selectedModel]);

    const pick = (file?: File) => { if (file) { setFileName(file.name); setLastFile(file); doUpload(file); } };
    const onFileChange = (e: ChangeEvent<HTMLInputElement>) => pick(e.target.files?.[0]);
    const onDragOver = (e: DragEvent<HTMLElement>) => { e.preventDefault(); setDragging(true); };
    const onDragLeave = (e: DragEvent<HTMLElement>) => { e.preventDefault(); setDragging(false); };
    const onDrop = (e: DragEvent<HTMLElement>) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0]); };

    const clear = () => {
        setData(null); setFileName(""); setPdfUrl(null); setErr(null); setIsPdfHidden(false);
        setVisible(new Set()); setChat([]); setCtx(""); setLastFile(null);
        if (fileRef.current) fileRef.current.value = "";
    };

    const sendChat = async () => {
        const msg = chatIn.trim(); if (!msg || chatLoading) return;
        const next: ChatMsg[] = [...chat, { role: "user", content: msg }];
        setChat(next); setChatIn(""); setChatLoading(true);
        if (currentEntryId) {
            setHistory(prev => { const u = prev.map(h => h.id === currentEntryId ? { ...h, chat: next } : h); saveHistory(u); return u; });
        }
        try {
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (customApiKey) headers["Authorization"] = `Bearer ${customApiKey}`;
            const res = await fetch(`${API_BASE_URL}/chat/`, {
                method: "POST", headers,
                body: JSON.stringify({ report_context: ctx, messages: chat.map(m => ({ role: m.role, content: m.content })), new_message: msg, model: selectedModel }),
            });
            if (!res.ok) {
                if (res.status === 401) { setApiKeyErr({ type: "invalid" }); throw new Error("401"); }
                if (res.status === 429) { 
                    const body = await res.json().catch(() => ({}));
                    const detail = body.detail || "";
                    const match = detail.match(/wait ([\dhms.]+)/);
                    if (match) {
                        const timeStr = match[1];
                        if (timeStr.includes('h') || timeStr.includes('m')) {
                            setApiKeyErr({ type: "quota" }); 
                            throw new Error(`Daily limit reached. Resets in ${timeStr}. Add your own API key to bypass.`);
                        } else {
                            const secs = parseFloat(timeStr) || parseInt(timeStr);
                            setCooldown(Math.ceil(secs));
                            throw new Error(`Rate limit reached. Please wait ${timeStr} before asking another question.`);
                        }
                    }
                    setApiKeyErr({ type: "quota" }); 
                    throw new Error("429"); 
                }
                throw new Error("Server error");
            }
            const d = await res.json();
            const nextWithRes: ChatMsg[] = [...next, { role: "assistant", content: d.response }];
            setChat(nextWithRes);
            if (currentEntryId) {
                setHistory(prev => { const u = prev.map(h => h.id === currentEntryId ? { ...h, chat: nextWithRes } : h); saveHistory(u); return u; });
            }
        } catch (e: any) { 
            if (e.message !== "401" && e.message !== "429") {
                if (e.message?.includes("fetch") || e.message?.includes("Load failed") || e.message?.includes("NetworkError")) {
                    setApiKeyErr({ type: "network" });
                    setChat(chat);
                } else {
                    setChat([...next, { role: "assistant", content: e.message || "Sorry, couldn't reach the backend." }]);
                }
            } else {
                // Remove the user's message so they can try again once they fix the key
                setChat(chat);
            }
        }
        finally { setChatLoading(false); }
    };
    const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } };

    const deletEntry = (id: string) => { const u = history.filter(h => h.id !== id); setHistory(u); saveHistory(u); };
    const loadEntry = (e: HistoryEntry) => {
        setData({ summary: e.summary, results: e.results });
        setIsPdfHidden(true); setCurrentEntryId(e.id);
        setFileName(e.fileName); setCtx(buildContext({ summary: e.summary, results: e.results }, e.fileName));
        setChat(e.chat || []); setPdfUrl(null); setShowHist(false);
    };

    const trendNames = [...new Set(history.flatMap(e => e.results.map(r => r.test_name)))];

    // Card style helper — always visible, CSS keyframe handles slide-in
    const card = (i: number, extra?: object): React.CSSProperties => ({
        padding: "26px 28px", marginBottom: 20,
        animation: data ? `lm-fadein 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${Math.min(i * 0.08, 0.6)}s both` : "none",
        ...extra,
    });

    // Button style
    const btn = (active = true): React.CSSProperties => ({
        display: "inline-flex", alignItems: "center", gap: 6, lineHeight: 1,
        background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 99, padding: "7px 15px", color: "#fff", fontSize: 13,
        fontWeight: 500, cursor: active ? "pointer" : "not-allowed", fontFamily: "inherit",
        transition: "all 0.2s",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
    });

    return (
        <main className="mob-main" style={{ minHeight: "100vh", width: "100%", display: "flex", alignItems: "flex-start", padding: 40, paddingTop: 110, gap: 60, boxSizing: "border-box", position: "relative" }}>
            <div className="aurora-bg" />

            {/* ── API KEY ERROR MODAL ───────────────────── */}
            <AnimatePresence>
            {apiKeyErr.type && (
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setApiKeyErr({ type: null })}>
                    <motion.div 
                        initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }} transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
                        className="glass-panel" style={{ borderRadius: 24, padding: 36, maxWidth: 460, width: "90%", position: "relative" }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => setApiKeyErr({ type: null })} style={{ position: "absolute", top: 14, right: 14, background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>✕</button>
                        <div style={{ fontSize: 36, marginBottom: 14 }}>
                            {apiKeyErr.type === "quota" ? "⚠️" : apiKeyErr.type === "network" ? "🔌" : apiKeyErr.type === "settings" ? "⚙️" : "🔑"}
                        </div>
                        <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 700, margin: "0 0 10px" }}>
                            {apiKeyErr.type === "quota" ? "Rate Limit Reached" : apiKeyErr.type === "network" ? "Backend Offline" : apiKeyErr.type === "settings" ? "Settings" : "Invalid API Key"}
                        </h2>
                        {apiKeyErr.type !== "settings" && (
                            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, lineHeight: 1.7, margin: "0 0 20px" }}>
                                {apiKeyErr.type === "quota"
                                    ? "You've hit the Groq free tier rate limit. This is a temporary API limit — not a site issue. Wait a moment and try again, or get a fresh key from Groq console."
                                    : apiKeyErr.type === "network"
                                    ? "Lumina cannot connect to the backend server. Please make sure the Python backend is running (python main.py) and accessible on port 8000."
                                    : "Your Groq API key is missing or invalid. Add a valid GROQ_API_KEY to your .env file or enter a custom one below."}
                            </p>
                        )}
                        
                        {apiKeyErr.type !== "network" && (
                            <div style={{ marginBottom: 20 }}>
                                {apiKeyErr.type === "settings" && (
                                    <h3 style={{ color: "rgba(255,255,255,0.9)", fontSize: 16, fontWeight: 600, margin: "24px 0 16px", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 8 }}>API Settings</h3>
                                )}
                                <label style={{ display: "block", color: "rgba(255,255,255,0.7)", fontSize: 13, marginBottom: 8, fontWeight: 500 }}>AI Model</label>
                                <select 
                                    value={selectedModel}
                                    onChange={e => {
                                        setSelectedModel(e.target.value);
                                        localStorage.setItem("lumina_model", e.target.value);
                                    }}
                                    style={{ width: "100%", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 14, outline: "none", fontFamily: "inherit", marginBottom: 16, cursor: "pointer" }}
                                >
                                    <option value="llama-3.1-8b-instant" style={{ background: "#222" }}>Llama 3.1 8B Instant (Fast, high limits)</option>
                                    <option value="llama-3.3-70b-versatile" style={{ background: "#222" }}>Llama 3.3 70B Versatile (Smart, strict limits)</option>
                                    <option value="llama3-8b-8192" style={{ background: "#222" }}>Llama 3 8B (Fallback)</option>
                                    <option value="llama3-70b-8192" style={{ background: "#222" }}>Llama 3 70B (Fallback)</option>
                                </select>

                                <label style={{ display: "block", color: "rgba(255,255,255,0.7)", fontSize: 13, marginBottom: 8, fontWeight: 500 }}>Custom Groq API Key (Optional)</label>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <input 
                                        type="password" 
                                        placeholder="gsk_..." 
                                        value={customApiKey}
                                        onChange={e => setCustomApiKey(e.target.value)}
                                        style={{ flex: 1, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 14, outline: "none", fontFamily: "inherit" }} 
                                    />
                                    <button 
                                        onClick={() => {
                                            if (customApiKey) localStorage.setItem("lumina_custom_api_key", customApiKey.trim());
                                            else localStorage.removeItem("lumina_custom_api_key");
                                            
                                            const wasSettings = apiKeyErr.type === "settings";
                                            setApiKeyErr({ type: null });
                                            
                                            if (!wasSettings && lastFile) doUpload(lastFile);
                                        }}
                                        style={{ background: "#3b82f6", border: "none", color: "#fff", padding: "0 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                                        {apiKeyErr.type === "settings" ? "Save" : "Save & Retry"}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", padding: "10px 20px", borderRadius: 12, fontSize: 13, fontWeight: 600, textDecoration: "none", fontFamily: "inherit" }}>Get Groq API Key →</a>
                            <button onClick={() => setApiKeyErr({ type: null })} style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "rgba(255,255,255,0.7)", padding: "10px 20px", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Dismiss</button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
            </AnimatePresence>

            {/* ── LOGO TOP LEFT ─────────────────────────── */}
            <motion.div 
                className="mob-logo"
                style={{ position: "absolute", top: 18, left: 40, zIndex: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                    setData(null);
                    setErr(null);
                    setLoading(false);
                    setPdfUrl(null);
                    setFileName("");
                    setChat([]);
                    setCtx("");
                    setIsPdfHidden(false);
                    setShowHist(false);
                }}
            >
                <img
                    src="/logo.png"
                    alt="Lumina"
                    style={{ height: 64, width: "auto", objectFit: "contain", mixBlendMode: "screen", display: "block" }}
                />

            </motion.div>

            {/* ── GLOBAL TOP RIGHT CONTROLS ───────────────── */}
            <div className="mob-history-btn" style={{ position: "absolute", top: 36, right: 40, zIndex: 10, display: "flex", gap: 8 }}>
                <button className="lumi-btn" onClick={() => setShowAbout(true)}><Icons.info /> About</button>
                <button className="lumi-btn" onClick={() => setApiKeyErr({ type: "settings" })}><Icons.settings /> Settings</button>
                <button className="lumi-btn" onClick={() => setShowHist(true)}><Icons.history /> History</button>
            </div>

            {/* ── MOBILE ONLY HERO TEXT ─────────────────── */}
            {!data && !loading && !err && (
                <div className="mob-only-hero">
                    <h1 style={{ textAlign: "center", color: "#fff", margin: 0, fontWeight: 400, letterSpacing: "-1.5px", animation: "lm-fadein 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}>
                        Medical Reports,<br />
                        <span className="text-gradient" style={{ display: "inline-block", marginTop: 4 }}>decoded.</span>
                    </h1>
                </div>
            )}

            {/* ── LEFT PANEL ────────────────────────────── */}
            <section
                className={`mob-left-panel glass-panel ${isPdfHidden ? "mob-hide-pdf" : ""}`}
                style={{ 
                    width: isPdfHidden ? 0 : 432, 
                    minHeight: isPdfHidden ? 0 : 680,
                    marginRight: isPdfHidden ? -60 : 0,
                    flexShrink: 0, 
                    marginTop: 10, 
                    border: isPdfHidden ? "none" : undefined, 
                    display: "flex", 
                    flexDirection: "column", 
                    alignItems: "center", 
                    justifyContent: pdfUrl ? "flex-start" : "center", 
                    overflow: "hidden", 
                    position: "relative", 
                    transition: "all 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
                    animation: "lm-fadein 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                    opacity: isPdfHidden ? 0 : 1,
                    visibility: isPdfHidden ? "hidden" : "visible"
                }}
                onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
            >
                    {!isPdfHidden && (
                        <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 1, borderRadius: 40 }}>
                            <rect x="1.5" y="1.5" width="calc(100% - 3px)" height="calc(100% - 3px)" fill="none" rx="38.5" ry="38.5" stroke={dragging ? "#fff" : "rgba(255,255,255,0.25)"} strokeWidth="1.5" strokeDasharray="12 12" style={{ animation: "dash-move 1s linear infinite" }} />
                        </svg>
                    )}
                    {pdfUrl ? (
                        <>
                            <iframe src={pdfUrl} title="PDF Preview" style={{ width: "100%", height: "100%", minHeight: 900, border: "none" }} />
                            <button onClick={clear} title="Upload a different file" style={{ position: "absolute", top: 14, right: 14, background: "rgba(0,0,0,0.65)", border: "none", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff", backdropFilter: "blur(6px)" }}>
                                <Icons.x />
                            </button>
                        </>
                    ) : (
                        <>
                            <label style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", borderRadius: 16, padding: "17px 26px", cursor: (loading || cooldown > 0) ? "not-allowed" : "pointer", opacity: (loading || cooldown > 0) ? 0.75 : 1, boxShadow: "0 0 30px rgba(255,255,255,0.22)", color: "#000", fontWeight: 600, fontSize: 13, fontFamily: "inherit" }}>
                                <input ref={fileRef} type="file" accept="application/pdf,.pdf" style={{ display: "none" }} onChange={onFileChange} disabled={loading || cooldown > 0} />
                                <Icons.upload />
                                {loading ? "Analyzing…" : (cooldown > 0 ? `Rate limit cooldown: ${cooldown}s` : "Drag & Drop Medical Report")}
                            </label>
                            <p style={{ marginTop: 14, color: "rgba(255,255,255,0.28)", fontSize: 12 }}>PDF only · max 20 MB</p>
                            {fileName && !loading && <p style={{ marginTop: 8, color: "rgba(255,255,255,0.45)", fontSize: 12, maxWidth: 280, textAlign: "center" }}>{fileName}</p>}
                        </>
                    )}
                </section>

            {/* ── RIGHT PANEL ───────────────────────────── */}
            <section id="report-content" style={{ flex: 1, maxWidth: isPdfHidden ? 1000 : "none", margin: isPdfHidden ? "0 auto" : 0, display: "flex", flexDirection: "column", minWidth: 0, paddingTop: 10, transition: "max-width 0.3s cubic-bezier(0.16, 1, 0.3, 1)" }}>

                {!data && !loading && !err ? (
                    <div className="mob-empty-wrap" style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start", paddingLeft: 90, position: "relative" }}>
                        
                        <div className="mob-hero-wrapper" style={{ display: "flex", flexDirection: "column", gap: 50, width: "100%", maxWidth: 550, marginTop: 15 }}>
                            <h1 className="mob-hero-h1 hero-title desktop-only-hero" style={{ textAlign: "left", animation: "lm-fadein 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}>
                                Medical Reports,<br />
                                <span className="mob-hero-span text-gradient" style={{ fontSize: "1.2em", display: "inline-block", marginTop: "4px" }}>decoded.</span>
                            </h1>
                            
                            <div className="mob-features-container" style={{ display: "flex", justifyContent: "center", width: "100%" }}>
                                <div className="mob-features" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, animation: "lm-fadein 1s cubic-bezier(0.16, 1, 0.3, 1) forwards", animationDelay: "0.1s", opacity: 0, width: "100%" }}>
                                {[
                                    { icon: <Icons.fileText />, title: "Instant Analysis", desc: "Understand complex medical jargon translated into plain English." },
                                    { icon: <Icons.barChart />, title: "Visual Tracking", desc: "Easily spot out-of-range biomarkers with clear range bars." },
                                    { icon: <Icons.upload />, title: "Universal Format", desc: "Upload any standard PDF medical or blood test report securely." },
                                    { icon: <Icons.messageCircle />, title: "Ask Questions", desc: "Chat directly with Lumi AI to clarify any specific health queries." }
                                ].map((f, i) => (
                                    <div key={i} className="feature-card" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 20, padding: 20 }}>
                                        <div style={{ color: "#fff", display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 600, letterSpacing: "-0.2px", marginBottom: 8 }}>
                                            {f.icon} {f.title}
                                        </div>
                                        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, lineHeight: 1.5, margin: 0, fontWeight: 300 }}>
                                            {f.desc}
                                        </p>
                                    </div>
                                ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                <div className="mob-analysis-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
                    <div>
                        <h1 style={{ color: "#fff", fontSize: 46, fontWeight: 700, margin: "0 0 6px", lineHeight: 1.1 }}>Analysis</h1>
                        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, margin: 0 }}>Upload a PDF to generate insights</p>
                    </div>
                    <div className="no-print" style={{ display: "flex", gap: 8, paddingTop: 8 }}>
                        {(data || loading) && (
                            <button className="lumi-btn" onClick={() => setIsPdfHidden(!isPdfHidden)}>
                                <Icons.panel /> {isPdfHidden ? "Show PDF" : "Hide PDF"}
                            </button>
                        )}
                        {data && (
                            <button className="lumi-btn" style={{ opacity: isExporting ? 0.7 : 1 }} onClick={exportPdf} disabled={isExporting}>
                                <Icons.export /> {isExporting ? "Exporting..." : "Export Summary"}
                            </button>
                        )}
                    </div>
                </div>
                {/* Unified Ask Lumi section */}
                {data && (
                    <LiquidMetalCard
                         radius={28}
                         glassEffect={chat.length === 0 || isChatMinimized}
                         className={`no-print ai-container ${chat.length === 1 && chatLoading ? "gemini-pulse" : ""}`} 
                         style={{ 
                             margin: "0 auto", 
                             marginBottom: isChatFullScreen ? 0 : 40, 
                             transition: "all 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
                             width: "100%",
                             backgroundColor: '#0a0a0a',
                             ...(isChatFullScreen ? {
                                 position: "fixed",
                                 inset: 20,
                                 zIndex: 9999,
                                 width: "calc(100% - 40px)",
                                 height: "calc(100% - 40px)",
                                 boxShadow: "0 0 100px rgba(0,0,0,0.8)"
                             } : {})
                         }}>
                        <div 
                             onClick={(e) => {
                                 const rect = e.currentTarget.getBoundingClientRect();
                                 const ripple = { x: e.clientX - rect.left, y: e.clientY - rect.top, id: rippleId.current++ };
                                 setRipples(prev => [...prev, ripple]);
                                 setTimeout(() => setRipples(prev => prev.filter(r => r.id !== ripple.id)), 600);
                             }}
                             style={{
                             position: "relative",
                             overflow: "hidden",
                             width: "100%",
                             height: "100%",
                             display: "flex",
                             flexDirection: "column",
                             gap: (chat.length > 0 && !isChatMinimized) ? 14 : 0,
                         }}>
                            {ripples.map(r => (
                                <span key={r.id} style={{
                                    position: "absolute",
                                    left: r.x,
                                    top: r.y,
                                    width: 40,
                                    height: 40,
                                    borderRadius: "50%",
                                    background: "radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 70%)",
                                    pointerEvents: "none",
                                    zIndex: 9999,
                                    animation: "custom-ripple-anim 0.6s ease-out forwards"
                                }} />
                            ))}
                        <div ref={chatScrollRef} className="ai-chat-scroll" style={{ 
                            maxHeight: (chat.length === 0 || isChatMinimized) ? 0 : (isChatFullScreen ? "calc(100vh - 120px)" : "70vh"), 
                            flex: isChatFullScreen ? 1 : "none", 
                            opacity: (chat.length === 0 || isChatMinimized) ? 0 : 1,
                            transform: (chat.length === 0 || isChatMinimized) ? "translateY(10px)" : "translateY(0)",
                            overflowY: "auto", 
                            display: "flex", 
                            flexDirection: "column", 
                            gap: 14, 
                            paddingBottom: (chat.length === 0 || isChatMinimized) ? 0 : 14, 
                            borderBottom: (chat.length === 0 || isChatMinimized) ? "1px solid transparent" : "1px solid rgba(255,255,255,0.06)",
                            transition: "max-height 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease, transform 0.4s ease, padding-bottom 0.5s ease" 
                        }}>
                            {chat.map((m, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", flexShrink: 0, animation: "lm-slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}>
                                    {m.role === "user" ? (
                                        <>
                                            <div className="chat-bubble-user">
                                                <ReactMarkdown 
                                                    components={{
                                                        p: ({node, ...props}) => <p style={{ margin: "0 0 8px" }} {...props} />,
                                                        ul: ({node, ...props}) => <ul style={{ margin: "0 0 8px", paddingLeft: 20 }} {...props} />,
                                                        ol: ({node, ...props}) => <ol style={{ margin: "0 0 8px", paddingLeft: 20 }} {...props} />,
                                                        li: ({node, ...props}) => <li style={{ marginBottom: 4 }} {...props} />,
                                                        strong: ({node, ...props}) => <strong style={{ fontWeight: 600 }} {...props} />,
                                                        em: ({node, ...props}) => <em style={{ fontStyle: "italic", fontWeight: 600 }} {...props} />
                                                    }}
                                                >
                                                    {m.content}
                                                </ReactMarkdown>
                                            </div>
                                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 10, flexShrink: 0, alignSelf: 'flex-end', marginBottom: 4, color: 'rgba(255,255,255,0.7)' }}>
                                                <Icons.user />
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10, flexShrink: 0, overflow: 'hidden', alignSelf: 'flex-end', marginBottom: 4 }}>
                                                <img src="/lumiaiicon.png" alt="Lumi" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            </div>
                                            <div className="chat-bubble-ai">
                                                <ReactMarkdown 
                                                    components={{
                                                        p: ({node, ...props}) => <p style={{ margin: "0 0 8px" }} {...props} />,
                                                        ul: ({node, ...props}) => <ul style={{ margin: "0 0 8px", paddingLeft: 20 }} {...props} />,
                                                        ol: ({node, ...props}) => <ol style={{ margin: "0 0 8px", paddingLeft: 20 }} {...props} />,
                                                        li: ({node, ...props}) => <li style={{ marginBottom: 4 }} {...props} />,
                                                        strong: ({node, ...props}) => <strong style={{ fontWeight: 600 }} {...props} />,
                                                        em: ({node, ...props}) => <em style={{ fontStyle: "italic", fontWeight: 600 }} {...props} />
                                                    }}
                                                >
                                                    {m.content}
                                                </ReactMarkdown>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                            {(chatLoading && !isChatMinimized) && (
                                <div style={{ display: "flex", gap: 4, padding: "11px 14px", background: "rgba(255,255,255,0.07)", borderRadius: "16px 16px 16px 4px", width: "fit-content", animation: "lm-slide-up 0.3s forwards" }}>
                                    {[0, 1, 2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.4)", animation: `lm-bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
                                </div>
                            )}
                        </div>
                        <div style={{ display: "flex", width: "100%", gap: 5, alignItems: "center" }}>
                          <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }} onClick={() => setIsChatMinimized(false)}>
                            {(!chatIn || isChatMinimized || cooldown > 0) && (
                              <span className="btn-shine" style={{ left: 16 }}>
                                {cooldown > 0 ? `Rate limit cooldown: ${cooldown}s...` : ((isChatMinimized && chat.length > 0) ? "Click to continue conversation..." : "Ask Lumi about your report...")}
                              </span>
                            )}
                            <input 
                              type="text" 
                              name="text" 
                              className="input__search" 
                              value={chatIn} 
                              onChange={e => setChatIn(e.target.value)} 
                              onKeyDown={onKey}
                              disabled={chatLoading || cooldown > 0}
                              style={{ 
                                  padding: "10px 16px", 
                                  flex: 1,
                                  opacity: (isChatMinimized || cooldown > 0) ? 0 : 1,
                                  pointerEvents: (isChatMinimized || cooldown > 0) ? "none" : "auto"
                              }}
                            />
                          </div>
                          <button className="input__button__shadow" onClick={sendChat} disabled={chatLoading || cooldown > 0 || !chatIn.trim()} style={{ opacity: chatLoading || cooldown > 0 || !chatIn.trim() ? 0.5 : 1, position: "relative", zIndex: 1, padding: "8px", marginLeft: 4, transition: "opacity 0.3s" }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="12" y1="19" x2="12" y2="5"></line>
                              <polyline points="5 12 12 5 19 12"></polyline>
                            </svg>
                          </button>
                          {chat.length > 0 && (
                              <div style={{ display: "flex", gap: 4, alignItems: "center", marginLeft: 4 }}>
                                  <button onClick={() => setIsChatFullScreen(!isChatFullScreen)} title={isChatFullScreen ? "Exit Fullscreen" : "Fullscreen"} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", padding: "8px", display: "flex", alignItems: "center", justifyContent: "center", transition: "color 0.3s, transform 0.3s", transform: isChatFullScreen ? "scale(0.9)" : "none" }}>
                                      {isChatFullScreen ? <Icons.shrink /> : <Icons.expand />}
                                  </button>
                              </div>
                          )}
                        </div>
                        </div>
                    </LiquidMetalCard>
                )}
                {/* ── Summary & Lab Results ───────────────── */}
                {err && (
                    <div className="glass-card no-print" style={{ ...card(0), padding: "20px", marginBottom: 20, border: "1px solid rgba(248, 113, 113, 0.4)", background: "rgba(248, 113, 113, 0.05)" }}>
                        <p style={{ color: err.includes("quota") ? "#fbbf24" : "#f87171", fontSize: 14, margin: "0 0 14px", lineHeight: 1.6 }}>{err}</p>
                        {err.includes("quota") ? (
                            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ display: "inline-block", background: "#ca8a04", border: "none", borderRadius: 10, padding: "8px 18px", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textDecoration: "none" }}>Get new API key →</a>
                        ) : lastFile && (
                            <button onClick={() => doUpload(lastFile)} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "8px 18px", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>↺ Retry</button>
                        )}
                    </div>
                )}

                {/* Summary card */}
                <div className="glass-card" style={card(0)}>
                    <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 600, margin: "0 0 14px" }}>Summary</h2>
                    {loading ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                            <Skel w="92%" h={13} /><Skel w="78%" h={13} /><Skel w="58%" h={13} />
                        </div>
                    ) : data ? (
                        <p style={{ color: "#fff", fontSize: 16, lineHeight: 1.7, margin: 0 }}>{data.summary}</p>
                    ) : (
                        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 15, margin: 0 }}>Upload a medical report to see the AI analysis here.</p>
                    )}
                </div>


                {/* Skeleton lab cards */}
                {loading && [0, 1].map(i => (
                    <div key={i} className="glass-card" style={{ padding: "26px 28px", marginBottom: 20 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
                            <Skel w={140} h={18} /><Skel w={80} h={28} />
                        </div>
                        <Skel w={160} h={32} />
                        <div style={{ marginTop: 10 }}><Skel w={220} h={13} /></div>
                        <div style={{ marginTop: 16 }}><Skel w="100%" h={6} /></div>
                    </div>
                ))}

                {/* Live lab cards */}
                {data && data.results.map((r, i) => (
                    <AnimatedCard key={i} style={card(i + 1)} className="glass-card no-print">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            {(() => {
                                let sn = r.test_name, fn = "";
                                if (sn.includes(" (")) { const p = sn.split(" ("); sn = p[0]; fn = p[1].replace(")", ""); }
                                return (
                                    <h2 id={`res-${i}`} style={{ color: "#fff", fontSize: 20, fontWeight: 600, margin: 0, textShadow: "0 0 18px rgba(255,255,255,0.2)", display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                                        {sn}
                                        {fn && <span style={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.45)", textShadow: "none" }}>({fn})</span>}
                                    </h2>
                                )
                            })()}
                            <Badge s={r.status_badge} />
                        </div>
                        <p style={{ color: "#fff", fontSize: 32, fontWeight: 700, margin: "14px 0 4px" }}>{r.value}</p>
                        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, margin: 0 }}>{r.normal_range}</p>
                        <RangeBar value={r.value} normal_range={r.normal_range} status={r.status_badge} />
                    </AnimatedCard>
                ))}
                </>
            )}
            </section>


            {/* ── HISTORY MODAL ─────────────────────────── */}
            <AnimatePresence>
                {showHist && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(12px)" }} onClick={() => setShowHist(false)}>
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }} transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
                            className="glass-panel" style={{ borderRadius: 24, maxWidth: 560, width: "90%", maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden" }} onClick={e => e.stopPropagation()}>

                        {/* Modal header */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "22px 26px 0" }}>
                            <h2 style={{ color: "#fff", fontSize: 18, fontWeight: 600, margin: 0 }}>Report History</h2>

                            <button onClick={() => setShowHist(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", display: "flex" }}><Icons.x /></button>
                        </div>

                        {/* Tabs & Actions */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 26px 0" }}>
                            <div style={{ display: "flex", gap: 6 }}>
                                {(["history", "trends"] as const).map(t => (
                                    <button key={t} onClick={() => setHistTab(t)} style={{ background: histTab === t ? "rgba(59,130,246,0.18)" : "transparent", border: `1px solid ${histTab === t ? "rgba(59,130,246,0.45)" : "transparent"}`, borderRadius: 9, padding: "5px 14px", color: histTab === t ? "#60a5fa" : "rgba(255,255,255,0.35)", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>
                                        {t}
                                    </button>
                                ))}
                            </div>
                            {histTab === "history" && history.length > 0 && (
                                <button
                                    onClick={() => {
                                        if (confirm("Are you sure you want to clear all history? This cannot be undone.")) {
                                            setHistory([]);
                                            localStorage.removeItem("lumina_history");
                                            clear();
                                        }
                                    }}
                                    style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 9, padding: "5px 12px", color: "#ef4444", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                                >
                                    Clear All
                                </button>
                            )}
                        </div>

                        {/* Content */}
                        <div style={{ overflowY: "auto", padding: "14px 26px 26px", flex: 1 }}>
                            {histTab === "history" ? (
                                history.length === 0
                                    ? <p style={{ color: "rgba(255,255,255,0.25)", textAlign: "center", marginTop: 40, fontSize: 14 }}>No reports yet.</p>
                                    : history.map(e => (
                                        <div key={e.id} onClick={() => loadEntry(e)} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 13, padding: "14px 16px", marginBottom: 8, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div style={{ minWidth: 0 }}>
                                                <p style={{ color: "#fff", fontSize: 13, fontWeight: 500, margin: "0 0 3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.fileName}</p>
                                                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, margin: 0 }}>{new Date(e.date).toLocaleString()} · {e.results.length} tests</p>
                                            </div>
                                            <button onClick={ev => { ev.stopPropagation(); deletEntry(e.id); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.22)", cursor: "pointer", padding: "4px 6px", display: "flex", marginLeft: 10, flexShrink: 0 }}><Icons.trash /></button>
                                        </div>
                                    ))
                            ) : (
                                trendNames.length === 0
                                    ? <p style={{ color: "rgba(255,255,255,0.25)", textAlign: "center", marginTop: 40, fontSize: 14 }}>Analyze 2+ reports to see trends.</p>
                                    : trendNames.map(n => <TrendChart key={n} name={n} entries={[...history].reverse()} />)
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
            </AnimatePresence>

            
            {/* ── ABOUT MODAL ─────────────────────────────── */}
            <AnimatePresence>
                {showAbout && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(12px)" }} onClick={() => setShowAbout(false)}>
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }} transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
                            className="glass-panel" style={{ borderRadius: 24, padding: "36px", maxWidth: 460, width: "90%", position: "relative", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
                            
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 16 }}>
                                <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 600, margin: 0, display: "flex", alignItems: "center", gap: 8 }}><Icons.info /> About Lumina</h2>
                                <button onClick={() => setShowAbout(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", display: "flex" }}><Icons.x /></button>
                            </div>
                            
                            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, lineHeight: 1.7 }}>
                                <p style={{ marginBottom: 16 }}>
                                    <strong style={{ color: "#fff" }}>Lumina</strong> is an intelligent medical report analyzer designed to make complex health data accessible and easy to understand.
                                </p>
                                <p style={{ marginBottom: 16 }}>
                                    It utilizes state-of-the-art vision and language models to securely process standard PDF medical or blood test reports, instantly translating medical jargon into plain English.
                                </p>
                                <div style={{ marginBottom: 24, padding: "16px", background: "rgba(255,255,255,0.05)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)" }}>
                                    <p style={{ margin: "0 0 4px", color: "rgba(255,255,255,0.5)", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Version</p>
                                    <p style={{ margin: "0 0 16px", color: "#fff", fontWeight: 600, fontSize: 15 }}>2.0</p>

                                    <p style={{ margin: "0 0 4px", color: "rgba(255,255,255,0.5)", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Creator</p>
                                    <p style={{ margin: "0 0 8px", color: "#fff", fontWeight: 500 }}>Designed and Built by Suryansh Pareek</p>
                                    <div style={{ display: "flex", gap: 16 }}>
                                        <a href="https://www.linkedin.com/in/srnshprk" target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                                            LinkedIn
                                        </a>
                                        <a href="https://github.com/nerdsuryansh" target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                                            GitHub
                                        </a>
                                    </div>
                                </div>
                                <div style={{ background: "rgba(255,160,0,0.1)", border: "1px solid rgba(255,160,0,0.2)", borderRadius: 10, padding: "12px 14px", marginTop: 20 }}>
                                    <p style={{ margin: 0, color: "#ffb74d", fontSize: 12, display: "flex", gap: 8, alignItems: "flex-start", lineHeight: 1.5 }}>
                                        <span style={{ fontSize: 13, marginTop: 1 }}>⚠️</span>
                                        <span><strong>Disclaimer:</strong> Lumina is an AI tool and not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or qualified health provider with any medical questions.</span>
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
                @keyframes lm-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
                @keyframes lm-bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }
                @keyframes lm-fadein { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
                @keyframes lm-fadeout { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(20px) scale(0.95); } }
                @keyframes lm-slide-up { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
                ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:999px}
                
                .mob-only-hero { display: none; }
                
                @media (max-width: 768px) {
                    .mob-main { min-width: 0 !important; flex-direction: column !important; align-items: stretch !important; padding: 70px 16px 80px !important; gap: 20px !important; height: auto !important; min-height: 100vh !important; }
                    #report-content { width: 100% !important; }
                    .mob-logo { top: 16px !important; left: 0 !important; right: 0 !important; display: flex !important; justify-content: center !important; }
                    .mob-logo img { height: 36px !important; }
                    
                    .mob-only-hero { display: block !important; width: 100%; padding-top: 10px; margin-bottom: 10px; }
                    .mob-only-hero h1 { font-size: 46px !important; line-height: 1.05 !important; }
                    .mob-only-hero span { font-size: 3.5rem !important; }
                    .desktop-only-hero { display: none !important; }

                    .mob-left-panel { width: 100% !important; min-height: 300px !important; margin-right: 0 !important; border: 1px solid rgba(255,255,255,0.05) !important; }
                    .mob-empty-wrap { padding-left: 0 !important; width: 100% !important; align-items: stretch !important; }
                    .mob-hero-wrapper { gap: 0 !important; align-items: stretch !important; max-width: 100% !important; margin: 0 auto !important; }
                    .mob-history-btn { position: relative !important; margin-bottom: 5px !important; align-self: stretch !important; top: auto !important; right: auto !important; flex-wrap: wrap !important; justify-content: center !important; margin-top: 10px !important; }
                    
                    .mob-analysis-header { flex-direction: column !important; gap: 16px !important; text-align: center !important; align-items: center !important; }
                    .mob-analysis-header .no-print { justify-content: center !important; width: 100% !important; flex-wrap: wrap !important; }
                    
                    .mob-features { grid-template-columns: 1fr !important; gap: 16px !important; width: 100% !important; max-width: 100% !important; margin: 24px auto 0 !important; align-self: stretch !important; }
                    .feature-card { padding: 22px !important; text-align: left !important; align-items: flex-start !important; }
                    .feature-card div { justify-content: flex-start !important; font-size: 14px !important; }
                    .feature-card p { font-size: 13px !important; opacity: 0.8; }
                    
                    .mob-chat { 
                        position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; 
                        width: 100vw !important; height: 100vh !important; border-radius: 0 !important; margin: 0 !important; border: none !important; z-index: 1000 !important;
                    }
                    .mob-chat-btn { bottom: 16px !important; right: 16px !important; }
                    .mob-chat-tooltip { display: none !important; }
                    .mob-hide-pdf { display: none !important; }
                }

                @media print {
                    .no-print { display:none!important; }
                    main { padding:20px; min-width:auto; gap:30px; }
                    section:first-child { display:none; }
                }
            `}</style>
        </main>
    );
};
