"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface AnimatedNumberProps {
    value: number;
    duration?: number;
    className?: string;
    formatFn?: (n: number) => string;
}

export function AnimatedNumber({
    value,
    duration = 600,
    className,
    formatFn,
}: AnimatedNumberProps) {
    const [display, setDisplay] = useState(0);
    const rafRef = useRef<number>(0);
    const startRef = useRef<number>(0);
    const prevRef = useRef(0);

    useEffect(() => {
        const from = prevRef.current;
        const to = value;
        if (from === to) {
            setDisplay(to);
            return;
        }
        startRef.current = performance.now();

        const animate = (now: number) => {
            const elapsed = now - startRef.current;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(from + (to - from) * eased);
            setDisplay(current);
            if (progress < 1) {
                rafRef.current = requestAnimationFrame(animate);
            } else {
                prevRef.current = to;
            }
        };
        rafRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(rafRef.current);
    }, [value, duration]);

    const formatted = formatFn ? formatFn(display) : display.toLocaleString("fr-FR");

    return (
        <span className={cn("tabular-nums", className)}>
            {formatted}
        </span>
    );
}

export default AnimatedNumber;
