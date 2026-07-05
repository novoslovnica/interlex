"use client"

import { useState, useCallback } from "react"
import { convert, type Script, SCRIPT_LABELS } from "@/lib/transliteration"

const SCRIPTS: Script[] = ["etym_lat", "etym_cyr", "std_lat", "std_cyr", "simple_lat", "simple_cyr"]

export default function TransliterationClient() {
  const [sourceText, setSourceText] = useState("")
  const [fromScript, setFromScript] = useState<Script>("etym_lat")
  const [toScript, setToScript] = useState<Script>("std_lat")

  const resultText = convert(sourceText, fromScript, toScript)

  const handleSwap = useCallback(() => {
    setFromScript(toScript)
    setToScript(fromScript)
    setSourceText(resultText)
  }, [fromScript, toScript, resultText])

  return (
    <div className="min-h-screen py-10 bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-[#0f172a] dark:text-slate-100">
      <div className="max-w-5xl mx-auto px-4 md:px-6 space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Транслитератор</h1>
        <p className="text-sm text-muted-foreground">
          Конвертация текста между системами правописания межславянского языка.
          Все преобразования проходят через этимологическую латиницу.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start">
          <div className="space-y-2">
            <select
              className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
              value={fromScript}
              onChange={(e) => setFromScript(e.target.value as Script)}
            >
              {SCRIPTS.map((s) => (
                <option key={s} value={s}>{SCRIPT_LABELS[s]}</option>
              ))}
            </select>
            <textarea
              className="w-full h-64 p-4 border rounded-lg text-base leading-relaxed resize-y bg-background font-mono"
              placeholder="Введите текст для конвертации..."
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
            />
          </div>

          <div className="flex md:flex-col items-center justify-center gap-2 pt-8">
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              onClick={handleSwap}
              title="Поменять направления"
            >
              ⇄
            </button>
          </div>

          <div className="space-y-2">
            <select
              className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
              value={toScript}
              onChange={(e) => setToScript(e.target.value as Script)}
            >
              {SCRIPTS.map((s) => (
                <option key={s} value={s}>{SCRIPT_LABELS[s]}</option>
              ))}
            </select>
            <textarea
              className="w-full h-64 p-4 border rounded-lg text-base leading-relaxed resize-y bg-background font-mono"
              placeholder="Результат..."
              value={resultText}
              readOnly
            />
          </div>
        </div>
      </div>
    </div>
  )
}