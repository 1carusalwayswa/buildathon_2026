import { useState, useEffect, useRef, useCallback } from 'react';
import type { SimResult } from '../types';

export type PlaybackSpeed = 0.5 | 1 | 2;

export interface SimulationState {
  currentStep: number;
  isPlaying: boolean;
  speed: PlaybackSpeed;
  activatedAtStep: Set<string>;
  newAtStep: string[];
  totalSteps: number;
  play: () => void;
  pause: () => void;
  setStep: (step: number) => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  reset: () => void;
}

export function useSimulationState(simResult: SimResult | null): SimulationState {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSteps = simResult ? simResult.steps.length - 1 : 0;

  const activatedAtStep = simResult
    ? new Set(simResult.steps[currentStep]?.activated ?? [])
    : new Set<string>();

  const newAtStep = simResult
    ? simResult.steps[currentStep]?.new_activated ?? []
    : [];

  const pause = useCallback(() => {
    setIsPlaying(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const play = useCallback(() => {
    if (!simResult || currentStep >= totalSteps) return;
    setIsPlaying(true);
  }, [simResult, currentStep, totalSteps]);

  const reset = useCallback(() => {
    pause();
    setCurrentStep(0);
  }, [pause]);

  const setStep = useCallback((step: number) => {
    setCurrentStep(Math.max(0, Math.min(step, totalSteps)));
  }, [totalSteps]);

  useEffect(() => {
    if (!isPlaying || !simResult) return;
    const delay = 1000 / speed;
    intervalRef.current = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= totalSteps) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, delay);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, speed, simResult, totalSteps]);

  useEffect(() => {
    if (simResult) {
      setCurrentStep(0);
      setIsPlaying(false);
    }
  }, [simResult]);

  return {
    currentStep,
    isPlaying,
    speed,
    activatedAtStep,
    newAtStep,
    totalSteps,
    play,
    pause,
    setStep,
    setSpeed,
    reset,
  };
}
