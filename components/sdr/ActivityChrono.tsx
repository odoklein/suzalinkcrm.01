"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Clock, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// ACTIVITY CHRONO COMPONENT
// Shows time active today and manages start/pause/heartbeat
// ============================================

export function ActivityChrono() {
    const [isActive, setIsActive] = useState(false);
    const [totalSeconds, setTotalSeconds] = useState(0);
    const [currentSessionStart, setCurrentSessionStart] = useState<Date | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPaused, setIsPaused] = useState(false);

    const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const chronoIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastInteractionRef = useRef<Date>(new Date());
    const inactivityCheckRef = useRef<NodeJS.Timeout | null>(null);

    // ============================================
    // FETCH STATUS
    // ============================================

    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch("/api/sdr/activity");
            const json = await res.json();
            
            if (json.success) {
                setIsActive(json.data.isActive);
                setTotalSeconds(json.data.totalActiveSecondsToday || 0);
                if (json.data.currentSessionStartedAt) {
                    setCurrentSessionStart(new Date(json.data.currentSessionStartedAt));
                } else {
                    setCurrentSessionStart(null);
                }
                setIsPaused(!json.data.isActive);
            }
        } catch (err) {
            console.error("Failed to fetch activity status:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // ============================================
    // START SESSION
    // ============================================

    const handleStart = useCallback(async () => {
        try {
            const res = await fetch("/api/sdr/activity/start", { method: "POST" });
            const json = await res.json();
            
            if (json.success) {
                setIsActive(true);
                setCurrentSessionStart(new Date(json.data.currentSessionStartedAt));
                setTotalSeconds(json.data.totalActiveSecondsToday || 0);
                setIsPaused(false);
                lastInteractionRef.current = new Date();
            }
        } catch (err) {
            console.error("Failed to start activity:", err);
        }
    }, []);

    // ============================================
    // PAUSE SESSION
    // ============================================

    const handlePause = useCallback(async () => {
        try {
            const res = await fetch("/api/sdr/activity/pause", { method: "POST" });
            const json = await res.json();
            
            if (json.success) {
                setIsActive(false);
                setCurrentSessionStart(null);
                setTotalSeconds(json.data.totalActiveSecondsToday || 0);
                setIsPaused(true);
            }
        } catch (err) {
            console.error("Failed to pause activity:", err);
        }
    }, []);

    // ============================================
    // HEARTBEAT
    // ============================================

    const sendHeartbeat = useCallback(async () => {
        if (!isActive) return;
        
        try {
            const res = await fetch("/api/sdr/activity/heartbeat", { method: "POST" });
            const json = await res.json();
            if (json.success) {
                // Update state from response (in case auto-pause happened)
                setTotalSeconds(json.data.totalActiveSecondsToday || 0);
                setIsActive(json.data.isActive || false);
                if (json.data.currentSessionStartedAt) {
                    setCurrentSessionStart(new Date(json.data.currentSessionStartedAt));
                } else {
                    setCurrentSessionStart(null);
                    setIsPaused(true);
                }
            }
        } catch (err) {
            console.error("Failed to send heartbeat:", err);
        }
    }, [isActive]);

    // ============================================
    // INACTIVITY DETECTION
    // ============================================

    const checkInactivity = useCallback(() => {
        if (!isActive) return;

        const now = new Date();
        const timeSinceLastInteraction = now.getTime() - lastInteractionRef.current.getTime();
        const FIVE_MINUTES_MS = 5 * 60 * 1000;

        if (timeSinceLastInteraction >= FIVE_MINUTES_MS) {
            // Auto-pause due to inactivity
            handlePause();
        }
    }, [isActive, handlePause]);

    // ============================================
    // USER INTERACTION HANDLERS
    // ============================================

    const handleUserInteraction = useCallback(() => {
        lastInteractionRef.current = new Date();
        
        // If paused due to inactivity and user interacts, resume
        if (isPaused && !isActive) {
            handleStart();
        }
    }, [isPaused, isActive, handleStart]);

    // ============================================
    // EFFECTS
    // ============================================

    // Initial fetch
    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    // Auto-start on mount if not active
    useEffect(() => {
        if (!isLoading && !isActive && !currentSessionStart) {
            handleStart();
        }
    }, [isLoading, isActive, currentSessionStart, handleStart]);

    // Heartbeat interval (every 60s)
    useEffect(() => {
        if (isActive) {
            heartbeatIntervalRef.current = setInterval(sendHeartbeat, 60000);
        } else {
            if (heartbeatIntervalRef.current) {
                clearInterval(heartbeatIntervalRef.current);
                heartbeatIntervalRef.current = null;
            }
        }
        return () => {
            if (heartbeatIntervalRef.current) {
                clearInterval(heartbeatIntervalRef.current);
            }
        };
    }, [isActive, sendHeartbeat]);

    // Chrono update interval (every second)
    useEffect(() => {
        if (isActive && currentSessionStart) {
            chronoIntervalRef.current = setInterval(() => {
                const now = new Date();
                const sessionElapsed = Math.floor((now.getTime() - currentSessionStart.getTime()) / 1000);
                // Total = base total + current session elapsed
                // We'll update totalSeconds from API on heartbeat, but show live elapsed
            }, 1000);
        } else {
            if (chronoIntervalRef.current) {
                clearInterval(chronoIntervalRef.current);
                chronoIntervalRef.current = null;
            }
        }
        return () => {
            if (chronoIntervalRef.current) {
                clearInterval(chronoIntervalRef.current);
            }
        };
    }, [isActive, currentSessionStart]);

    // Inactivity check (every 30s)
    useEffect(() => {
        if (isActive) {
            inactivityCheckRef.current = setInterval(checkInactivity, 30000);
        } else {
            if (inactivityCheckRef.current) {
                clearInterval(inactivityCheckRef.current);
                inactivityCheckRef.current = null;
            }
        }
        return () => {
            if (inactivityCheckRef.current) {
                clearInterval(inactivityCheckRef.current);
            }
        };
    }, [isActive, checkInactivity]);

    // User interaction listeners
    useEffect(() => {
        const events = ["mousemove", "click", "keydown", "scroll", "touchstart"];
        events.forEach((event) => {
            window.addEventListener(event, handleUserInteraction, { passive: true });
        });
        return () => {
            events.forEach((event) => {
                window.removeEventListener(event, handleUserInteraction);
            });
        };
    }, [handleUserInteraction]);

    // ============================================
    // FORMAT TIME
    // ============================================

    const formatTime = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
        }
        return `${minutes}m ${secs.toString().padStart(2, "0")}s`;
    };

    // Calculate display time: base total + current session elapsed
    const displaySeconds = currentSessionStart && isActive
        ? totalSeconds + Math.floor((new Date().getTime() - currentSessionStart.getTime()) / 1000)
        : totalSeconds;

    // ============================================
    // RENDER
    // ============================================

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                <Clock className="w-4 h-4 text-slate-400 animate-spin" />
                <span className="text-sm text-slate-500">Chargement...</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm">
            <Clock className={cn(
                "w-4 h-4",
                isActive ? "text-emerald-500" : "text-slate-400"
            )} />
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-900">
                    {formatTime(displaySeconds)}
                </span>
                {isPaused && (
                    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                        Pause
                    </span>
                )}
                {isActive && (
                    <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                        En ligne
                    </span>
                )}
            </div>
            {!isActive && (
                <button
                    onClick={handleStart}
                    className="p-1 hover:bg-slate-100 rounded transition-colors"
                    title="Démarrer"
                >
                    <Play className="w-3.5 h-3.5 text-slate-600" />
                </button>
            )}
            {isActive && (
                <button
                    onClick={handlePause}
                    className="p-1 hover:bg-slate-100 rounded transition-colors"
                    title="Pause"
                >
                    <Pause className="w-3.5 h-3.5 text-slate-600" />
                </button>
            )}
        </div>
    );
}
