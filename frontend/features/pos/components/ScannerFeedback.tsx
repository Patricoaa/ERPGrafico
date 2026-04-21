"use client"

import { useEffect, useState, forwardRef, useImperativeHandle } from "react"
import { cn } from "@/lib/utils"

export interface ScannerFeedbackHandle {
    triggerSuccess: () => void
    triggerError: () => void
}

export const ScannerFeedback = forwardRef<ScannerFeedbackHandle>((_, ref) => {
    const [flash, setFlash] = useState<"success" | "error" | null>(null)

    useImperativeHandle(ref, () => ({
        triggerSuccess: () => {
            setFlash("success")
            playBeep(800, 0.1)
            setTimeout(() => setFlash(null), 300)
        },
        triggerError: () => {
            setFlash("error")
            playBeep(200, 0.3)
            setTimeout(() => setFlash(null), 500)
        }
    }))

    const playBeep = (freq: number, duration: number) => {
        try {
            const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
            const context = new AudioContextClass()
            const osc = context.createOscillator()
            const gain = context.createGain()

            osc.frequency.setValueAtTime(freq, context.currentTime)
            osc.type = "sine"

            gain.gain.setValueAtTime(0.1, context.currentTime)
            gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + duration)

            osc.connect(gain)
            gain.connect(context.destination)

            osc.start()
            osc.stop(context.currentTime + duration)
        } catch (e) {
            console.warn("AudioContext not supported or blocked", e)
        }
    }

    if (!flash) return null

    return (
        <div
            className={cn(
                "fixed inset-0 z-[100] pointer-events-none transition-opacity duration-300",
                flash === "success" ? "bg-success/10 border-[10px] border-success/30" : "bg-destructive/10 border-[10px] border-destructive/30",
                "animate-in fade-in out-fade-out"
            )}
        />
    )
})

ScannerFeedback.displayName = "ScannerFeedback"
