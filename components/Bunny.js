'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';

// three.js only runs in the browser
const BunnyScene = dynamic(() => import('./BunnyScene'), {
  ssr: false,
  loading: () => <div className="bunny-loading" aria-hidden>🐰☕</div>,
});

// mode: 'idle' | 'starting' | 'working' | 'stopping'
export default function Bunny({ mode, message }) {
  const anchorRef = useRef(null);
  const zzzRef = useRef(null);
  const timer = useRef(null);
  const [said, setSaid] = useState(null); // lines from clicking things in the scene

  // a new line from the page wins over click chatter
  useEffect(() => { setSaid(null); }, [message]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const onSay = useCallback((text) => {
    setSaid(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaid(null), 3500);
  }, []);

  const text = said ?? message;

  return (
    <div className={`bunny-stage ${mode}`} aria-label="3D barista bunny. Tap the bunny, the coffee machine or the cup.">
      <BunnyScene mode={mode} onSay={onSay} anchorRef={anchorRef} zzzRef={zzzRef} />

      <div className="bunny-anchor" ref={anchorRef}>
        {text && <div className="bubble" key={text}>{text}</div>}
        <div className="zzz" ref={zzzRef} aria-hidden>
          <span>z</span><span>z</span><span>Z</span>
        </div>
      </div>

      {mode === 'stopping' && (
        <div className="confetti" aria-hidden>
          {['🥕', '🎉', '💶', '✨', '🥕', '💖', '🎉', '💶'].map((c, i) => (
            <span key={i} style={{ left: `${8 + i * 11}%`, animationDelay: `${i * 0.12}s` }}>{c}</span>
          ))}
        </div>
      )}
      <p className="bunny-hint">tap the bunny, machine or cup · drag to look around</p>
    </div>
  );
}
