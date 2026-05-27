'use client';

import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect } from 'react';

interface NumberRevealProps {
  from?: number;
  to: number;
  duration?: number;
  decimals?: number;
  className?: string;
  onComplete?: () => void;
}

export function NumberReveal({
  from = 0,
  to,
  duration = 2.5,
  decimals = 1,
  className,
  onComplete,
}: NumberRevealProps) {
  const count = useMotionValue(from);
  const rounded = useTransform(count, (val) => val.toFixed(decimals));

  useEffect(() => {
    const controls = animate(count, to, {
      duration,
      ease: 'easeOut',
      onComplete,
    });
    return () => controls.stop();
  }, [to, duration, count, onComplete]);

  return <motion.span className={className}>{rounded}</motion.span>;
}
