import React from 'react';
import GameLogic from './components/GameLogic';

export default function App() {
  return (
    <div className="relative w-full h-screen bg-neutral-900 flex items-center justify-center overflow-hidden">
      {/* 
        Responsive Container Logic:
        - Mantém a proporção 16:9.
        - maxWidth: 177.78vh -> Garante que a largura nunca exceda o que a altura permite (16/9 * altura).
        - maxHeight: 56.25vw -> Garante que a altura nunca exceda o que a largura permite (9/16 * largura).
        Isso resolve o problema de zoom excessivo em landscape.
      */}
      <div 
        className="relative bg-black shadow-2xl border-2 border-neutral-800"
        style={{
          width: '100%',
          height: '100%',
          maxWidth: '177.78vh', 
          maxHeight: '56.25vw',
          aspectRatio: '16/9'
        }}
      >
        <GameLogic />
      </div>
      
      {/* Informações de versão ocultas em telas pequenas para limpar a visão */}
      <div className="absolute top-4 left-4 text-white/30 text-xs font-mono pointer-events-none hidden md:block">
        v2.0 REFACTOR | WASD + MOUSE | TOUCH TWIN-STICK
      </div>
    </div>
  );
}