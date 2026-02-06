/**
 * useDeviceContext Hook
 * 
 * Detects device capabilities and screen size for adaptive UX.
 * Used throughout POS to provide optimal experiences on:
 * - Desktop (mouse/keyboard)
 * - Tablet POS (touch + large screen)
 * - Mobile (touch + small screen)
 */

import { useEffect, useState } from 'react'

export interface DeviceContext {
    /** Device has touch input (pointer: coarse) */
    isTouch: boolean

    /** Screen width >= 1024px */
    isLargeScreen: boolean

    /** Screen width >= 768px and < 1024px */
    isMediumScreen: boolean

    /** Screen width < 768px */
    isSmallScreen: boolean

    /** Touch device with large screen (ideal for POS tablets) */
    isTouchPOS: boolean

    /** Desktop experience (non-touch, typically mouse/keyboard) */
    isDesktop: boolean

    /** User prefers reduced motion */
    preferReducedMotion: boolean

    /** Screen width in pixels */
    screenWidth: number

    /** Screen height in pixels */
    screenHeight: number
}

const BREAKPOINTS = {
    small: 768,
    large: 1024,
} as const

export function useDeviceContext(): DeviceContext {
    const [context, setContext] = useState<DeviceContext>(() => {
        // Server-side or initial render defaults
        if (typeof window === 'undefined') {
            return {
                isTouch: false,
                isLargeScreen: true,
                isMediumScreen: false,
                isSmallScreen: false,
                isTouchPOS: false,
                isDesktop: true,
                preferReducedMotion: false,
                screenWidth: 1920,
                screenHeight: 1080,
            }
        }

        return detectDevice()
    })

    useEffect(() => {
        // Update on resize or media query changes
        const updateContext = () => {
            setContext(detectDevice())
        }

        // Listen to resize
        window.addEventListener('resize', updateContext)

        // Listen to media query changes
        const touchQuery = window.matchMedia('(pointer: coarse)')
        const largeQuery = window.matchMedia(`(min-width: ${BREAKPOINTS.large}px)`)
        const mediumQuery = window.matchMedia(`(min-width: ${BREAKPOINTS.small}px) and (max-width: ${BREAKPOINTS.large - 1}px)`)
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

        const handleChange = () => updateContext()

        touchQuery.addEventListener?.('change', handleChange)
        largeQuery.addEventListener?.('change', handleChange)
        mediumQuery.addEventListener?.('change', handleChange)
        motionQuery.addEventListener?.('change', handleChange)

        return () => {
            window.removeEventListener('resize', updateContext)
            touchQuery.removeEventListener?.('change', handleChange)
            largeQuery.removeEventListener?.('change', handleChange)
            mediumQuery.removeEventListener?.('change', handleChange)
            motionQuery.removeEventListener?.('change', handleChange)
        }
    }, [])

    return context
}

function detectDevice(): DeviceContext {
    const isTouch = window.matchMedia('(pointer: coarse)').matches
    const screenWidth = window.innerWidth
    const screenHeight = window.innerHeight
    const isLargeScreen = screenWidth >= BREAKPOINTS.large
    const isMediumScreen = screenWidth >= BREAKPOINTS.small && screenWidth < BREAKPOINTS.large
    const isSmallScreen = screenWidth < BREAKPOINTS.small
    const preferReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const isTouchPOS = isTouch && isLargeScreen
    const isDesktop = !isTouch

    return {
        isTouch,
        isLargeScreen,
        isMediumScreen,
        isSmallScreen,
        isTouchPOS,
        isDesktop,
        preferReducedMotion,
        screenWidth,
        screenHeight,
    }
}

/** Minimum touch target size (iOS and Android guidelines) */
export const MIN_TOUCH_TARGET = 44 // pixels

/** Recommended spacing between touch targets */
export const TOUCH_TARGET_SPACING = 8 // pixels

/** Font size that prevents mobile zoom on input focus */
export const MIN_MOBILE_FONT_SIZE = 16 // pixels
