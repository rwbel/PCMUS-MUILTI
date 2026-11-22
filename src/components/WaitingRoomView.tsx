/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * WaitingRoomView.tsx - Mesa de espera multijugador: elección de sillas (pareja/rival), bots IA y chat
 */

import React, { useEffect, useRef, useState } from 'react';
import { CHARACTERS, PLAYABLE_CHARACTER_IDS } from '../utils/characters';
import { LobbySeat, PlayerProfile, RoomLobbyView, SeatIndex } from '../types/multiplayer';

interface WaitingRoomViewProps {
  lobby: RoomLobbyView;
  profile: PlayerProfile;
  error: string | null;
  onClearError: () => void;
  onClaimSeat: (seatIndex: SeatIndex) => void;
  onConfigureSeat: (
    seatIndex: SeatIndex,
    opts: { avatarId?: string; allowHumanJoin?: boolean; setBot?: boolean }
  ) => void;
  onToggleReady: () => void;
  onSendChat: (text: string) => void;
  onStartGame: () => void;
  onLeaveRoom: () => void;
}

const QUICK_CHAT_PHRASES = [
  '¡Buenas tardes, parroquianos!',
  '¿Echamos una de Mus?',
  'Cámbiate enfrente y hacemos pareja',
  '¡Listo para repartir!',
];

export const WaitingRoomView: React.FC<WaitingRoomViewProps> = ({
  lobby,
  profile,
  error,
  onClearError,
  onClaimSeat,
  onConfigureSeat,
  onToggleReady,
  onSendChat,
  onStartGame,
  onLeaveRoom,
}) => {
  const [chatText, setChatText] = useState('');
  const [copied, setCopied] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const isHost = lobby.hostPlayerId === profile.clientId;
  const mySeat = lobby.seats.find((s) => s.playerId === profile.clientId) || null;
  const humanSeats = lobby.seats.filter((s) => s.controller === 'human');
  const unreadyGuests = humanSeats.filter(
    (s) => s.connected && !s.isHost && !s.ready
  );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lobby.chat.length]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(lobby.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failures in restricted frames
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = chatText.trim();
    if (!cleaned) return;
    onSendChat(cleaned);
    setChatText('');
  };

  const renderSeatCard = (seat: LobbySeat, positionHint: string) => {
    const char = CHARACTERS[seat.avatarId] || CHARACTERS.cura;
    const isMe = seat.playerId === profile.clientId;
    const isTeam1 = seat.team === 1;
    const isBot = seat.controller === 'bot';

    return (
      <div
        key={seat.seatIndex}
        className={`rounded-2xl border p-3 flex flex-col gap-2.5 transition-colors ${
          isMe
            ? 'bg-amber-950/40 border-amber-400'
            : isTeam1
            ? 'bg-stone-900/95 border-amber-700/50'
            : 'bg-stone-900/95 border-rose-800/50'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={char.avatar}
              alt={seat.name}
              referrerPolicy="no-referrer"
              className="w-11 h-11 rounded-xl object-cover border border-stone-700 shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-black text-stone-100 truncate">
                  {seat.name}
                </span>
                {isMe && (
                  <span className="text-[10px] font-black text-amber-300">(Tú)</span>
                )}
                {seat.isHost && (
                  <span className="text-[10px] font-bold text-emerald-400">Anfitrión</span>
                )}
              </div>
              <span className="text-[11px] text-stone-400 block truncate">
                {positionHint} · {isBot ? `Bot IA (${char.name})` : seat.connected ? 'Jugador humano' : 'Reconectando...'}
              </span>
            </div>
          </div>

          <span
            className={`text-[10px] font-bold shrink-0 ${
              isBot
                ? 'text-stone-400'
                : seat.ready
                ? 'text-emerald-400'
                : 'text-amber-300'
            }`}
          >
            {isBot ? 'IA Lista' : seat.ready ? 'Listo' : 'Esperando'}
          </span>
        </div>

        {/* Seat Actions */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-stone-800/80">
          {!isMe && isBot && (
            <button
              type="button"
              onClick={() => onClaimSeat(seat.seatIndex)}
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-200 text-[11px] font-bold cursor-pointer whitespace-nowrap"
            >
              Sentarme aquí
            </button>
          )}

          {isHost && isBot && (
            <>
              <select
                value={seat.avatarId}
                onChange={(e) => onConfigureSeat(seat.seatIndex, { avatarId: e.target.value })}
                aria-label={`Personaje IA silla ${seat.seatIndex + 1}`}
                className="flex-1 min-w-[120px] px-2 py-1 rounded-lg bg-stone-950 border border-stone-700 text-[11px] font-semibold text-stone-200 focus:border-amber-400 focus:outline-none"
              >
                {PLAYABLE_CHARACTER_IDS.map((id) => (
                  <option key={id} value={id}>
                    IA: {CHARACTERS[id].name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  onConfigureSeat(seat.seatIndex, { allowHumanJoin: !seat.allowHumanJoin })
                }
                className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-[10px] font-bold text-stone-300 cursor-pointer whitespace-nowrap"
                title="Permitir o bloquear que entren otros humanos en esta silla"
              >
                {seat.allowHumanJoin ? 'Abierta a humanos' : 'Solo Bot IA'}
              </button>
            </>
          )}

          {isHost && !isBot && !isMe && (
            <button
              type="button"
              onClick={() => onConfigureSeat(seat.seatIndex, { setBot: true })}
              className="px-2 py-1 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-700/60 text-rose-200 text-[10px] font-bold cursor-pointer whitespace-nowrap"
            >
              Pasar a Bot IA
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col bg-stone-950 text-stone-100 overflow-hidden">
      {/* Header */}
      <header className="px-4 py-2.5 border-b border-stone-800 bg-stone-900/95 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onLeaveRoom}
            className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-xs font-bold text-stone-200 cursor-pointer whitespace-nowrap"
          >
            ◀ Salir de la Mesa
          </button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-black font-serif-vintage text-amber-300 truncate">
              {lobby.title}
            </h1>
            <p className="text-[11px] text-stone-400">
              {lobby.visibility === 'public' ? 'Mesa Pública' : 'Mesa Privada'} · {humanSeats.length}/4 humanos · {4 - humanSeats.length} IA
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopyCode}
          className="px-3 py-1.5 rounded-xl bg-stone-950 hover:bg-stone-800 border border-amber-500/50 text-amber-300 font-mono-numbers text-xs font-bold cursor-pointer whitespace-nowrap"
        >
          {copied ? 'Código copiado' : `Código: ${lobby.code}`}
        </button>
      </header>

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
          {/* Left: 4-Seat Teams Layout */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-3 text-xs text-stone-300 flex flex-wrap items-center justify-between gap-2">
              <span>
                Los jugadores sentados frente a frente (<strong className="text-amber-300">Sur + Norte</strong> o <strong className="text-rose-300">Este + Oeste</strong>) juegan como pareja.
              </span>
              <span className="text-[11px] text-stone-400">
                Las sillas libres juegan automáticamente con IA.
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pareja 1 */}
              <div className="space-y-2.5 bg-stone-900/40 border border-amber-700/40 rounded-2xl p-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-black uppercase tracking-wider text-amber-300 font-serif-vintage">
                    Pareja A (Sur y Norte)
                  </h2>
                  <span className="text-[11px] text-stone-400">Compañeros</span>
                </div>
                {renderSeatCard(lobby.seats[0], 'Silla Sur')}
                {renderSeatCard(lobby.seats[2], 'Silla Norte (Compañero)')}
              </div>

              {/* Pareja 2 */}
              <div className="space-y-2.5 bg-stone-900/40 border border-rose-800/40 rounded-2xl p-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-black uppercase tracking-wider text-rose-300 font-serif-vintage">
                    Pareja B (Este y Oeste)
                  </h2>
                  <span className="text-[11px] text-stone-400">Rivales de Pareja A</span>
                </div>
                {renderSeatCard(lobby.seats[1], 'Silla Este')}
                {renderSeatCard(lobby.seats[3], 'Silla Oeste')}
              </div>
            </div>
          </div>

          {/* Right: Waiting Room Chat & Start CTA */}
          <div className="lg:col-span-4 bg-stone-900/90 border border-stone-800 rounded-2xl p-4 flex flex-col gap-3 min-h-[360px]">
            <h2 className="text-xs font-black font-serif-vintage uppercase tracking-wider text-amber-300">
              Barra y Tertulia
            </h2>

            {/* Chat Feed */}
            <div className="flex-1 min-h-[180px] max-h-[280px] overflow-y-auto space-y-2 pr-1 bg-stone-950/60 border border-stone-800/80 rounded-xl p-2.5">
              {lobby.chat.map((m) => (
                <div key={m.id} className="text-xs leading-snug">
                  <span
                    className={`font-bold ${
                      m.isSystem ? 'text-amber-400' : 'text-emerald-300'
                    }`}
                  >
                    {m.senderName}:{' '}
                  </span>
                  <span className={m.isSystem ? 'text-stone-400 italic' : 'text-stone-200'}>
                    {m.text}
                  </span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Quick phrases */}
            <div className="flex flex-wrap gap-1.5">
              {QUICK_CHAT_PHRASES.map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  onClick={() => onSendChat(phrase)}
                  className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-[10px] font-semibold text-stone-300 cursor-pointer"
                >
                  {phrase}
                </button>
              ))}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleChatSubmit} className="flex gap-1.5">
              <input
                type="text"
                value={chatText}
                maxLength={220}
                onChange={(e) => setChatText(e.target.value)}
                placeholder="Di algo en la sala..."
                className="flex-1 px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-700 focus:border-amber-400 focus:outline-none text-xs text-stone-100"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-600 text-xs font-bold text-amber-300 cursor-pointer whitespace-nowrap"
              >
                Enviar
              </button>
            </form>

            {/* Ready / Start Match CTA */}
            <div className="pt-2 border-t border-stone-800">
              {isHost ? (
                <button
                  type="button"
                  disabled={unreadyGuests.length > 0}
                  onClick={onStartGame}
                  className="w-full min-h-[48px] rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 disabled:opacity-50 text-stone-950 font-black text-sm uppercase tracking-wider cursor-pointer active:scale-[0.98] transition-transform whitespace-nowrap"
                >
                  {unreadyGuests.length > 0
                    ? `Esperando (${unreadyGuests.length} sin listo)`
                    : '¡Echar la Partida!'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onToggleReady}
                  className={`w-full min-h-[48px] rounded-xl font-black text-sm uppercase tracking-wider cursor-pointer border transition-colors whitespace-nowrap ${
                    mySeat?.ready
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 hover:bg-emerald-500/30'
                      : 'bg-amber-400 border-amber-300 text-stone-950 hover:bg-amber-300'
                  }`}
                >
                  {mySeat?.ready ? 'Listo (Esperando al anfitrión)' : 'Marcar Estoy Listo'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
