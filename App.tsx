import React from 'react';
import GameLogic from './components/GameLogic';

export default function App() {
  return (
    <div className="relative w-full h-screen bg-neutral-900 flex items-center justify-center overflow-hidden">
      <div className="w-full max-w-5xl aspect-video bg-black shadow-2xl border-4 border-neutral-800">
        <GameLogic />
      </div>
      <div className="absolute top-4 left-4 text-white/30 text-xs font-mono pointer-events-none">
        v2.0 REFACTOR | WASD + MOUSE | TOUCH TWIN-STICK
      </div>
    </div>
  );
}
