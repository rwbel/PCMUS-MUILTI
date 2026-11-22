/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * LobbyScreen.tsx - Sala de espera principal: perfil (nombre y avatar), crear mesa y mesas abiertas
 */

import React, { useState } from 'react';
import { CHARACTERS, PLAYABLE_CHARACTER_IDS } from '../utils/characters';
import { PlayerProfile, RoomSummary, RoomVisibility } from '../types/multiplayer';
import { WsConnectionStatus } from '../services/multiplayerClient';

interface LobbyScreenProps {
  profile: PlayerProfile;
  connectionStatus: WsConnectionStatus;
  rooms: RoomSummary[];
  error: string | null;
  onClearError: () => void;
  onUpdateProfile: (name: string, avatarId: string) => void;
  onCreateRoom: (opts: { title?: string; visibility: RoomVisibility; autoStartSolo?: boolean }) => void;
  onJoinRoom: (opts: { roomId?: string; code?: string }) => void;
  onRefreshRooms: () => void;
  onBackToTitle: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  profile,
  connectionStatus,
  rooms,
  error,
  onClearError,
  onUpdateProfile,
  onCreateRoom,
  onJoinRoom,
  onRefreshRooms,
  onBackToTitle,
}) => {
  const [nameInput, setNameInput] = useState(profile.name);
  const [selectedAvatar, setSelectedAvatar] = useState(profile.avatarId);
  const [roomTitle, setRoomTitle] = useState('');
  const [visibility, setVisibility] = useState<RoomVisibility>('public');
  const [joinCode, setJoinCode] = useState('');

  const selectedChar = CHARACTERS[selectedAvatar] || CHARACTERS.cura;
  const isConnected = connectionStatus === 'connected';
  const isLocalOnly = connectionStatus === 'local';
  const canCreateRoom = isConnected || isLocalOnly;

  const commitProfile = (nextName: string, nextAvatar: string) => {
    const clean = nextName.trim().slice(0, 20) || 'Parroquiano';
    onUpdateProfile(clean, nextAvatar);
  };

  const handleSelectAvatar = (charId: string) => {
    setSelectedAvatar(charId);
    commitProfile(nameInput, charId);
  };

  const handleCreate = (autoStartSolo: boolean) => {
    commitProfile(nameInput, selectedAvatar);
    onCreateRoom({
      title: roomTitle.trim() || undefined,
      visibility: autoStartSolo ? 'private' : visibility,
      autoStartSolo,
    });
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = joinCode.trim().toUpperCase();
    if (!cleaned) return;
    commitProfile(nameInput, selectedAvatar);
    onJoinRoom({ code: cleaned });
  };

  return (
    <div className="w-full h-full flex flex-col bg-stone-950 text-stone-100 overflow-hidden">
      {/* Header */}
      <header className="px-4 py-2.5 border-b border-stone-800 bg-stone-900/95 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackToTitle}
            className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-xs font-bold text-stone-200 whitespace-nowrap cursor-pointer active:scale-95 transition-transform"
          >
            ◀ Portada
          </button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-black font-serif-vintage text-amber-300 truncate">
              Sala de Espera · Bar El Madroño
            </h1>
            <p className="text-[11px] text-stone-400 truncate">
              Elige tu nombre y avatar. Juega solo con IA o forma pareja con amigos.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              isConnected
                ? 'bg-emerald-400'
                : isLocalOnly
                ? 'bg-sky-400'
                : 'bg-amber-400 animate-pulse'
            }`}
          />
          <span className="text-xs font-semibold text-stone-300 whitespace-nowrap hidden sm:inline">
            {isConnected
              ? 'Taberna online'
              : isLocalOnly
              ? 'Modo Solo IA (sin WS)'
              : 'Conectando...'}
          </span>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-3 px-3.5 py-2 rounded-xl bg-rose-950/90 border border-rose-500/70 text-rose-100 text-xs font-semibold flex items-center justify-between gap-2 shrink-0">
          <span>{error}</span>
          <button
            type="button"
            onClick={onClearError}
            className="text-rose-300 hover:text-white font-black px-1.5 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: Player Identity & Avatar */}
          <section className="lg:col-span-5 bg-stone-900/90 border border-stone-800 rounded-2xl p-4 flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-black font-serif-vintage text-amber-300 uppercase tracking-wide">
                1. Tu Ficha de Parroquiano
              </h2>
              <p className="text-xs text-stone-400 mt-0.5">
                Así te verán tus compañeros y rivales en la mesa.
              </p>
            </div>

            {/* Selected Preview + Name Input */}
            <div className="flex items-center gap-3 bg-stone-950/80 border border-stone-800 rounded-xl p-3">
              <img
                src={selectedChar.avatar}
                alt={selectedChar.name}
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-xl object-cover border-2 border-amber-500/80 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">
                  Tu nombre en la mesa
                </label>
                <input
                  type="text"
                  value={nameInput}
                  maxLength={20}
                  onChange={(e) => setNameInput(e.target.value)}
                  onBlur={() => commitProfile(nameInput, selectedAvatar)}
                  placeholder="Ej: Don Julián"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-stone-900 border border-stone-700 focus:border-amber-400 focus:outline-none text-sm font-bold text-stone-100"
                />
                <span className="text-[11px] text-amber-300/90 block mt-1 truncate">
                  Avatar: {selectedChar.name} · {selectedChar.title}
                </span>
              </div>
            </div>

            {/* Avatar Grid */}
            <div>
              <span className="block text-[11px] font-bold text-stone-300 mb-2">
                Elige tu personaje castizo:
              </span>
              <div className="grid grid-cols-4 gap-2">
                {PLAYABLE_CHARACTER_IDS.map((charId) => {
                  const char = CHARACTERS[charId];
                  const isActive = selectedAvatar === charId;
                  return (
                    <button
                      key={charId}
                      type="button"
                      onClick={() => handleSelectAvatar(charId)}
                      className={`p-1.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        isActive
                          ? 'bg-amber-950/60 border-amber-400 ring-1 ring-amber-400/60'
                          : 'bg-stone-950/70 border-stone-800 hover:border-stone-600'
                      }`}
                    >
                      <img
                        src={char.avatar}
                        alt={char.name}
                        referrerPolicy="no-referrer"
                        className="w-11 h-11 rounded-lg object-cover border border-stone-700"
                      />
                      <span className="text-[10px] font-bold text-stone-200 leading-tight line-clamp-1 w-full">
                        {char.name.replace('Sargento ', 'Sgto. ').replace('Carmen ', '').replace('Conchita ', '')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Create Room Box */}
            <div className="border-t border-stone-800 pt-3 space-y-2.5">
              <h3 className="text-xs font-black font-serif-vintage text-amber-300 uppercase tracking-wide">
                2. Abrir Mesa Nueva
              </h3>
              <input
                type="text"
                value={roomTitle}
                maxLength={36}
                onChange={(e) => setRoomTitle(e.target.value)}
                placeholder={`Mesa de ${nameInput.trim() || 'Parroquiano'}`}
                className="w-full px-3 py-2 rounded-lg bg-stone-950 border border-stone-700 focus:border-amber-400 focus:outline-none text-xs text-stone-100"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVisibility('public')}
                  className={`py-2 px-2 rounded-lg border text-xs font-bold cursor-pointer whitespace-nowrap ${
                    visibility === 'public'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                      : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  Mesa Pública
                </button>
                <button
                  type="button"
                  onClick={() => setVisibility('private')}
                  className={`py-2 px-2 rounded-lg border text-xs font-bold cursor-pointer whitespace-nowrap ${
                    visibility === 'private'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                      : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  Privada (Código)
                </button>
              </div>
              <button
                type="button"
                disabled={!canCreateRoom}
                onClick={() => handleCreate(false)}
                className="w-full min-h-[44px] rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 disabled:opacity-50 text-stone-950 font-black text-xs uppercase tracking-wider cursor-pointer active:scale-[0.98] transition-transform whitespace-nowrap"
              >
                {isLocalOnly ? 'Configurar Mesa con Bots IA' : 'Crear Mesa en Sala de Espera'}
              </button>
              <button
                type="button"
                disabled={!canCreateRoom}
                onClick={() => handleCreate(true)}
                className="w-full min-h-[38px] rounded-xl bg-stone-800 hover:bg-stone-700 disabled:opacity-50 border border-stone-700 text-stone-200 font-bold text-xs cursor-pointer whitespace-nowrap"
              >
                Jugar Solo Ahora (1 Humano + 3 Bots IA)
              </button>
            </div>
          </section>

          {/* Right Column: Join by Code & Public Rooms */}
          <section className="lg:col-span-7 bg-stone-900/90 border border-stone-800 rounded-2xl p-4 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-black font-serif-vintage text-amber-300 uppercase tracking-wide">
                  Mesas Abiertas en la Taberna
                </h2>
                <p className="text-xs text-stone-400">
                  Únete a una mesa para ser pareja o rival de otros jugadores.
                </p>
              </div>
              <button
                type="button"
                onClick={onRefreshRooms}
                className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-xs font-bold text-amber-300 cursor-pointer whitespace-nowrap"
              >
                Actualizar
              </button>
            </div>

            {/* Join by Code */}
            <form onSubmit={handleJoinByCode} className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                maxLength={10}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Código de mesa (ej: BAR-7K2M)"
                className="flex-1 px-3 py-2 rounded-xl bg-stone-950 border border-stone-700 focus:border-amber-400 focus:outline-none text-xs font-mono-numbers uppercase text-stone-100"
              />
              <button
                type="submit"
                disabled={!isConnected || !joinCode.trim()}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-stone-950 font-black text-xs uppercase cursor-pointer whitespace-nowrap"
              >
                Entrar
              </button>
            </form>

            {/* Open Public Rooms List */}
            <div className="flex-1 space-y-2.5">
              {isLocalOnly ? (
                <div className="border border-dashed border-sky-700/60 rounded-2xl p-6 text-center bg-sky-950/20 space-y-2">
                  <p className="text-sm font-bold text-sky-200 font-serif-vintage">
                    Despliegue Serverless (Modo Local Activo)
                  </p>
                  <p className="text-xs text-stone-300 max-w-md mx-auto leading-relaxed">
                    Puedes configurar tu nombre, avatar y bots de IA y jugar partidas completas al instante en el navegador.
                  </p>
                  <p className="text-[11px] text-stone-400 max-w-md mx-auto leading-relaxed">
                    Para habilitar mesas en red entre varios dispositivos en Vercel, despliega el servidor WebSocket incluido y añade la variable <code className="text-amber-300 font-mono">VITE_WS_URL</code> en Vercel.
                  </p>
                </div>
              ) : rooms.length === 0 ? (
                <div className="border border-dashed border-stone-800 rounded-2xl p-8 text-center bg-stone-950/40">
                  <p className="text-sm font-bold text-stone-300 font-serif-vintage">
                    No hay otras mesas públicas esperando jugadores ahora mismo.
                  </p>
                  <p className="text-xs text-stone-400 mt-1.5 max-w-md mx-auto">
                    Abre una mesa nueva para esperar a tu pareja o rivales, o pulsa «Jugar Solo Ahora» para empezar inmediatamente contra la IA.
                  </p>
                </div>
              ) : (
                rooms.map((room) => (
                  <div
                    key={room.roomId}
                    className="bg-stone-950/80 border border-stone-800 hover:border-amber-500/50 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                  >
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-amber-200 truncate">
                          {room.title}
                        </span>
                        <span className="text-[11px] font-mono-numbers text-stone-400">
                          {room.code}
                        </span>
                        <span className="text-[11px] font-bold text-emerald-400">
                          {room.humanCount}/4 humanos
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {room.seatsPreview.map((s) => {
                          const c = CHARACTERS[s.avatarId] || CHARACTERS.cura;
                          return (
                            <div
                              key={s.seatIndex}
                              className="flex items-center gap-1.5 bg-stone-900 border border-stone-800 rounded-lg px-2 py-1"
                            >
                              <img
                                src={c.avatar}
                                alt={s.name}
                                referrerPolicy="no-referrer"
                                className="w-4 h-4 rounded object-cover"
                              />
                              <span className="text-[10px] font-semibold text-stone-200 max-w-[76px] truncate">
                                {s.controller === 'human' ? s.name : `${s.name} (IA)`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!isConnected || room.humanCount >= 4}
                      onClick={() => {
                        commitProfile(nameInput, selectedAvatar);
                        onJoinRoom({ roomId: room.roomId });
                      }}
                      className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-stone-950 font-black text-xs uppercase cursor-pointer whitespace-nowrap shrink-0"
                    >
                      {room.humanCount >= 4 ? 'Completa' : 'Sentarse'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
