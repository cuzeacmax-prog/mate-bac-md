"use client";

/**
 * MotionProvider — ETAPA 70 FAZA A2: respect GLOBAL pentru
 * prefers-reduced-motion. Cu reducedMotion="user", Framer Motion elimină
 * animațiile de transform/layout pentru userii care au cerut mișcare redusă
 * și păstrează doar fade-urile de opacity (degradare la fade simplu).
 */
import { MotionConfig } from "framer-motion";

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
