'use client';

import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/* Layout + shared geometry                                            */
/* ------------------------------------------------------------------ */

const INK = '#3b2a20';
const FUR = '#ffffff';
const PINK = '#ffb6c8';
const BROWN = '#6b4226';
const COFFEE = '#7a4a2a';

const MX = -1.15;          // coffee machine x
const BREW_X = -0.48;      // where the bunny stands to use the machine
const HOME_X = 0.8;        // nap spot
const FACE_MACHINE = -Math.PI / 2;
const TRAY = new THREE.Vector3(MX, 0.22, 0.33); // cup spot on the drip tray

const G = {
  sphere: new THREE.SphereGeometry(1, 32, 20),
  capsule: new THREE.CapsuleGeometry(1, 2, 8, 16),
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 32),
  cup: new THREE.CylinderGeometry(0.075, 0.06, 0.14, 32, 1, true),
  cupBase: new THREE.CircleGeometry(0.06, 32),
  handle: new THREE.TorusGeometry(0.04, 0.012, 8, 20, Math.PI),
  smile: new THREE.TorusGeometry(0.035, 0.009, 8, 16, Math.PI),
  // front half of the belly, lower part only = apron
  apron: new THREE.SphereGeometry(1.03, 32, 16, Math.PI / 2 - 1.05, 2.1, 1.05, 1.25),
  capDome: new THREE.SphereGeometry(1.04, 32, 12, 0, Math.PI * 2, 0, 1.05),
};

const damp = THREE.MathUtils.damp;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const GIGGLES = ['Hehe, that tickles! 🐰', 'Boop! 👃', 'Hop hop! 🥕', 'Hey, I’m working here 😄'];

/* Toon mesh with an "ink" outline (inverted hull), to match the old cartoon look */
function Toon({ geo, color, outline = 1.06, castShadow = true, children, ...props }) {
  return (
    <group {...props}>
      <mesh geometry={geo} castShadow={castShadow}>
        <meshToonMaterial color={color} />
      </mesh>
      {outline && (
        <mesh geometry={geo} scale={outline}>
          <meshBasicMaterial color={INK} side={THREE.BackSide} />
        </mesh>
      )}
      {children}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Behaviour: a queue of small steps (walk, press, brew, sip, …)        */
/* ------------------------------------------------------------------ */

const walk = (x) => ({ type: 'walk', x });
const face = (yaw) => ({ type: 'face', yaw });
const wait = (d) => ({ type: 'wait', d });
const say = (text) => ({ type: 'say', text });
const set = (v) => ({ type: 'set', v });
const hop = (n = 1) => ({ type: 'hop', d: n * 0.45 });
const sip = (amount = 0.3) => ({ type: 'sip', d: 1.6, amount });
const place = { type: 'place', d: 0.45 };
const grab = { type: 'grab', d: 0.45 };
const press = { type: 'press', d: 0.7 };
const brew = { type: 'brew', d: 2.4 };
const spin = { type: 'spin', d: 0.8 };
const wave = (d = 1.4) => ({ type: 'wave', d });
// steps decided when they run, not when they are planned
const later = (fn) => ({ type: 'later', fn });

const refill = () => [walk(BREW_X), face(FACE_MACHINE), place, press, brew, grab];
const returnCup = later((s) => (s.cupHeld ? [walk(BREW_X), face(FACE_MACHINE), place] : []));
const goNap = () => [returnCup, walk(HOME_X), face(0), set({ dressed: false }), wait(0.3), set({ sleep: true, peek: false })];
const wakeUp = () => [set({ sleep: false, peek: false }), hop(1)];

const PLANS = {
  idle: () => goNap(),
  starting: () => [...wakeUp(), hop(1), set({ dressed: true }), wait(0.4), ...refill(), walk(0.35), face(0), hop(1)],
  working: () => [],
  stopping: () => [later((s) => (s.cupHeld && s.fill > 0.02 ? [face(0), sip(1)] : [])), spin, hop(2), wave(1.4)],
};

function wander(s) {
  if (s.cupHeld && s.fill < 0.05 && Math.random() < 0.5) return [say('Refill time! ☕'), ...refill(), walk(0.3), face(0)];
  const steps = [walk(rand(-0.05, 1.15)), face(0), wait(rand(1.2, 3))];
  if (s.cupHeld && s.fill > 0.1 && Math.random() < 0.3) steps.push(sip(0.2));
  else if (Math.random() < 0.15) steps.push(hop(1));
  return steps;
}

function initState(mode) {
  const on = mode === 'working' || mode === 'starting';
  return {
    mode, x: HOME_X, yaw: 0, yawT: 0, queue: [], step: null, t: 0, lock: false,
    cupHeld: on, cupK: on ? 1 : 0, fill: on ? 0.8 : 0, hot: on ? 1 : 0,
    sleep: !on, peek: false, dressed: on, dressK: on ? 1 : 0,
    phase: 0, sipK: 0, glow: 0, blink: 2, idleSince: 0,
    armR: 0.1, armL: 0.1, armLz: -0.15, hopY: 0, spinY: 0, sitK: on ? 0 : 1,
  };
}

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */

function Rig() {
  const { camera, size } = useThree();
  useEffect(() => {
    // keep the whole counter in view on narrow (phone) screens
    const aspect = size.width / size.height;
    const halfW = 2.0;
    const dist = Math.max(3.4, halfW / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect));
    camera.position.set(-0.15, 0.35 + dist * 0.22, dist);
    camera.lookAt(-0.15, 0.5, 0);
  }, [camera, size]);
  return null;
}

function World({ mode, drag, onSay, anchorRef, zzzRef }) {
  const s = useRef(null);
  if (!s.current) s.current = initState(mode);
  const mountedAt = useRef(performance.now());
  const { camera, size, gl } = useThree();

  const r = {
    root: useRef(), bunny: useRef(), body: useRef(), head: useRef(), headTop: useRef(), mouthPt: useRef(),
    earL: useRef(), earR: useRef(), armL: useRef(), armR: useRef(), hand: useRef(),
    footL: useRef(), footR: useRef(), eyesOpen: useRef(), eyesShut: useRef(), smile: useRef(), open: useRef(),
    apron: useRef(), cap: useRef(), cup: useRef(), fill: useRef(), steam: useRef(),
    machine: useRef(), button: useRef(), stream: useRef(), needle: useRef(), puff: useRef(),
  };
  const tmp = useRef({ a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3() }).current;

  /* --- react to shift mode changes from the page --- */
  useEffect(() => {
    const st = s.current;
    const prev = st.mode;
    st.mode = mode;
    if (prev === mode) return;
    // page just loaded into an active shift: appear ready, no long intro
    if (prev === 'idle' && mode === 'working' && performance.now() - mountedAt.current < 2500) {
      Object.assign(st, initState('working'), { x: st.x, mode });
      return;
    }
    if (prev === 'starting' && mode === 'working') return; // let the intro finish
    if (prev === 'stopping' && mode === 'idle') { st.queue.push(...PLANS.idle()); return; }
    st.queue = PLANS[mode]();
    st.step = null;
    st.lock = mode === 'starting' || mode === 'stopping';
  }, [mode]);

  /* --- clicks --- */
  const clickOk = (e) => { e.stopPropagation(); return e.delta < 8; };
  const run = (steps) => {
    const st = s.current;
    if (st.lock) { onSay('One sec, I’m on it! 🐇💨'); return; }
    st.queue = st.mode === 'idle' ? [...steps, ...goNap()] : steps;
    st.step = null;
    st.lock = true;
  };

  const pokeBunny = (e) => {
    if (!clickOk(e)) return;
    const st = s.current;
    if (st.lock) { onSay(pick(GIGGLES)); return; }
    if (st.sleep) { st.queue = [set({ peek: true }), say('5 more minutes… 😴'), wait(1.8), set({ peek: false })]; st.step = null; st.lock = true; return; }
    run([say(pick(GIGGLES)), hop(2)]);
  };
  const clickMachine = (e) => {
    if (!clickOk(e)) return;
    s.current.glow = 1;
    const st = s.current;
    run([
      say(st.sleep ? 'Coffee?! 👀' : 'One fresh espresso! ☕'),
      ...(st.sleep ? wakeUp() : []),
      ...refill(), walk(0.3), face(0), sip(0.3),
    ]);
  };
  const clickCup = (e) => {
    if (!clickOk(e)) return;
    const st = s.current;
    if (st.cupHeld) {
      run(st.fill > 0.05 ? [sip(0.3), say('Ahh, perfect ☕')] : [say('Empty! Refill time 🙈'), ...refill(), walk(0.3), face(0)]);
    } else {
      run([
        say('My coffee! ☕'), ...(st.sleep ? wakeUp() : []),
        walk(BREW_X), face(FACE_MACHINE), grab, walk(0.3), face(0),
        later((x) => (x.fill > 0.05 ? [sip(0.3)] : [say('Hmm… empty. Click the machine!')])),
      ]);
    }
  };
  const hover = (on) => () => { gl.domElement.style.cursor = on ? 'pointer' : 'grab'; };

  /* --- one step of behaviour --- */
  function startStep(st, step) {
    st.t = 0;
    if (step.type === 'grab') st.cupHeld = true;
    if (step.type === 'place') st.cupHeld = false;
    if (step.type === 'press') st.glow = 1;
    if (step.type === 'spin') st.spinFrom = st.spinY;
  }

  // returns true when the step is finished
  function runStep(st, step, dt) {
    st.t += dt;
    const k = step.d ? Math.min(1, st.t / step.d) : 1;
    switch (step.type) {
      case 'walk': {
        const dx = step.x - st.x;
        if (Math.abs(dx) < 0.01) { st.x = step.x; return true; }
        st.yawT = Math.sign(dx) * Math.PI / 2;
        if (Math.abs(st.yaw - st.yawT) > 0.6) return false; // turn first
        st.x += Math.sign(dx) * Math.min(Math.abs(dx), 1.1 * dt);
        st.phase += dt * 11;
        return false;
      }
      case 'face':
        st.yawT = step.yaw;
        return Math.abs(st.yaw - step.yaw) < 0.08 || st.t > 0.8;
      case 'brew':
        st.fill = Math.min(1, Math.max(st.fill, k));
        st.hot = 1;
        return k >= 1;
      case 'sip':
        if (k > 0.3 && k < 0.8) st.fill = Math.max(0, st.fill - (step.amount * dt) / (step.d * 0.5));
        return k >= 1;
      case 'spin':
        st.spinY = st.spinFrom + k * Math.PI * 2;
        return k >= 1;
      default:
        return k >= 1;
    }
  }

  function think(st, dt) {
    for (let guard = 0; guard < 20; guard++) {
      if (!st.step) {
        st.step = st.queue.shift() || null;
        if (!st.step) {
          st.lock = false;
          if (st.mode === 'working') { st.queue = wander(st); continue; }
          return;
        }
        const step = st.step;
        if (step.type === 'say') { onSay(step.text); st.step = null; continue; }
        if (step.type === 'set') { Object.assign(st, step.v); st.step = null; continue; }
        if (step.type === 'later') { st.queue.unshift(...step.fn(st)); st.step = null; continue; }
        startStep(st, step);
      }
      if (runStep(st, st.step, dt)) st.step = null;
      return;
    }
  }

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const st = s.current;
    const time = state.clock.elapsedTime;
    think(st, dt);

    const step = st.step?.type;
    const k = st.step?.d ? Math.min(1, st.t / st.step.d) : 0;
    const walking = step === 'walk';
    const sitting = st.sleep && !walking;

    /* targets for this frame */
    let armR = st.cupHeld ? -1.1 : 0.12;
    let armL = 0.12, armLz = -0.15, hopY = 0, sipT = 0, mouthOpen = false;
    if (step === 'press') armR = k < 0.6 ? -1.55 : -1.2;
    if (step === 'grab' || step === 'place') armR = -1.35;
    if (step === 'brew') { armR = -0.2; armL = Math.sin(time * 8) * 0.15; }
    if (step === 'sip') { armR = -2.0; sipT = k > 0.15 && k < 0.85 ? 1 : 0; }
    if (step === 'hop') { hopY = Math.abs(Math.sin((st.t / 0.45) * Math.PI)) * 0.32; mouthOpen = true; }
    if (step === 'spin') { hopY = Math.sin(k * Math.PI) * 0.3; mouthOpen = true; }
    if (step === 'wave') { armLz = -2.5 + Math.sin(time * 14) * 0.35; armL = 0; mouthOpen = true; }
    if (walking) { armL = Math.sin(st.phase) * 0.5; if (!st.cupHeld) armR = -Math.sin(st.phase) * 0.5; }

    st.yaw = damp(st.yaw, st.yawT, 10, dt);
    st.armR = damp(st.armR, armR, 12, dt);
    st.armL = damp(st.armL, armL, 12, dt);
    st.armLz = damp(st.armLz, armLz, 12, dt);
    st.sipK = damp(st.sipK, sipT, 8, dt);
    st.cupK = damp(st.cupK, st.cupHeld ? 1 : 0, 9, dt);
    st.dressK = damp(st.dressK, st.dressed ? 1 : 0, 6, dt);
    st.sitK = damp(st.sitK, sitting ? 1 : 0, 4, dt);
    st.glow = Math.max(0, st.glow - dt * 1.2);
    st.hot = Math.max(0, st.hot - dt * 0.015);
    if (step !== 'spin') st.spinY = damp(st.spinY, Math.round(st.spinY / (Math.PI * 2)) * Math.PI * 2, 6, dt);

    /* bunny */
    const bob = walking ? Math.abs(Math.sin(st.phase)) * 0.05 : 0;
    const breathe = Math.sin(time * (sitting ? 1.8 : 2.6)) * (sitting ? 0.03 : 0.015);
    r.bunny.current.position.x = st.x;
    r.bunny.current.rotation.y = st.yaw + st.spinY;
    const body = r.body.current;
    body.position.y = hopY + bob - st.sitK * 0.1;
    body.scale.set(1 + breathe * 0.5, 1 - st.sitK * 0.06 + breathe, 1 + breathe * 0.5);
    body.rotation.z = walking ? Math.sin(st.phase) * 0.06 : 0;
    body.rotation.x = st.sitK * 0.12;

    const swing = walking ? Math.sin(st.phase) * 0.09 : 0;
    r.footL.current.position.set(-0.15, 0.06 + Math.max(0, swing) * 0.6 + st.sitK * 0.08, 0.06 + swing + st.sitK * 0.14);
    r.footR.current.position.set(0.15, 0.06 + Math.max(0, -swing) * 0.6 + st.sitK * 0.08, 0.06 - swing + st.sitK * 0.14);

    r.armR.current.rotation.set(st.armR, 0, 0.15 - st.sipK * 0.5);
    r.armL.current.rotation.set(st.armL, 0, st.armLz);

    const head = r.head.current;
    head.rotation.x = st.sitK * 0.25 + (step === 'brew' ? -0.15 : 0) - st.sipK * 0.15;
    head.rotation.z = sitting ? Math.sin(time * 0.9) * 0.05 : 0;

    const earWiggle = walking || step === 'hop' || step === 'brew' ? Math.sin(time * 12) * 0.12 : Math.sin(time * 1.5) * 0.04;
    const droop = st.sitK;
    r.earL.current.rotation.set(-droop * 0.5, 0, 0.18 + droop * 0.9 + earWiggle);
    r.earR.current.rotation.set(-droop * 0.5, 0, -0.18 - droop * 0.9 - earWiggle);

    st.blink -= dt;
    if (st.blink < -0.12) st.blink = rand(2, 5);
    const shut = (st.sleep && !st.peek) || st.blink < 0 || st.sipK > 0.6;
    r.eyesOpen.current.visible = !shut;
    r.eyesShut.current.visible = shut;
    r.open.current.visible = mouthOpen;
    r.smile.current.visible = !mouthOpen;

    const d = Math.max(0.001, st.dressK);
    r.apron.current.scale.setScalar(d);
    r.cap.current.scale.setScalar(d);
    r.cap.current.position.y = 0.04 + (1 - st.dressK) * 0.6;

    /* cup: lerp between the tray, the hand and the mouth */
    const root = r.root.current;
    const handPos = r.hand.current.getWorldPosition(tmp.a);
    root.worldToLocal(handPos);
    const mouthPos = r.mouthPt.current.getWorldPosition(tmp.b);
    root.worldToLocal(mouthPos);
    handPos.lerp(mouthPos, st.sipK);
    handPos.y -= 0.07;
    const cup = r.cup.current;
    cup.position.copy(tmp.c.copy(TRAY).lerp(handPos, st.cupK));
    cup.rotation.set(-0.8 * st.sipK, (st.yaw + st.spinY) * st.cupK, 0, 'YXZ');
    r.fill.current.scale.y = Math.max(0.001, st.fill);
    r.fill.current.visible = st.fill > 0.01;
    r.steam.current.children.forEach((p, i) => {
      const t = (time * 0.6 + i / 3) % 1;
      p.position.set(Math.sin(t * 6 + i) * 0.02, 0.16 + t * 0.22, 0);
      p.material.opacity = st.hot * (st.fill > 0.05 ? 1 : 0) * Math.sin(t * Math.PI) * 0.6;
      p.scale.setScalar(0.02 + t * 0.03);
    });

    /* machine */
    const brewing = step === 'brew';
    r.machine.current.position.x = MX + (brewing ? Math.sin(time * 60) * 0.004 : 0);
    r.button.current.material.emissiveIntensity = 0.2 + st.glow * 1.5 + (brewing ? 0.8 : 0);
    r.stream.current.visible = brewing;
    r.stream.current.scale.x = r.stream.current.scale.z = brewing ? 1 + Math.sin(time * 30) * 0.15 : 1;
    r.needle.current.rotation.z = damp(r.needle.current.rotation.z, brewing ? -1.6 : 0.6, 3, dt);
    r.puff.current.children.forEach((p, i) => {
      const t = (time * 0.8 + i / 4) % 1;
      p.position.set(0.18 + Math.sin(t * 5 + i) * 0.03, 1.0 + t * 0.35, -0.05);
      p.material.opacity = brewing ? Math.sin(t * Math.PI) * 0.7 : 0;
      p.scale.setScalar(0.04 + t * 0.06);
    });

    /* drag-to-look, slowly springs back */
    if (!drag.current.down && performance.now() - drag.current.last > 2500) drag.current.target = damp(drag.current.target, 0, 1.5, dt);
    root.rotation.y = damp(root.rotation.y, drag.current.target, 8, dt);

    /* keep the speech bubble + Zzz above the bunny's head */
    const top = r.headTop.current.getWorldPosition(tmp.a).project(camera);
    const anchor = anchorRef.current;
    if (anchor) {
      const half = Math.min(size.width / 2, (anchor.firstChild?.offsetWidth || 140) / 2 + 6);
      const px = Math.min(size.width - half, Math.max(half, ((top.x + 1) / 2) * size.width));
      const py = Math.max(44, ((1 - top.y) / 2) * size.height);
      anchor.style.transform = `translate(${px}px, ${py}px)`;
    }
    if (zzzRef.current) zzzRef.current.style.opacity = st.sleep && !st.peek && st.sitK > 0.8 ? '1' : '0';
  });

  return (
    <group ref={r.root}>
      {/* floor + decor */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[2.3, 64]} />
        <meshToonMaterial color="#f3e3cc" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[HOME_X, 0.004, 0.1]} receiveShadow>
        <circleGeometry args={[0.5, 48]} />
        <meshToonMaterial color="#ffd3dc" />
      </mesh>
      <TipJar position={[1.5, 0, -0.45]} />

      {/* coffee machine */}
      <group ref={r.machine} position={[MX, 0, 0]} onClick={clickMachine} onPointerOver={hover(true)} onPointerOut={hover(false)}>
        <Toon geo={G.box} color="#4a3a32" scale={[0.76, 0.08, 0.56]} position={[0, 0.04, 0]} outline={1.03} />
        <Toon geo={G.box} color="#e8735a" scale={[0.7, 0.86, 0.5]} position={[0, 0.51, 0]} outline={1.03} />
        <Toon geo={G.box} color="#d9d4cf" scale={[0.74, 0.06, 0.54]} position={[0, 0.97, 0]} outline={1.04} />
        <mesh geometry={G.box} scale={[0.46, 0.42, 0.04]} position={[0, 0.43, 0.24]}>
          <meshToonMaterial color="#3b2a20" />
        </mesh>
        <Toon geo={G.box} color="#d9d4cf" scale={[0.42, 0.04, 0.22]} position={[0, 0.2, 0.33]} outline={1.05} />
        <Toon geo={G.cyl} color="#bfb8b1" scale={[0.08, 0.09, 0.08]} position={[0, 0.62, 0.33]} />
        <mesh geometry={G.cyl} scale={[0.02, 0.06, 0.02]} position={[0, 0.555, 0.33]}>
          <meshToonMaterial color="#8a827b" />
        </mesh>
        <mesh ref={r.stream} geometry={G.cyl} scale={[0.012, 0.29, 0.012]} position={[0, 0.38, 0.33]} visible={false}>
          <meshToonMaterial color={COFFEE} />
        </mesh>
        {/* button */}
        <mesh ref={r.button} geometry={G.sphere} scale={0.045} position={[0.24, 0.8, 0.255]}>
          <meshStandardMaterial color="#7fe3a0" emissive="#3cff7a" emissiveIntensity={0.2} />
        </mesh>
        {/* pressure gauge */}
        <group position={[-0.17, 0.8, 0.252]}>
          <Toon geo={G.cyl} color="#fff8ee" scale={[0.075, 0.01, 0.075]} rotation-x={Math.PI / 2} outline={1.12} />
          <group ref={r.needle} position={[0, 0, 0.008]} rotation-z={0.6}>
            <mesh geometry={G.box} scale={[0.008, 0.06, 0.004]} position={[0, 0.025, 0]}>
              <meshBasicMaterial color="#d33" />
            </mesh>
          </group>
        </group>
        {/* cups on top + steam */}
        <Toon geo={G.cyl} color="#fff" scale={[0.05, 0.06, 0.05]} position={[-0.2, 1.03, 0]} />
        <Toon geo={G.cyl} color="#fff" scale={[0.05, 0.06, 0.05]} position={[-0.06, 1.03, 0.05]} />
        <group ref={r.puff}>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} geometry={G.sphere}>
              <meshBasicMaterial color="#fff" transparent opacity={0} depthWrite={false} />
            </mesh>
          ))}
        </group>
      </group>

      {/* cup */}
      <group ref={r.cup} position={TRAY} onClick={clickCup} onPointerOver={hover(true)} onPointerOut={hover(false)}>
        <group position={[0, 0.07, 0]}>
          <mesh geometry={G.cup} castShadow>
            <meshToonMaterial color="#fff" side={THREE.DoubleSide} />
          </mesh>
          <mesh geometry={G.cup} scale={1.08}>
            <meshBasicMaterial color={INK} side={THREE.BackSide} />
          </mesh>
          <mesh geometry={G.cupBase} rotation-x={Math.PI / 2} position={[0, -0.069, 0]}>
            <meshToonMaterial color="#fff" side={THREE.DoubleSide} />
          </mesh>
          <mesh geometry={G.handle} position={[0.075, 0.005, 0]} rotation-z={-Math.PI / 2}>
            <meshToonMaterial color="#fff" />
          </mesh>
        </group>
        {/* bigger invisible hit area so the small cup is easy to tap */}
        <mesh geometry={G.box} scale={[0.28, 0.26, 0.28]} position={[0, 0.1, 0]}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        <group ref={r.fill} position={[0, 0.005, 0]}>
          <mesh geometry={G.cyl} scale={[0.067, 0.12, 0.067]} position={[0, 0.06, 0]}>
            <meshToonMaterial color={COFFEE} />
          </mesh>
        </group>
        <group ref={r.steam}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} geometry={G.sphere}>
              <meshBasicMaterial color="#fff" transparent opacity={0} depthWrite={false} />
            </mesh>
          ))}
        </group>
      </group>

      {/* bunny */}
      <group ref={r.bunny} position={[HOME_X, 0, 0.1]} scale={0.86} onClick={pokeBunny} onPointerOver={hover(true)} onPointerOut={hover(false)}>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, 0]}>
          <circleGeometry args={[0.34, 32]} />
          <meshBasicMaterial color={INK} transparent opacity={0.12} depthWrite={false} />
        </mesh>
        <group ref={r.body}>
          <group ref={r.footL}>
            <Toon geo={G.sphere} color={FUR} scale={[0.12, 0.07, 0.18]} />
          </group>
          <group ref={r.footR}>
            <Toon geo={G.sphere} color={FUR} scale={[0.12, 0.07, 0.18]} />
          </group>

          {/* torso + apron + tail */}
          <group position={[0, 0.42, 0]} scale={[0.32, 0.34, 0.29]}>
            <Toon geo={G.sphere} color={FUR} outline={1.05} />
            <group ref={r.apron}>
              <mesh geometry={G.apron}>
                <meshToonMaterial color={BROWN} side={THREE.DoubleSide} />
              </mesh>
            </group>
          </group>
          <Toon geo={G.sphere} color={FUR} scale={0.1} position={[0, 0.3, -0.29]} />

          {/* arms (pivot at the shoulder) */}
          <group ref={r.armL} position={[-0.27, 0.6, 0.02]}>
            <Toon geo={G.capsule} color={FUR} scale={[0.065, 0.07, 0.065]} position={[0, -0.14, 0]} />
          </group>
          <group ref={r.armR} position={[0.27, 0.6, 0.02]}>
            <Toon geo={G.capsule} color={FUR} scale={[0.065, 0.07, 0.065]} position={[0, -0.14, 0]} />
            <group ref={r.hand} position={[0, -0.28, 0.05]} />
          </group>

          {/* head */}
          <group ref={r.head} position={[0, 0.95, 0]}>
            <Toon geo={G.sphere} color={FUR} scale={[0.3, 0.27, 0.27]} outline={1.05} />
            <group ref={r.headTop} position={[0, 0.62, 0]} />
            <group ref={r.mouthPt} position={[0.02, -0.12, 0.34]} />

            <group ref={r.earL} position={[-0.11, 0.2, -0.02]}>
              <Toon geo={G.capsule} color={FUR} scale={[0.065, 0.11, 0.035]} position={[0, 0.2, 0]} />
              <mesh geometry={G.capsule} scale={[0.032, 0.085, 0.01]} position={[0, 0.2, 0.03]}>
                <meshToonMaterial color={PINK} />
              </mesh>
            </group>
            <group ref={r.earR} position={[0.11, 0.2, -0.02]}>
              <Toon geo={G.capsule} color={FUR} scale={[0.065, 0.11, 0.035]} position={[0, 0.2, 0]} />
              <mesh geometry={G.capsule} scale={[0.032, 0.085, 0.01]} position={[0, 0.2, 0.03]}>
                <meshToonMaterial color={PINK} />
              </mesh>
            </group>

            {/* barista cap */}
            <group ref={r.cap} position={[0, 0.04, 0]}>
              <group scale={[0.3, 0.27, 0.27]}>
                <mesh geometry={G.capDome}>
                  <meshToonMaterial color={BROWN} side={THREE.DoubleSide} />
                </mesh>
              </group>
              <Toon geo={G.box} color="#8a5a3b" scale={[0.26, 0.025, 0.14]} position={[0, 0.13, 0.22]} rotation-x={0.25} outline={1.1} />
            </group>

            {/* face */}
            <group ref={r.eyesOpen}>
              {[-1, 1].map((side) => (
                <group key={side} position={[side * 0.1, 0.03, 0.245]}>
                  <mesh geometry={G.sphere} scale={[0.04, 0.045, 0.03]}>
                    <meshBasicMaterial color={INK} />
                  </mesh>
                  <mesh geometry={G.sphere} scale={0.013} position={[0.012, 0.016, 0.025]}>
                    <meshBasicMaterial color="#fff" />
                  </mesh>
                </group>
              ))}
            </group>
            <group ref={r.eyesShut} visible={false}>
              {[-1, 1].map((side) => (
                <mesh key={side} geometry={G.smile} position={[side * 0.1, 0.03, 0.255]} rotation-z={Math.PI} scale={1.1}>
                  <meshBasicMaterial color={INK} />
                </mesh>
              ))}
            </group>
            {[-1, 1].map((side) => (
              <mesh key={side} geometry={G.sphere} scale={[0.05, 0.03, 0.02]} position={[side * 0.17, -0.05, 0.215]}>
                <meshBasicMaterial color="#ffc9d6" />
              </mesh>
            ))}
            <mesh geometry={G.sphere} scale={[0.035, 0.025, 0.025]} position={[0, -0.04, 0.27]}>
              <meshToonMaterial color="#ff8fab" />
            </mesh>
            <mesh ref={r.smile} geometry={G.smile} position={[0, -0.075, 0.262]} rotation-z={Math.PI}>
              <meshBasicMaterial color={INK} />
            </mesh>
            <mesh ref={r.open} geometry={G.sphere} scale={[0.04, 0.035, 0.02]} position={[0, -0.09, 0.255]} visible={false}>
              <meshBasicMaterial color="#ff6b8b" />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

function TipJar(props) {
  return (
    <group {...props}>
      <mesh position={[0, 0.16, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.13, 0.32, 32, 1, true]} />
        <meshStandardMaterial color="#cfe9ff" transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
      {[[-0.04, 0.02], [0.05, -0.03], [0, 0.05]].map(([x, z], i) => (
        <group key={i} position={[x, 0.22, z]} rotation-z={(i - 1) * 0.25}>
          <Toon geo={G.cyl} color="#ff9a3c" scale={[0.025, 0.24, 0.025]} outline={1.15} />
          <mesh geometry={G.sphere} scale={[0.03, 0.05, 0.03]} position={[0, 0.15, 0]}>
            <meshToonMaterial color="#5cb85c" />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.04, 24]} />
        <meshToonMaterial color="#f2c14e" />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */

export default function BunnyScene({ mode, onSay, anchorRef, zzzRef }) {
  const drag = useRef({ down: false, x: 0, base: 0, target: 0, last: 0 });

  const onPointerDown = (e) => {
    Object.assign(drag.current, { down: true, x: e.clientX, base: drag.current.target });
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d.down) return;
    d.target = Math.max(-0.8, Math.min(0.8, d.base + (e.clientX - d.x) * 0.008));
    d.last = performance.now();
  };
  const onPointerUp = () => { drag.current.down = false; drag.current.last = performance.now(); };

  return (
    <div
      className="bunny-canvas"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 32, near: 0.1, far: 50 }} gl={{ antialias: true, alpha: true }}>
        <Rig />
        <hemisphereLight args={['#fff6ea', '#c9a78a', 1.1]} />
        <directionalLight
          position={[2, 4, 3]}
          intensity={1.6}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-2.5}
          shadow-camera-right={2.5}
          shadow-camera-top={2.5}
          shadow-camera-bottom={-2.5}
        />
        <World mode={mode} drag={drag} onSay={onSay} anchorRef={anchorRef} zzzRef={zzzRef} />
      </Canvas>
    </div>
  );
}
