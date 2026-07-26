import {
    ChangeEvent, DragEvent, KeyboardEvent,
    useRef, useState, useEffect, useCallback
} from "react";

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
    summary: string; results: LabResult[];
};
type ChatMsg = { role: "user" | "assistant"; content: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractNums(s: string): number[] {
    return (s.match(/\d+\.?\d*/g) || []).map(Number);
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
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const Badge = ({ s }: { s: "Low" | "Normal" | "High" }) => (
    <span style={{
        display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
        background: s === "Normal" ? "#16a34a" : s === "High" ? "#ca8a04" : "#dc2626",
        borderRadius: 999, padding: "5px 13px 5px 9px",
        fontSize: 12, fontWeight: 600, color: "#fff", fontFamily: "inherit",
    }}>
        {s === "Normal" ? <Icons.check /> : <Icons.warn />} {s}
    </span>
);

const RangeBar = ({ value, normal_range, status }: { value: string; normal_range: string; status: "Low" | "Normal" | "High" }) => {
    const vNums = extractNums(value);
    const rNums = extractNums(normal_range);
    if (!vNums.length || !rNums.length) return null;

    const val = vNums[0];
    // Handle single-bound ranges like "<1.00" or "<20" — treat 0 as min
    const isUpperOnly = rNums.length === 1 || (
        normal_range.includes('<') && !normal_range.match(/\d+.*-.*\d+/)
    );
    const rMin = isUpperOnly ? 0 : rNums[0];
    const rMax = isUpperOnly ? rNums[0] : rNums[rNums.length - 1];
    if (rMin >= rMax) return null;

    const span = rMax - rMin;
    const bMin = Math.max(0, rMin - span * 0.4);
    const bMax = rMax + span * 0.4;
    const bSpan = bMax - bMin;
    const clamp = (v: number) => Math.max(0, Math.min(100, (v - bMin) / bSpan * 100));
    const dotColor = status === "Normal" ? "#22c55e" : status === "High" ? "#eab308" : "#ef4444";
    const rangeLabel = isUpperOnly ? `< ${rMax}` : `${rMin} – ${rMax}`;
    return (
        <div style={{ marginTop: 14 }}>
            <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 999, position: "relative" }}>
                <div style={{ position: "absolute", left: `${clamp(rMin)}%`, width: `${clamp(rMax) - clamp(rMin)}%`, height: "100%", background: "rgba(34,197,94,0.25)", borderRadius: 999 }} />
                <div style={{ position: "absolute", top: "50%", left: `${clamp(val)}%`, transform: "translate(-50%,-50%)", width: 13, height: 13, borderRadius: "50%", background: dotColor, border: "2px solid rgba(255,255,255,0.85)", boxShadow: `0 0 8px ${dotColor}`, zIndex: 1 }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7, fontSize: 11, color: "rgba(255,255,255,0.28)" }}>
                <span>{bMin.toFixed(1)}</span>
                <span style={{ color: "rgba(34,197,94,0.55)" }}>Normal {rangeLabel}</span>
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

    // Animate cards in one by one
    useEffect(() => {
        if (!data) return;
        setVisible(new Set());
        const total = data.results.length + 2; // summary + results + chat
        for (let i = 0; i < total; i++) {
            setTimeout(() => setVisible(prev => new Set([...prev, i])), i * 130);
        }
    }, [data]);

    useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

    const doUpload = useCallback(async (file: File) => {
        if (file.size > 20 * 1024 * 1024) { setErr("File too large — max 20 MB."); return; }
        setLoading(true); setErr(null); setData(null); setChat([]);
        setPdfUrl(URL.createObjectURL(file));
        const fd = new FormData(); fd.append("file", file);
        try {
            const res = await fetch("http://127.0.0.1:8000/upload/", { method: "POST", body: fd });
            if (!res.ok) throw new Error(`Server error ${res.status}`);
            const d: MedicalSummary = await res.json();
            setData(d);
            const c = buildContext(d, file.name); setCtx(c);
            const entry: HistoryEntry = { id: Date.now().toString(), date: new Date().toISOString(), fileName: file.name, summary: d.summary, results: d.results };
            const updated = [entry, ...history].slice(0, 25);
            setHistory(updated); saveHistory(updated);
        } catch (e: any) { setErr(e.message || "Failed to reach backend."); setPdfUrl(null); }
        finally { setLoading(false); }
    }, [history]);

    const pick = (file?: File) => { if (file) { setFileName(file.name); setLastFile(file); doUpload(file); } };
    const onFileChange = (e: ChangeEvent<HTMLInputElement>) => pick(e.target.files?.[0]);
    const onDragOver = (e: DragEvent<HTMLElement>) => { e.preventDefault(); setDragging(true); };
    const onDragLeave = (e: DragEvent<HTMLElement>) => { e.preventDefault(); setDragging(false); };
    const onDrop = (e: DragEvent<HTMLElement>) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0]); };

    const clear = () => {
        setData(null); setFileName(""); setPdfUrl(null); setErr(null);
        setVisible(new Set()); setChat([]); setCtx(""); setLastFile(null);
        if (fileRef.current) fileRef.current.value = "";
    };

    const sendChat = async () => {
        const msg = chatIn.trim(); if (!msg || chatLoading) return;
        const next: ChatMsg[] = [...chat, { role: "user", content: msg }];
        setChat(next); setChatIn(""); setChatLoading(true);
        try {
            const res = await fetch("http://127.0.0.1:8000/chat/", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ report_context: ctx, messages: chat.map(m => ({ role: m.role, content: m.content })), new_message: msg }),
            });
            if (!res.ok) throw new Error();
            const d = await res.json();
            setChat([...next, { role: "assistant", content: d.response }]);
        } catch { setChat([...next, { role: "assistant", content: "Sorry, couldn't reach the backend." }]); }
        finally { setChatLoading(false); }
    };
    const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } };

    const deletEntry = (id: string) => { const u = history.filter(h => h.id !== id); setHistory(u); saveHistory(u); };
    const loadEntry = (e: HistoryEntry) => {
        setData({ summary: e.summary, results: e.results });
        setFileName(e.fileName); setCtx(buildContext({ summary: e.summary, results: e.results }, e.fileName));
        setChat([]); setPdfUrl(null); setShowHist(false);
    };

    const trendNames = [...new Set(history.flatMap(e => e.results.map(r => r.test_name)))];

    // Card animation style helper
    const card = (i: number, extra?: object): React.CSSProperties => ({
        background: "#1e293b", borderRadius: 22, padding: "26px 28px", marginBottom: 20,
        opacity: visible.has(i) ? 1 : 0,
        transform: visible.has(i) ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 0.45s ease, transform 0.45s ease",
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
        <main style={{ background: "linear-gradient(180deg,#152331 0%,#000 100%)", minHeight: "100vh", minWidth: 1440, display: "flex", alignItems: "flex-start", padding: 40, paddingTop: 110, gap: 60, fontFamily: "'Plus Jakarta Sans',sans-serif", boxSizing: "border-box", position: "relative" }}>

            {/* ── LOGO TOP LEFT ─────────────────────────── */}
            <div style={{ position: "absolute", top: 18, left: 40, zIndex: 10 }}>
                <img
                    src="/logo.png"
                    alt="Lumina"
                    style={{ height: 64, width: "auto", objectFit: "contain", mixBlendMode: "screen", display: "block" }}
                />
            </div>

            {/* ── LEFT PANEL ────────────────────────────── */}
            <section
                style={{ width: 432, minHeight: 680, flexShrink: 0, background: "#1e293b", borderRadius: 40, border: `1.5px dashed ${dragging ? "#fff" : "rgba(255,255,255,0.3)"}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: pdfUrl ? "flex-start" : "center", overflow: "hidden", position: "relative", transition: "border-color 0.2s" }}
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
            <section style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, paddingTop: 10 }}>

                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
                    <div>
                        <h1 style={{ color: "#fff", fontSize: 46, fontWeight: 700, margin: "0 0 6px", lineHeight: 1.1, textShadow: "0 0 28px rgba(255,255,255,0.3)" }}>Analysis</h1>
                        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, margin: 0 }}>Upload a PDF to generate insights</p>
                    </div>
                    {data && (
                        <div className="no-print" style={{ display: "flex", gap: 8, paddingTop: 8 }}>
                            <button style={btn()} onClick={() => setShowHist(true)}><Icons.history /> History</button>
                            <button style={btn()} onClick={() => window.print()}><Icons.export /> Export PDF</button>
                        </div>
                    )}
                </div>

                {/* Summary card */}
                <div style={card(0)}>
                    <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 600, margin: "0 0 14px", textShadow: "0 0 24px rgba(255,255,255,0.5)" }}>Summary</h2>
                    {loading ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                            <Skel w="92%" h={13} /><Skel w="78%" h={13} /><Skel w="58%" h={13} />
                        </div>
                    ) : err ? (
                        <div>
                            <p style={{ color: "#f87171", fontSize: 15, margin: "0 0 14px", lineHeight: 1.5 }}>{err}</p>
                            {lastFile && <button onClick={() => doUpload(lastFile)} style={{ background: "#3b82f6", border: "none", borderRadius: 10, padding: "8px 18px", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>↺ Retry</button>}
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
                    <article key={i} style={card(i + 1)} aria-labelledby={`res-${i}`}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <h2 id={`res-${i}`} style={{ color: "#fff", fontSize: 20, fontWeight: 600, margin: 0, textShadow: "0 0 18px rgba(255,255,255,0.2)" }}>{r.test_name}</h2>
                            <Badge s={r.status_badge} />
                        </div>
                        <p style={{ color: "#fff", fontSize: 32, fontWeight: 700, margin: "14px 0 4px" }}>{r.value}</p>
                        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, margin: 0 }}>{r.normal_range}</p>
                        <RangeBar value={r.value} normal_range={r.normal_range} status={r.status_badge} />
                    </article>
                ))}

                {/* AI Chat */}
                {data && (
                    <div className="no-print" style={card(data.results.length + 1)}>
                        <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 600, margin: "0 0 18px", textShadow: "0 0 24px rgba(255,255,255,0.3)" }}>Ask Lumina AI</h2>

                        {chat.length > 0 && (
                            <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: 14, display: "flex", flexDirection: "column", gap: 10, paddingRight: 4 }}>
                                {chat.map((m, i) => (
                                    <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                                        <div style={{ background: m.role === "user" ? "#3b82f6" : "rgba(255,255,255,0.08)", borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", padding: "10px 14px", maxWidth: "82%", fontSize: 14, color: "#fff", lineHeight: 1.6 }}>
                                            {m.content}
                                        </div>
                                    </div>
                                ))}
                                {chatLoading && (
                                    <div style={{ display: "flex", gap: 4, padding: "11px 14px", background: "rgba(255,255,255,0.07)", borderRadius: "16px 16px 16px 4px", width: "fit-content" }}>
                                        {[0, 1, 2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.4)", animation: `lm-bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
                                    </div>
                                )}
                                <div ref={chatEnd} />
                            </div>
                        )}

                        <div style={{ display: "flex", gap: 10 }}>
                            <input
                                value={chatIn} onChange={e => setChatIn(e.target.value)} onKeyDown={onKey}
                                placeholder="e.g. What foods help improve my hemoglobin?"
                                disabled={chatLoading}
                                style={{ flex: 1, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px 16px", color: "#fff", fontSize: 14, fontFamily: "inherit", outline: "none" }}
                            />
                            <button onClick={sendChat} disabled={chatLoading || !chatIn.trim()} style={{ background: "#3b82f6", border: "none", borderRadius: 12, padding: "12px 18px", color: "#fff", cursor: chatLoading || !chatIn.trim() ? "not-allowed" : "pointer", opacity: chatLoading || !chatIn.trim() ? 0.5 : 1, display: "flex", alignItems: "center", transition: "opacity 0.2s" }}>
                                <Icons.send />
                            </button>
                        </div>
                    </div>
                )}
            </section>

            {/* ── HISTORY MODAL ─────────────────────────── */}
            {showHist && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(5px)" }} onClick={() => setShowHist(false)}>
                    <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 24, width: 560, maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden" }} onClick={e => e.stopPropagation()}>

                        {/* Modal header */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "22px 26px 0" }}>
                            <h2 style={{ color: "#fff", fontSize: 18, fontWeight: 600, margin: 0 }}>Report History</h2>
                            <button onClick={() => setShowHist(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", display: "flex" }}><Icons.x /></button>
                        </div>

                        {/* Tabs */}
                        <div style={{ display: "flex", gap: 6, padding: "14px 26px 0" }}>
                            {(["history", "trends"] as const).map(t => (
                                <button key={t} onClick={() => setHistTab(t)} style={{ background: histTab === t ? "rgba(59,130,246,0.18)" : "transparent", border: `1px solid ${histTab === t ? "rgba(59,130,246,0.45)" : "transparent"}`, borderRadius: 9, padding: "5px 14px", color: histTab === t ? "#60a5fa" : "rgba(255,255,255,0.35)", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>
                                    {t}
                                </button>
                            ))}
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
                ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:999px}
                @media print {
                    .no-print { display:none!important; }
                    main { padding:20px; min-width:auto; gap:30px; }
                    section:first-child { display:none; }
                }
            `}</style>
        </main>
    );
};
