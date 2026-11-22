/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * IPhoneFrame.tsx - Marco de iPhone para vista móvil
 *
 * Envuelve el contenido del juego en un chasis de iPhone 15:
 *   - Pantalla completa en desktop (sin marco)
 *   - Marco de iPhone con Dynamic Island en móviles
 *   - Barra de indicador de inicio (home indicator) inferior
 *   - Alternancia automática según enableFrame e isDesktopMode
 *
 * Sirve para dar la sensación de jugar en un dispositivo móvil
 * incluso cuando se abre en navegador de escritorio.
 */

import React from 'react';

interface IPhoneFrameProps {
  children: React.ReactNode;
  enableFrame?: boolean;
  isDesktopMode?: boolean;
}

export const IPhoneFrame: React.FC<IPhoneFrameProps> = ({
  children,
  enableFrame = true,
  isDesktopMode = false
}) => {
  if (!enableFrame || isDesktopMode) {
    // Desktop / Fullscreen Mode: fills the browser window smoothly
    return (
      <div className="relative w-full h-screen min-h-screen bg-stone-950 flex flex-col min-h-0 overflow-hidden">
        {children}
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center p-0 sm:p-2 w-full h-screen max-h-screen overflow-hidden bg-stone-950">
      {/* iPhone 15 Outer Chassis */}
      <div className="relative w-full sm:w-[393px] h-full sm:h-[min(852px,calc(100vh-1rem))] bg-stone-900 sm:rounded-[48px] sm:p-2.5 sm:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.1),0_0_0_4px_rgba(30,27,24,0.8)] flex flex-col overflow-hidden">
        {/* Dynamic Island (Only in framed view on screens >= sm) */}
        <div className="hidden sm:flex absolute top-4 left-1/2 -translate-x-1/2 z-50 w-24 h-6 bg-black rounded-full items-center justify-end px-2 space-x-1 shadow-md border border-stone-800">
          <div className="w-2 h-2 rounded-full bg-stone-900 border border-stone-800" />
          <div className="w-1.5 h-1.5 rounded-full bg-blue-950/80" />
        </div>

        {/* Screen Bezel & Content Area */}
        <div className="relative w-full h-full min-h-0 sm:rounded-[40px] overflow-hidden bg-stone-950 flex flex-col">
          {children}

          {/* iPhone Home Indicator bar */}
          <div className="pointer-events-none absolute bottom-0.5 left-1/2 -translate-x-1/2 w-28 h-1 bg-white/30 rounded-full z-50" />
        </div>
      </div>
    </div>
  );
};
