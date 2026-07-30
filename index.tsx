import {
    ChangeEvent, DragEvent, KeyboardEvent,
    useRef, useState, useEffect, useCallback
} from "react";
import ReactMarkdown from "react-markdown";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

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
    return (s.replace(/,/g, '').match(/\d+\.?\d*/g) || []).map(Number);
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

// ─── Icons ───────────────────────────────────────────────────────────────────

const IC = (d: string, extra?: object) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...extra}>
        <path d={d} />
    </svg>
);

const Icons = {
    upload: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>,
    x: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
    send: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>,
    history: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="12 8 12 12 14 14" /><path d="M3.05 11a9 9 0 1 0 .5-4" /><polyline points="3 3 3 7 7 7" /></svg>,
    export: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>,
    trash: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>,
    warn: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /></svg>,
    check: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
    sparkles: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /><path d="M20 3v4" /><path d="M22 5h-4" /><path d="M4 17v2" /><path d="M5 18H3" /></svg>,
    expand: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>,
    shrink: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" /></svg>,
    panel: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="9" y1="3" x2="9" y2="21" /></svg>,
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
    if (percent < 6) percent = 6;
    if (percent > 94) percent = 94;

    const isLow = status === "Low";
    const isHigh = status === "High";

    // Flat, minimal accent colors
    const pillColor = (isLow || isHigh) ? "#ef4444" : "#22c55e";

    const rangeLabel = isUpperOnly ? `< ${rMax}` : `${rMin} – ${rMax}`;

    return (
        <div style={{ marginTop: 22 }}>
            <div style={{ 
                height: 28, 
                background: "rgba(255,255,255,0.03)", 
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 999, 
                position: "relative",
                display: "flex",
                alignItems: "center"
            }}>
                {/* Subtle Normal Range Block */}
                <div style={{ 
                    position: "absolute", 
                    left: `${((rMin - bMin) / bSpan) * 100}%`, 
                    width: `${((rMax - rMin) / bSpan) * 100}%`, 
                    height: "100%", 
                    background: "rgba(255,255,255,0.04)", 
                    borderLeft: "1px solid rgba(255,255,255,0.08)",
                    borderRight: "1px solid rgba(255,255,255,0.08)"
                }} />

                {/* Flat Marker Pill */}
                <div style={{ 
                    position: "absolute", 
                    left: `${percent}%`, 
                    transform: "translateX(-50%)", 
                    padding: "3px 10px",
                    borderRadius: 999, 
                    background: pillColor, 
                    color: "#000",
                    fontSize: 12,
                    fontWeight: 600,
                    zIndex: 2,
                    whiteSpace: "nowrap",
                    transition: "left 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
                }}>
                    {value}
                </div>
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
    const chatEnd = useRef<HTMLDivElement>(null);

    const [fileName, setFileName] = useState("");
    const [dragging, setDragging] = useState(false);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<MedicalSummary | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
    const [showHist, setShowHist] = useState(false);
    const [histTab, setHistTab] = useState<"history" | "trends">("history");
    const [chat, setChat] = useState<ChatMsg[]>([]);
    const [chatIn, setChatIn] = useState("");
    const [chatLoading, setChatLoading] = useState(false);
    const [ctx, setCtx] = useState("");
    const [visible, setVisible] = useState<Set<number>>(new Set());
    const [lastFile, setLastFile] = useState<File | null>(null);
    const [apiKeyErr, setApiKeyErr] = useState<{ type: "quota" | "invalid" | null }>({ type: null });
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [hasSeenChatTooltip, setHasSeenChatTooltip] = useState(() => localStorage.getItem("lumina_chat_tooltip_seen") === "true");
    const [isChatFullScreen, setIsChatFullScreen] = useState(false);
    const [isPdfHidden, setIsPdfHidden] = useState(false);
    const [renderChat, setRenderChat] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);

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
        // nothing — CSS keyframes handle animation
    }, [data]);

    useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

    const doUpload = useCallback(async (file: File) => {
        if (file.size > 20 * 1024 * 1024) { setErr("File too large — max 20 MB."); return; }
        setLoading(true); setErr(null); setData(null); setChat([]); setIsPdfHidden(true);
        setPdfUrl(URL.createObjectURL(file));
        const fd = new FormData(); fd.append("file", file);
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 120000);
            const res = await fetch("http://127.0.0.1:8000/upload/", { method: "POST", body: fd, signal: controller.signal });
            clearTimeout(timeout);
            if (res.status === 429) { setApiKeyErr({ type: "quota" }); setPdfUrl(null); setLoading(false); setIsPdfHidden(false); return; }
            if (res.status === 401) { setApiKeyErr({ type: "invalid" }); setPdfUrl(null); setLoading(false); setIsPdfHidden(false); return; }
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                const msg = body.detail || `Server error ${res.status}`;
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
            else { setErr(e.message || "Failed to reach backend."); }
            setPdfUrl(null);
            setIsPdfHidden(false);
        }
        finally { setLoading(false); }
    }, [history]);

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
            const res = await fetch("http://127.0.0.1:8000/chat/", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ report_context: ctx, messages: chat.map(m => ({ role: m.role, content: m.content })), new_message: msg }),
            });
            if (!res.ok) throw new Error();
            const d = await res.json();
            const nextWithRes: ChatMsg[] = [...next, { role: "assistant", content: d.response }];
            setChat(nextWithRes);
            if (currentEntryId) {
                setHistory(prev => { const u = prev.map(h => h.id === currentEntryId ? { ...h, chat: nextWithRes } : h); saveHistory(u); return u; });
            }
        } catch { setChat([...next, { role: "assistant", content: "Sorry, couldn't reach the backend." }]); }
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
        background: "#1e293b", borderRadius: 22, padding: "26px 28px", marginBottom: 20,
        animation: data ? `lm-fadein 0.4s ease ${Math.min(i * 0.08, 0.6)}s both` : "none",
        ...extra,
    });

    // Button style
    const btn = (active = true): React.CSSProperties => ({
        display: "inline-flex", alignItems: "center", gap: 6,
        background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 11, padding: "7px 15px", color: "rgba(255,255,255,0.65)", fontSize: 13,
        fontWeight: 500, cursor: active ? "pointer" : "not-allowed", fontFamily: "inherit",
        transition: "background 0.2s",
    });

    return (
        <main className="mob-main" style={{ background: "linear-gradient(180deg,#152331 0%,#000 100%)", minHeight: "100vh", minWidth: 1440, display: "flex", alignItems: "flex-start", padding: 40, paddingTop: 110, gap: 60, fontFamily: "'Plus Jakarta Sans',sans-serif", boxSizing: "border-box", position: "relative" }}>

            {/* ── API KEY ERROR MODAL ───────────────────── */}
            {apiKeyErr.type && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setApiKeyErr({ type: null })}>
                    <div style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 24, padding: 36, maxWidth: 460, width: "90%", position: "relative" }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => setApiKeyErr({ type: null })} style={{ position: "absolute", top: 14, right: 14, background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>✕</button>
                        <div style={{ fontSize: 36, marginBottom: 14 }}>{apiKeyErr.type === "quota" ? "⚠️" : "🔑"}</div>
                        <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 700, margin: "0 0 10px" }}>
                            {apiKeyErr.type === "quota" ? "Rate Limit Reached" : "Invalid API Key"}
                        </h2>
                        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, lineHeight: 1.7, margin: "0 0 20px" }}>
                            {apiKeyErr.type === "quota"
                                ? "You've hit the Groq free tier rate limit. This is a temporary API limit — not a site issue. Wait a moment and try again, or get a fresh key from Groq console."
                                : "Your Groq API key is missing or invalid. Add a valid GROQ_API_KEY to your .env file and restart the backend. The site itself is working fine."}
                        </p>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" style={{ background: "#3b82f6", color: "#fff", padding: "10px 20px", borderRadius: 12, fontSize: 13, fontWeight: 600, textDecoration: "none", fontFamily: "inherit" }}>Get Groq API Key →</a>
                            <button onClick={() => setApiKeyErr({ type: null })} style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "rgba(255,255,255,0.7)", padding: "10px 20px", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Dismiss</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── LOGO TOP LEFT ─────────────────────────── */}
            <div 
                className="mob-logo"
                style={{ position: "absolute", top: 18, left: 40, zIndex: 10, cursor: "pointer" }}
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
            </div>

            {/* ── LEFT PANEL ────────────────────────────── */}
            <section
                className={`mob-left-panel ${isPdfHidden ? "mob-hide-pdf" : ""}`}
                style={{ 
                    width: isPdfHidden ? 0 : 432, 
                    minHeight: isPdfHidden ? 0 : 680,
                    marginRight: isPdfHidden ? -60 : 0,
                    flexShrink: 0, 
                    marginTop: 10, 
                    background: "#1e293b", 
                    borderRadius: 40, 
                    border: `${isPdfHidden ? 0 : 1.5}px dashed ${dragging ? "#fff" : "rgba(255,255,255,0.3)"}`, 
                    display: "flex", 
                    flexDirection: "column", 
                    alignItems: "center", 
                    justifyContent: pdfUrl ? "flex-start" : "center", 
                    overflow: "hidden", 
                    position: "relative", 
                    transition: "all 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
                    opacity: isPdfHidden ? 0 : 1,
                    visibility: isPdfHidden ? "hidden" : "visible"
                }}
                onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
            >
                    {pdfUrl ? (
                        <>
                            <iframe src={pdfUrl} title="PDF Preview" style={{ width: "100%", height: "100%", minHeight: 900, border: "none" }} />
                            <button onClick={clear} title="Upload a different file" style={{ position: "absolute", top: 14, right: 14, background: "rgba(0,0,0,0.65)", border: "none", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff", backdropFilter: "blur(6px)" }}>
                                <Icons.x />
                            </button>
                        </>
                    ) : (
                        <>
                            <label style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", borderRadius: 16, padding: "17px 26px", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.75 : 1, boxShadow: "0 0 30px rgba(255,255,255,0.22)", color: "#000", fontWeight: 600, fontSize: 13, fontFamily: "inherit" }}>
                                <input ref={fileRef} type="file" accept="application/pdf,.pdf" style={{ display: "none" }} onChange={onFileChange} disabled={loading} />
                                <Icons.upload />
                                {loading ? "Analyzing…" : "Drag & Drop Medical Report"}
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
                        <div className="mob-history-btn" style={{ position: "absolute", top: 0, right: 0, display: "flex", gap: 8 }}>
                            <button style={btn()} onClick={() => setShowHist(true)}><Icons.history /> History</button>
                        </div>
                        
                        <div style={{ display: "flex", flexDirection: "column", gap: 50, width: "100%", maxWidth: 550, marginTop: 60 }}>
                            <h1 className="mob-hero-h1" style={{ textAlign: "left", fontSize: 72, fontWeight: 800, color: "#fff", lineHeight: 1.15, letterSpacing: "-2px", margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", animation: "lm-fadein 0.6s ease-out forwards" }}>
                                Medical<br />
                                Reports,<br />
                                <span className="mob-hero-span" style={{ fontSize: "5.5rem", color: "#09d9fd" }}>decoded.</span>
                            </h1>
                            
                            <div className="mob-features" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, animation: "lm-fadein 0.8s ease-out forwards", animationDelay: "0.2s", opacity: 0 }}>
                                {[
                                    { icon: <Icons.sparkles />, title: "Instant Analysis", desc: "Understand complex medical jargon translated into plain English." },
                                    { icon: <Icons.history />, title: "Visual Tracking", desc: "Easily spot out-of-range biomarkers with clear range bars." },
                                    { icon: <Icons.upload />, title: "Universal Format", desc: "Upload any standard PDF medical or blood test report securely." },
                                    { icon: <Icons.send />, title: "Ask Questions", desc: "Chat directly with Lumi AI to clarify any specific health queries." }
                                ].map((f, i) => (
                                    <div key={i} style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 20, padding: "20px 24px", backdropFilter: "blur(12px)", boxShadow: "0 4px 24px -4px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", gap: 10 }}>
                                        <div style={{ color: "#06b6d4", display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 700 }}>
                                            {f.icon} {f.title}
                                        </div>
                                        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                                            {f.desc}
                                        </p>
                                    </div>
                                ))}
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
                            <button style={btn()} onClick={() => setIsPdfHidden(!isPdfHidden)}>
                                <Icons.panel /> {isPdfHidden ? "Show PDF" : "Hide PDF"}
                            </button>
                        )}
                        <button style={btn()} onClick={() => setShowHist(true)}><Icons.history /> History</button>
                        {data && (
                            <button style={{ ...btn(), opacity: isExporting ? 0.7 : 1, cursor: isExporting ? "not-allowed" : "pointer" }} onClick={exportPdf} disabled={isExporting}>
                                <Icons.export /> {isExporting ? "Exporting..." : "Export Summary"}
                            </button>
                        )}
                    </div>
                </div>

                {/* Summary card */}
                <div style={card(0)}>
                    <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 600, margin: "0 0 14px" }}>Summary</h2>
                    {loading ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                            <Skel w="92%" h={13} /><Skel w="78%" h={13} /><Skel w="58%" h={13} />
                        </div>
                    ) : err ? (
                        <div>
                            <p style={{ color: err.includes("quota") ? "#fbbf24" : "#f87171", fontSize: 14, margin: "0 0 14px", lineHeight: 1.6 }}>{err}</p>
                            {err.includes("quota") ? (
                                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ display: "inline-block", background: "#ca8a04", border: "none", borderRadius: 10, padding: "8px 18px", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textDecoration: "none" }}>Get new API key →</a>
                            ) : lastFile && (
                                <button onClick={() => doUpload(lastFile)} style={{ background: "#3b82f6", border: "none", borderRadius: 10, padding: "8px 18px", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>↺ Retry</button>
                            )}
                        </div>
                    ) : data ? (
                        <p style={{ color: "#fff", fontSize: 16, lineHeight: 1.7, margin: 0 }}>{data.summary}</p>
                    ) : (
                        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 15, margin: 0 }}>Upload a medical report to see the AI analysis here.</p>
                    )}
                </div>

                {/* Skeleton lab cards */}
                {loading && [0, 1].map(i => (
                    <div key={i} style={{ background: "#1e293b", borderRadius: 22, padding: "26px 28px", marginBottom: 20 }}>
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
                    <AnimatedCard key={i} style={card(i + 1)} className="no-print">
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

            {/* Floating Chat Widget */}
            {data && (
                <>
                    {/* Tooltip Bubble */}
                    {!isChatOpen && !hasSeenChatTooltip && (
                        <div 
                            className="no-print mob-chat-tooltip"
                            onClick={() => {
                                setIsChatOpen(true);
                                setHasSeenChatTooltip(true);
                                localStorage.setItem("lumina_chat_tooltip_seen", "true");
                            }}
                            style={{
                                position: "fixed",
                                bottom: 100,
                                right: 24,
                                background: "#09d9fd",
                                color: "#000",
                                padding: "10px 16px",
                                borderRadius: "16px 16px 4px 16px",
                                fontSize: 13,
                                fontWeight: 600,
                                boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                                cursor: "pointer",
                                zIndex: 39,
                                animation: "lm-bounce 2.5s infinite ease-in-out",
                            }}
                        >
                            Try Lumi AI! Ask about your report
                        </div>
                    )}

                    {/* Floating Button */}
                    <button
                        className="no-print mob-chat-btn"
                        onClick={() => {
                            setIsChatOpen(!isChatOpen);
                            if (!hasSeenChatTooltip) {
                                setHasSeenChatTooltip(true);
                                localStorage.setItem("lumina_chat_tooltip_seen", "true");
                            }
                        }}
                        style={{ position: "fixed", bottom: 24, right: 24, width: 64, height: 64, borderRadius: 32, background: "transparent", border: "none", boxShadow: "0 0 16px rgba(255,255,255,0.08), 0 8px 24px rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", cursor: "pointer", zIndex: 40, transition: "transform 0.2s", padding: 0, overflow: "hidden" }}
                        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
                        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                    >
                        {isChatOpen ? (
                            <div style={{ width: "100%", height: "100%", background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Icons.x />
                            </div>
                        ) : (
                            <img src="/lumiaiicon.png" alt="Lumi AI" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        )}
                    </button>

                    {/* Chat Window */}
                    {renderChat && (
                        <div className="no-print mob-chat" style={{ 
                            position: "fixed", 
                            bottom: isChatFullScreen ? 24 : 100, 
                            right: 24, 
                            width: isChatFullScreen ? "calc(100vw - 48px)" : 380, 
                            height: isChatFullScreen ? "calc(100vh - 48px)" : "auto",
                            maxHeight: isChatFullScreen ? "calc(100vh - 48px)" : 600, 
                            background: "rgba(21, 35, 49, 0.95)", 
                            backdropFilter: "blur(20px)", 
                            border: "1px solid rgba(255,255,255,0.1)", 
                            borderRadius: 24, 
                            boxShadow: "0 24px 64px rgba(0,0,0,0.4)", 
                            zIndex: 40, 
                            display: "flex", 
                            flexDirection: "column", 
                            overflow: "hidden", 
                            transformOrigin: "bottom right", 
                            animation: isChatOpen ? "lm-fadein 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards" : "lm-fadeout 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                            transition: "width 0.3s cubic-bezier(0.16, 1, 0.3, 1), height 0.3s cubic-bezier(0.16, 1, 0.3, 1), bottom 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
                        }}>
                            
                            {/* Header */}
                            <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.02)" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff" }}>
                                    <span style={{ display: "flex", width: 26, height: 26, borderRadius: "50%", overflow: "hidden" }}>
                                        <img src="/lumiaiicon.png" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                    </span>
                                    <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px" }}>
                                        Lumi
                                    </span>
                                </div>
                                <div style={{ display: "flex", gap: 10 }}>
                                    <button onClick={() => setIsChatFullScreen(!isChatFullScreen)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", display: "flex", padding: 4 }}>
                                        {isChatFullScreen ? <Icons.shrink /> : <Icons.expand />}
                                    </button>
                                    <button onClick={() => {setIsChatOpen(false); setIsChatFullScreen(false);}} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", display: "flex", padding: 4 }}>
                                        <Icons.x />
                                    </button>
                                </div>
                            </div>

                            {/* Messages */}
                            <div style={{ flex: 1, maxHeight: isChatFullScreen ? "none" : 400, overflowY: "auto", padding: "24px 20px 10px", display: "flex", flexDirection: "column", gap: 14 }}>
                                {chat.length === 0 ? (
                                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, textAlign: "center", margin: "auto" }}>Ask Lumi anything about your results!</p>
                                ) : (
                                    chat.map((m, i) => (
                                        <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", flexShrink: 0, animation: "lm-slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}>
                                            <div style={{ background: m.role === "user" ? "#3b82f6" : "rgba(255,255,255,0.08)", borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", padding: "10px 14px", maxWidth: "85%", fontSize: 14, color: "#fff", lineHeight: 1.5, overflowWrap: "break-word" }}>
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
                                        </div>
                                    ))
                                )}
                                {chatLoading && (
                                    <div style={{ display: "flex", gap: 4, padding: "11px 14px", background: "rgba(255,255,255,0.07)", borderRadius: "16px 16px 16px 4px", width: "fit-content" }}>
                                        {[0, 1, 2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.4)", animation: `lm-bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
                                    </div>
                                )}
                                <div ref={chatEnd} />
                            </div>

                            {/* Input */}
                            <div style={{ padding: "16px 20px 20px", display: "flex", gap: 10 }}>
                                <input
                                    value={chatIn} onChange={e => setChatIn(e.target.value)} onKeyDown={onKey}
                                    placeholder="Ask a question..."
                                    disabled={chatLoading}
                                    style={{ flex: 1, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px 16px", color: "#fff", fontSize: 14, fontFamily: "inherit", outline: "none" }}
                                />
                                <button onClick={sendChat} disabled={chatLoading || !chatIn.trim()} style={{ background: "#3b82f6", border: "none", borderRadius: 12, width: 44, height: 44, padding: 0, color: "#fff", cursor: chatLoading || !chatIn.trim() ? "not-allowed" : "pointer", opacity: chatLoading || !chatIn.trim() ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", transition: "opacity 0.2s" }}>
                                    <Icons.send />
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ── HISTORY MODAL ─────────────────────────── */}
            {showHist && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(5px)" }} onClick={() => setShowHist(false)}>
                    <div style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 24, width: 560, maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden" }} onClick={e => e.stopPropagation()}>

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
                                            if (data) {
                                                setData(null);
                                                setPdfUrl(null);
                                                setFileName("");
                                            }
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
                    </div>
                </div>
            )}

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
                @keyframes lm-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
                @keyframes lm-bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }
                @keyframes lm-fadein { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
                @keyframes lm-fadeout { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(20px) scale(0.95); } }
                @keyframes lm-slide-up { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
                ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:999px}
                
                @media (max-width: 768px) {
                    .mob-main { min-width: 0 !important; flex-direction: column !important; padding: 70px 16px 80px !important; gap: 20px !important; height: auto !important; min-height: 100vh !important; }
                    .mob-logo { top: 16px !important; left: 20px !important; }
                    .mob-logo img { height: 42px !important; }
                    .mob-left-panel { width: 100% !important; min-height: 0 !important; }
                    .mob-empty-wrap { padding-left: 0 !important; width: 100% !important; }
                    .mob-history-btn { position: relative !important; margin-bottom: 20px !important; align-self: flex-start !important; }
                    .mob-analysis-header { flex-direction: column !important; gap: 16px !important; }
                    .mob-hero-h1 { font-size: 48px !important; }
                    .mob-hero-span { font-size: 3.5rem !important; }
                    .mob-features { grid-template-columns: 1fr !important; gap: 12px !important; }
                    .mob-chat { 
                        position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; 
                        width: 100vw !important; height: 100vh !important; border-radius: 0 !important; margin: 0 !important; border: none !important; z-index: 1000 !important;
                    }
                    .mob-chat-btn { bottom: 16px !important; right: 16px !important; }
                    .mob-chat-tooltip { bottom: 90px !important; right: 16px !important; }
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
