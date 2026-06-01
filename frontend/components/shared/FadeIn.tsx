"use client"

import React from "react"
import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

export interface FadeInProps {
    children: React.ReactNode
    className?: string
    delay?: number
    duration?: number
    yOffset?: number
}

export function FadeIn({ 
    children, 
    className, 
    delay = 0, 
    duration = 0.35, 
    yOffset = 8 
}: FadeInProps) {
    const shouldReduceMotion = useReducedMotion()

    return (
        <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { y: yOffset, opacity: 0 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ 
                duration, 
                delay, 
                ease: [0.16, 1, 0.3, 1] 
            }}
            className={cn("w-full flex-1 flex flex-col min-h-0", className)}
        >
            {children}
        </motion.div>
    )
}
