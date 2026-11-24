import { cn } from "@/lib/utils"

/*
 * fadeInClass — class recipe of the FadeIn motion primitive (component-animation.md, ADR-0157).
 * Lives outside FadeIn.tsx on purpose: no "use client", so Server Components (not-found,
 * loading skeletons) can call it. FadeIn.tsx stays the wrapper for whole sub-views.
 */

export type FadeInFrom = "top" | "bottom" | "left" | "right"
export type FadeInDistance = 1 | 2 | 3 | 4 | 8
export type FadeInDuration = 150 | 200 | 300 | 400 | 500 | 600 | 700
export type FadeInEase = "premium" | "spring"

export interface FadeInClassOptions {
    /** Edge the element slides in from. Omit for a pure fade. */
    from?: FadeInFrom
    /** Slide distance on the spacing scale (follows the density dial). Default 2. */
    distance?: FadeInDistance
    /** Also scale in from 95 %. */
    zoom?: boolean
    /** Fade opacity from 0. Default true; `false` keeps only the slide/zoom. */
    fade?: boolean
    /** Duration in ms. Omit for the library default (150 ms). */
    duration?: FadeInDuration
    /** Delay in ms. */
    delay?: 200
    ease?: FadeInEase
}

/* Literal class tables: Tailwind only generates classes it can read in the source. */
const SLIDE: Record<FadeInFrom, Record<FadeInDistance, string>> = {
    top: { 1: "slide-in-from-top-1", 2: "slide-in-from-top-2", 3: "slide-in-from-top-3", 4: "slide-in-from-top-4", 8: "slide-in-from-top-8" },
    bottom: { 1: "slide-in-from-bottom-1", 2: "slide-in-from-bottom-2", 3: "slide-in-from-bottom-3", 4: "slide-in-from-bottom-4", 8: "slide-in-from-bottom-8" },
    left: { 1: "slide-in-from-left-1", 2: "slide-in-from-left-2", 3: "slide-in-from-left-3", 4: "slide-in-from-left-4", 8: "slide-in-from-left-8" },
    right: { 1: "slide-in-from-right-1", 2: "slide-in-from-right-2", 3: "slide-in-from-right-3", 4: "slide-in-from-right-4", 8: "slide-in-from-right-8" },
}

const DURATION: Record<FadeInDuration, string> = {
    150: "duration-150",
    200: "duration-200",
    300: "duration-300",
    400: "duration-400",
    500: "duration-500",
    600: "duration-600",
    700: "duration-700",
}

const EASE: Record<FadeInEase, string> = {
    premium: "ease-premium",
    spring: "ease-[cubic-bezier(0.34,1.56,0.64,1)]",
}

/**
 * Entry-animation classes for an element that cannot be wrapped in `<FadeIn>`.
 * Always reduced-motion aware and `fill-mode-both`.
 *
 * @example <p role="alert" className={cn("text-destructive", fadeInClass({ from: "top", distance: 1, duration: 200 }))}>
 */
export function fadeInClass({ from, distance = 2, zoom = false, fade = true, duration, delay, ease }: FadeInClassOptions = {}): string {
    return cn(
        "animate-in fill-mode-both motion-reduce:animate-none motion-reduce:opacity-100",
        fade && "fade-in",
        zoom && "zoom-in-95",
        from && SLIDE[from][distance],
        duration && DURATION[duration],
        delay === 200 && "delay-200",
        ease && EASE[ease],
    )
}
