import React from 'react';
import { motion } from 'motion/react';

export const Visualizer = ({ state, audioLevel }: { state: 'idle' | 'listening' | 'processing' | 'speaking', audioLevel: number }) => {
  let colors = ['#3b82f6', '#8b5cf6'];
  if (state === 'listening') colors = ['#06b6d4', '#10b981'];
  else if (state === 'processing') colors = ['#f59e0b', '#ef4444'];
  else if (state === 'speaking') colors = ['#ec4899', '#8b5cf6'];

  const scale = state === 'idle' ? 1 : 1 + audioLevel * 0.4;
  const isAnimating = state !== 'idle';

  return (
    <div className="relative flex items-center justify-center w-64 h-64">
      <motion.div
        className="absolute inset-0 rounded-full blur-[60px] opacity-60"
        animate={{
          background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
          scale: isAnimating ? [scale, scale * 1.1, scale] : 1,
          rotate: isAnimating ? 360 : 0,
        }}
        transition={{
          scale: { duration: 0.5, repeat: Infinity, repeatType: 'reverse' },
          rotate: { duration: 8, repeat: Infinity, ease: 'linear' },
          background: { duration: 1 }
        }}
      />
      <motion.div
        className="relative w-32 h-32 rounded-full backdrop-blur-2xl border border-white/20 shadow-[inset_0_0_40px_rgba(255,255,255,0.2)] overflow-hidden"
        animate={{
          scale: scale,
          boxShadow: `0 0 ${20 + audioLevel * 40}px ${colors[0]}80`,
        }}
        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
      >
        <motion.div 
          className="absolute inset-0 opacity-80"
          animate={{
            background: `linear-gradient(45deg, ${colors[0]}, ${colors[1]})`,
            rotate: isAnimating ? -360 : 0,
          }}
          transition={{
            rotate: { duration: 4, repeat: Infinity, ease: 'linear' },
            background: { duration: 1 }
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/40 rounded-full" />
      </motion.div>
    </div>
  );
};
