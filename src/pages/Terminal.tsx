import { useCallback, useEffect, useRef, useState } from 'react';
import { terminalApi, type TerminalConfig } from '../lib/api';
import { store } from '../lib/storage';
import { playBuzzer, setVolume, unlockAudio } from '../lib/sounds';
import { enqueue, flushQueue, loadQueue, type PendingVote } from '../lib/voteQueue';

/*
 * Terminal für den Bildschirm mit Buzzer-Pult (z. B. Raspberry Pi im Kiosk-Modus).
 * Ablauf: Kopplungscode anzeigen → Admin gibt ihn in der Verwaltung ein → Frage anzeigen.
 * Buzzer senden die Tasten 1 / 2 / 3 (auch A/S/D, Pfeiltasten, Ziffernblock); Tippen geht auch.
 */

const K = {
  token: 'sb.terminal.token',
  pending: 'sb.terminal.pairing',
  config: 'sb.terminal.config',
  sound: 'sb.terminal.sound',
  volume: 'sb.terminal.volume',
};
const LOCK_MS = 2800;
const CONFIG_EVERY_MS = 60_000;
const FLUSH_EVERY_MS = 15_000;

const KEYMAP: Record<string, 0 | 1 | 2> = { '1': 0, '2': 1, '3': 2, a: 0, s: 1, d: 2, ArrowLeft: 0, ArrowDown: 1, ArrowRight: 2 };
const CODEMAP: Record<string, 0 | 1 | 2> = { Numpad1: 0, Numpad2: 1, Numpad3: 2, Digit1: 0, Digit2: 1, Digit3: 2 };
const DEFAULT_LABELS = ['Nicht gut', 'Geht so', 'Gut'];

type Pairing = { code: string; secret: string; expires_at: string };
type Sync = 'ok' | 'wait' | 'err';

function Face({ v }: { v: 0 | 1 | 2 }) {
  const mouth = ['M30 70 Q50 52 70 70', 'M32 66 L68 66', 'M30 60 Q50 80 70 60'][v];
  return (
    <svg className="face" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="44" fill="none" stroke="#fff" strokeWidth="7" />
      <circle cx="36" cy="40" r="6" fill="#fff" /><circle cx="64" cy="40" r="6" fill="#fff" />
      <path d={mouth} fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}
const Arrow = () => (
  <svg className="arrow" viewBox="0 0 40 24" aria-hidden="true">
    <path d="M4 4 L20 20 L36 4" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function Terminal() {
  const [token, setToken] = useState<string | null>(() => store.get<string | null>(K.token, null));
  const [pairing, setPairing] = useState<Pairing | null>(() => store.get<Pairing | null>(K.pending, null));
  const [config, setConfig] = useState<TerminalConfig | null>(() => store.get<TerminalConfig | null>(K.config, null));
  const [pairError, setPairError] = useState<string | null>(null);
  const [sync, setSync] = useState<Sync>('ok');
  const [flash, setFlash] = useState<number | null>(null);
  const [thanks, setThanks] = useState(false);
  const [blurred, setBlurred] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirmUnpair, setConfirmUnpair] = useState(false);
  const [sound, setSound] = useState(() => store.get(K.sound, true));
  const queue = useRef<PendingVote[]>(loadQueue());
  const locked = useRef(false);
  const flushing = useRef(false);

  useEffect(() => { document.title = 'Stimmungsbarometer – Terminal'; setVolume(store.get(K.volume, 0.6)); }, []);

  const resetToPairing = useCallback(() => {
    store.remove(K.token); store.remove(K.config);
    setToken(null); setConfig(null);
  }, []);

  // ---------------------------------------------------------------- Kopplung
  useEffect(() => {
    if (token) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;

    async function start() {
      try {
        const p = await terminalApi.pairStart();
        if (stop) return;
        store.set(K.pending, p); setPairing(p); setPairError(null);
        poll(p);
      } catch (e) {
        setPairError((e as Error).message);
        timer = setTimeout(start, 10_000);
      }
    }
    async function poll(p: Pairing) {
      if (stop) return;
      try {
        const s = await terminalApi.pairStatus(p.secret);
        if (s.status === 'paired') {
          store.set(K.token, p.secret); store.remove(K.pending);
          setPairing(null); setToken(p.secret);
          return;
        }
        if (s.status !== 'pending') { store.remove(K.pending); return start(); }
        setPairError(null);
      } catch (e) {
        setPairError((e as Error).message);
      }
      timer = setTimeout(() => poll(p), 3000);
    }

    const existing = store.get<Pairing | null>(K.pending, null);
    if (existing && new Date(existing.expires_at).getTime() > Date.now() + 30_000) { setPairing(existing); poll(existing); }
    else start();
    return () => { stop = true; clearTimeout(timer); };
  }, [token]);

  // ---------------------------------------------------------------- Konfiguration
  useEffect(() => {
    if (!token) return;
    let stop = false;
    async function load() {
      try {
        const c = await terminalApi.config(token!);
        if (stop) return;
        if (c.status === 'revoked') { resetToPairing(); return; }
        store.set(K.config, c); setConfig(c);
        setSync((s) => (s === 'err' ? (queue.current.length ? 'wait' : 'ok') : s));
      } catch {
        if (!stop) setSync('err'); // letzte bekannte Frage bleibt stehen
      }
    }
    load();
    const t = setInterval(load, CONFIG_EVERY_MS);
    return () => { stop = true; clearInterval(t); };
  }, [token, resetToPairing]);

  // ---------------------------------------------------------------- Stimmen senden
  const flush = useCallback(async () => {
    if (!token || flushing.current || queue.current.length === 0) return;
    flushing.current = true;
    setSync('wait');
    let netError = false;
    const r = await flushQueue(queue.current, async (v) => {
      try {
        const fresh = Date.now() - Date.parse(v.at) < 15_000;
        const res = await terminalApi.vote(token, v.question, v.value, fresh ? undefined : v.at);
        if (res.ok) return 'ok';
        if (res.reason === 'revoked') return 'revoked';
        return 'drop'; // zu schnell, ungültige Frage o. ä.
      } catch {
        netError = true;
        return 'retry';
      }
    });
    queue.current = r.queue;
    flushing.current = false;
    if (r.revoked) { resetToPairing(); return; }
    setSync(netError ? 'err' : r.queue.length ? 'wait' : 'ok');
  }, [token, resetToPairing]);

  useEffect(() => {
    flush();
    const t = setInterval(flush, FLUSH_EVERY_MS);
    window.addEventListener('online', flush);
    return () => { clearInterval(t); window.removeEventListener('online', flush); };
  }, [flush]);

  // ---------------------------------------------------------------- Abstimmen
  const question = config?.status === 'ok' ? config.question ?? null : null;

  const vote = useCallback((v: 0 | 1 | 2) => {
    if (!token || !question || locked.current || menu) return;
    locked.current = true;
    if (sound) playBuzzer(v);
    setFlash(v);
    queue.current = enqueue(queue.current, { question: question.id, value: v, at: new Date().toISOString() });
    flush();
    setTimeout(() => setThanks(true), 250);
    setTimeout(() => { setThanks(false); setFlash(null); locked.current = false; }, LOCK_MS);
  }, [token, question, menu, sound, flush]);

  // Tastatur (Buzzer) und Gamepad
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.repeat || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      const v = e.code in CODEMAP ? CODEMAP[e.code] : KEYMAP[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (v === undefined) return;
      e.preventDefault();
      vote(v);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [vote]);

  useEffect(() => {
    let raf = 0; const prev = [false, false, false];
    const loop = () => {
      try {
        const pad = navigator.getGamepads?.().find((p) => p);
        if (pad) for (let i = 0; i < 3; i++) {
          const on = !!pad.buttons[i]?.pressed;
          if (on && !prev[i]) vote(i as 0 | 1 | 2);
          prev[i] = on;
        }
      } catch { return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [vote]);

  // Fokus: ohne Fokus kommen Tastendrücke nicht an
  useEffect(() => {
    const b = () => setBlurred(true), f = () => setBlurred(false);
    window.addEventListener('blur', b); window.addEventListener('focus', f);
    return () => { window.removeEventListener('blur', b); window.removeEventListener('focus', f); };
  }, []);

  // Versteckter Ausgang: linke obere Ecke 3 Sekunden halten
  const hold = useRef<ReturnType<typeof setTimeout>>();
  const startHold = () => { hold.current = setTimeout(() => { setMenu(true); setConfirmUnpair(false); }, 3000); };
  const endHold = () => clearTimeout(hold.current);

  function fullscreen() {
    try { document.documentElement.requestFullscreen?.().catch(() => {}); } catch { /* nicht verfügbar */ }
  }
  function toggleSound() {
    const s = !sound; setSound(s); store.set(K.sound, s); if (s) { unlockAudio(); playBuzzer(2); }
  }

  const common = { onPointerDown: () => { unlockAudio(); window.focus(); setBlurred(false); } };

  // ---------------------------------------------------------------- Darstellung
  if (!token) {
    const code = pairing?.code;
    return (
      <div className="kiosk pointer" {...common}>
        <div className="khead"><span>Stimmungsbarometer · Terminal einrichten</span><button className="btn small" style={{ background: '#1c2a32', color: '#f2f6f8', borderColor: '#2c3c46' }} onClick={fullscreen}>Vollbild</button></div>
        <div className="pairing">
          <div>
            <p>Kopplungscode</p>
            <div className="bigcode" aria-live="polite">{code ? `${code.slice(0, 3)} ${code.slice(3)}` : '··· ···'}</div>
          </div>
          <p>Melden Sie sich in der Verwaltung an, öffnen Sie <strong>Terminals → Terminal koppeln</strong> und geben Sie diesen Code mit dem Standort ein.</p>
          {pairError && <p style={{ color: '#e3a12a' }}>Keine Verbindung zum Server, neuer Versuch läuft … ({pairError})</p>}
        </div>
        <div />
      </div>
    );
  }

  const labels = question?.labels ?? DEFAULT_LABELS;
  return (
    <div className="kiosk" {...common}>
      <div className="exitzone" onPointerDown={startHold} onPointerUp={endHold} onPointerLeave={endHold} onPointerCancel={endHold} />
      <div className="khead">
        <span>{config?.terminal?.name ?? ''}{config?.organization ? ` · ${config.organization.name}` : ''}</span>
        <span className={`sync ${sync === 'ok' ? '' : sync}`}>
          <b /><span>{sync === 'ok' ? 'verbunden' : sync === 'wait' ? 'wird gespeichert …' : `offline – ${queue.current.length} Antwort${queue.current.length === 1 ? '' : 'en'} warten`}</span>
        </span>
      </div>
      <div className="kq"><h1>{question ? question.text : config ? 'Zurzeit ist keine Frage aktiv.' : 'Verbinde …'}</h1></div>
      <div className={`kbtns${flash != null ? ' dim' : ''}`}>
        {([0, 1, 2] as const).map((v) => (
          <button key={v} className={`kb v${v}${flash === v ? ' flash' : ''}`} onClick={() => vote(v)} aria-label={labels[v]} tabIndex={-1}>
            <Face v={v} /><span className="kl">{labels[v]}</span><Arrow />
          </button>
        ))}
      </div>
      {thanks && <div className="overlay"><div><h2>Danke!</h2><p>Ihre Rückmeldung ist anonym gespeichert.</p></div></div>}
      {blurred && !menu && <div className="warn">Bitte einmal auf den Bildschirm tippen, damit die Buzzer wieder reagieren.</div>}
      {menu && (
        <div className="overlay" style={{ cursor: 'default' }}>
          <div className="menu">
            <h2 style={{ fontSize: 32 }}>Terminal</h2>
            <button className="btn" onClick={fullscreen}>Vollbild</button>
            <button className="btn" onClick={toggleSound}>Ton {sound ? 'ausschalten' : 'einschalten'}</button>
            <button className="btn" onClick={() => window.location.reload()}>Neu laden</button>
            {confirmUnpair
              ? <button className="btn" style={{ color: '#ff8a80' }} onClick={() => { resetToPairing(); setMenu(false); }}>Wirklich entkoppeln (neuer Code nötig)</button>
              : <button className="btn" onClick={() => setConfirmUnpair(true)}>Terminal entkoppeln …</button>}
            <button className="btn" onClick={() => setMenu(false)}>Zurück</button>
          </div>
        </div>
      )}
    </div>
  );
}
