'use client';
import {useEffect, useState} from "react";
import {isvToCyr} from "@/lib/isv";

interface SynonymGraphProps {
    word: string;
    wordId: number;
    currentScript: string;
    firstLevelSynonyms: { targetWordId: number; targetWord: string; targetMeaning: string }[];
    onClose: () => void;
}

const ROOT_COLOR = "#1e40af";
const FIRST_COLOR = "#3b82f6";
const SECOND_COLOR = "#d1d5db";

export default function SynonymGraph({word, wordId, currentScript, firstLevelSynonyms, onClose}: SynonymGraphProps) {
    const [secondLevelMap, setSecondLevelMap] = useState<Record<number, any[]>>({});
    const [loading, setLoading] = useState(true);

    const uniqueFirst = firstLevelSynonyms.filter(
        (s, i, a) => a.findIndex(x => x.targetWordId === s.targetWordId) === i
    );

    useEffect(() => {
        const ids = uniqueFirst.map(s => s.targetWordId);
        if (!ids.length) { setLoading(false); return; }
        fetch("/api/synonyms/second-level", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({lexemeIds: ids}),
        })
            .then(r => r.json())
            .then(data => setSecondLevelMap(data))
            .finally(() => setLoading(false));
    }, []);

    const nodes: { id: number; word: string; meaning: string; level: 0 | 1 | 2; parentId?: number }[] = [{id: wordId, word, meaning: "", level: 0}];
    const edges: { from: number; to: number }[] = [];
    const secondLevelNodes: { parentId: number; item: any }[] = [];

    for (const syn of uniqueFirst) {
        nodes.push({id: syn.targetWordId, word: syn.targetWord, meaning: syn.targetMeaning, level: 1, parentId: wordId});
        edges.push({from: wordId, to: syn.targetWordId});
    }

    for (const [parentId, synonyms] of Object.entries(secondLevelMap)) {
        const pid = Number(parentId);
        const existingIds = new Set(nodes.map(n => n.id));
        const filtered = synonyms.filter((s: any) => s.targetWordId !== wordId && !existingIds.has(s.targetWordId));
        for (const s of filtered.slice(0, 4)) {
            secondLevelNodes.push({parentId: pid, item: s});
            nodes.push({id: s.targetWordId, word: s.targetWord, meaning: s.targetMeaning, level: 2, parentId: pid});
            edges.push({from: pid, to: s.targetWordId});
        }
    }

    const cx = 400, cy = 350;
    const r1 = 140, r2 = 100;

    const positions: Record<number, { x: number; y: number }> = {};
    positions[wordId] = {x: cx, y: cy};

    const n1 = uniqueFirst.length;
    for (let i = 0; i < n1; i++) {
        const angle = (2 * Math.PI * i) / n1 - Math.PI / 2;
        positions[uniqueFirst[i].targetWordId] = {
            x: cx + r1 * Math.cos(angle),
            y: cy + r1 * Math.sin(angle),
        };
    }

    const childCounts: Record<number, number> = {};
    for (const sl of secondLevelNodes) {
        childCounts[sl.parentId] = (childCounts[sl.parentId] || 0) + 1;
    }

    const childIndex: Record<number, number> = {};
    for (const sl of secondLevelNodes) {
        childIndex[sl.parentId] = (childIndex[sl.parentId] || 0);
        const total = childCounts[sl.parentId] || 1;
        const idx = childIndex[sl.parentId];
        const pid = sl.parentId;
        const parentPos = positions[pid];
        if (parentPos) {
            const baseAngle = Math.atan2(parentPos.y - cy, parentPos.x - cx);
            const spread = Math.PI / 3;
            const angle = baseAngle + (idx / (total - 1 || 1) - 0.5) * spread;
            positions[sl.item.targetWordId] = {
                x: parentPos.x + r2 * 0.6 * Math.cos(angle),
                y: parentPos.y + r2 * 0.6 * Math.sin(angle),
            };
        }
        childIndex[sl.parentId] = idx + 1;
    }

    const dotR = 6;
    const labelOffset = dotR + 6;
    const displayVal = (val: string) => currentScript === "CYRILLIC" ? isvToCyr(val) : val;

    const fillForLevel = (level: number) =>
        level === 0 ? ROOT_COLOR : level === 1 ? FIRST_COLOR : SECOND_COLOR;

    const fontWeightForLevel = (level: number) =>
        level === 0 ? "bold" : level === 1 ? "600" : "400";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
             onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-[90vw] h-[90vh] max-w-[900px] max-h-[800px] p-6 flex flex-col"
                 onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-bold text-slate-800">Граф синонимов</h2>
                    <button onClick={onClose}
                            className="text-slate-400 hover:text-slate-600 text-2xl leading-none p-1">&times;</button>
                </div>
                <div className="flex-1 overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-slate-400">
                            <svg className="animate-spin h-8 w-8 mr-2" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                            Загрузка графа...
                        </div>
                    ) : (
                    <svg viewBox="0 0 800 700" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                        <defs>
                            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                                <polygon points="0 0, 8 3, 0 6" fill="#94a3b8"/>
                            </marker>
                        </defs>

                        {edges.map((edge, i) => {
                            const from = positions[edge.from];
                            const to = positions[edge.to];
                            if (!from || !to) return null;
                            return (
                                <line key={`e${i}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                                      stroke="#cbd5e1" strokeWidth="1.5" markerEnd="url(#arrowhead)"/>
                            );
                        })}

                        {nodes.map(n => {
                            const pos = positions[n.id];
                            if (!pos) return null;
                            const fill = fillForLevel(n.level);
                            const isRoot = n.level === 0;

                            return (
                                <g key={`n${n.id}`}>
                                    <a href={`/words/${n.id}`} target="_blank" rel="noopener noreferrer">
                                        <circle cx={pos.x} cy={pos.y} r={dotR} fill={fill}
                                                className="transition-opacity hover:opacity-80 cursor-pointer"/>
                                        <text x={pos.x + labelOffset} y={pos.y} dominantBaseline="central"
                                              fill="#334155" fontSize={isRoot ? 15 : 13}
                                              fontWeight={fontWeightForLevel(n.level)}
                                              className="cursor-pointer select-none hover:text-blue-600">
                                            {displayVal(n.word)}
                                            {n.meaning && (
                                                <tspan fill="#94a3b8" fontSize={11} fontWeight="400">
                                                    {" — "}{n.meaning}
                                                </tspan>
                                            )}
                                        </text>
                                    </a>
                                </g>
                            );
                        })}
                    </svg>
                    )}
                </div>
            </div>
        </div>
    );
}