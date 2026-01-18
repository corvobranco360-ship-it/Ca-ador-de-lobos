import React from 'react';
import GameLogic from './components/GameLogic';

export default function App() {
  return (
    // Alterado h-screen para h-[100dvh] para suportar barras de navegação mobile corretamente
    // Adicionado p-4 (mobile) e p-8 (desktop) para "diminuir" a tela do jogo e criar margem de segurança
    <div className="relative w-full h-[100dvh] bg-neutral-900 flex items-center justify-center overflow-hidden p-4 md:p-8">
      {/* 
        Responsive Container Logic:
        - Mantém a proporção 16:9.
        - O container agora é limitado pelo padding do pai, garantindo que nunca toque as bordas.
        - As restrições de max-width/max-height continuam funcionando como barreiras extras.
      */}
      <div 
        className="relative bg-black shadow-2xl border-2 border-neutral-800"
        style={{
          width: '100%',
          height: '100%',
          // Reduzido ligeiramente os multiplicadores para garantir que caiba com folga
          maxWidth: '170vh', 
          maxHeight: '54vw',
          aspectRatio: '16/9'
        }}
      >
        <GameLogic />
      </div>
      
      {/* Informações de versão ocultas em telas pequenas para limpar a visão */}
      <div className="absolute top-2 left-2 text-white/20 text-[10px] font-mono pointer-events-none hidden md:block">
        v2.1 SAFE AREA
      </div>
    </div>
  );
}