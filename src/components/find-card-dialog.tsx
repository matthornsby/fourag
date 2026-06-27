'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { XCloseIcon } from "@/components/icons/x-close";
import { FindCardContent } from "@/components/find-card-content";
import { markerRotation } from "@/lib/marker-rotation";
import type { Find, Clover } from "@/types";

type FindWithClovers = Find & { clovers: Clover[] };

interface Props {
  /** Full ordered list of finds (newest-first). Newest sits on the left, oldest on the right. */
  finds: FindWithClovers[];
  /** Id of the find to centre. null → dialog closed. */
  activeId: string | null;
  userId?: string;
  username?: string;
  onClose: () => void;
  /** Called when the user navigates to a different find inside the carousel (for URL + meta). */
  onNavigate?: (find: FindWithClovers) => void;
  sourceRect?: DOMRect | null;
  getTargetRect?: () => DOMRect | null;
  imperativeCloseRef?: React.MutableRefObject<(() => void) | null>;
  adminControls?: React.ReactNode;
  /** Known orientations by find id (from the calendar) to render the right layout immediately. */
  orientations?: Record<string, 'landscape' | 'portrait'>;
}

const ANIM_MS = 320;
const EASING = 'cubic-bezier(0.32,0.72,0,1)';
// Wheel delta (px) that equals one full card step. Lower = more responsive.
const WHEEL_DISTANCE = 200;
// Idle time after the last wheel/touch move before snapping to the nearest card.
const SNAP_IDLE_MS = 90;
// Gap kept above/below a too-tall card at the scroll extremes (room for its shadow).
const VMARGIN = 20;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function FindCardDialog({
  finds, activeId, userId, username, onClose, onNavigate,
  sourceRect, getTargetRect, imperativeCloseRef, adminControls, orientations,
}: Props) {
  // Mirror activeId locally so the carousel survives the close animation.
  const [currentId, setCurrentId] = useState<string | null>(activeId);
  // The card we've come to rest on. Only this card mounts its map, so fast
  // fly-throughs never spin up (and tear down mid-load) heavy maplibre instances.
  const [settledId, setSettledId] = useState<string | null>(null);
  const [theme, setTheme] = useState<string | undefined>(undefined);

  const indexById = useMemo(() => {
    const m = new Map<string, number>();
    finds.forEach((f, i) => m.set(f.id, i));
    return m;
  }, [finds]);

  const activeIndex = currentId !== null ? (indexById.get(currentId) ?? 0) : 0;

  const viewportRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const positionRef = useRef(activeIndex);          // continuous carousel position (float)
  const vfracRef = useRef(0);                         // active card's vertical read position: 0 top … 1 bottom
  const rafRef = useRef(0);
  const tweeningRef = useRef(false);
  const animatingCloseRef = useRef(false);
  const pendingFlipRef = useRef(false);

  // Track theme for the active card's map.
  useEffect(() => {
    const read = () => setTheme(document.documentElement.dataset.theme);
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  // Horizontal spacing between cards. Larger pushes the neighbours further toward the
  // edges so only a sliver peeks — enough to signal order without distracting.
  const step = () => (typeof window !== 'undefined' ? Math.min(window.innerWidth * 0.66, 820) : 640);

  // The `.find-card` element inside a slide (the thing that may overhang the window).
  const cardEl = (slide?: HTMLElement | null) =>
    (slide?.querySelector('.find-card') as HTMLElement | null) ?? null;

  // How far a card can pan up or down (px) before it's flush with the window edge
  // (with a small margin). 0 → the card fits and doesn't pan.
  const overhang = (card: HTMLElement | null) => {
    if (!card) return 0;
    const avail = window.innerHeight - 2 * VMARGIN;
    return Math.max(0, (card.offsetHeight - avail) / 2);
  };

  // vy for a card from a read fraction: 0 → +overhang (top-aligned), 1 → −overhang
  // (bottom-aligned). Top-aligning *every* overhanging card (not just the active one)
  // means active↔neighbour transitions during navigation don't change --vy → no jump.
  const vyFor = (card: HTMLElement | null, frac: number) => overhang(card) * (1 - 2 * frac);

  // Publish the slide's position as CSS custom properties; the visual treatment
  // (translate/scale/rotate/blur + scrim dim) lives in globals.css so it can be
  // tweaked there. `--rel` is the signed offset from centre, `--ar` its clamped
  // magnitude (0 centred → 1 edge), `--dir` the side (-1 newer/left, +1 older/right).
  // `--vy` top-aligns an overhanging card; only the active card pans (vfrac).
  const layoutOne = (el: HTMLDivElement, idx: number) => {
    const rel = idx - positionRef.current;
    const ar = Math.min(Math.abs(rel), 1);
    el.style.setProperty('--rel', String(rel));
    el.style.setProperty('--ar', String(ar));
    el.style.setProperty('--dir', String(clamp(rel, -1, 1)));
    const frac = el.dataset.findId === currentId ? vfracRef.current : 0;
    el.style.setProperty('--vy', `${vyFor(cardEl(el), frac)}px`);
    el.style.zIndex = String(100 - Math.round(Math.abs(rel) * 10));
    // The centred card handles input on its own content (links, map, edit button).
    // Neighbours stay clickable too, but as a single target: a click anywhere on one
    // navigates to it, so its inner content is made transparent to pointer events and
    // the slide wrapper captures the click (see onSlideClick). Far-off slides (|rel| ≥
    // 1.5) ignore input so the backdrop behind them still closes the dialog.
    const isCentre = Math.abs(rel) < 0.5;
    el.style.pointerEvents = Math.abs(rel) < 1.5 ? 'auto' : 'none';
    el.style.cursor = isCentre ? '' : 'pointer';
    el.classList.toggle('is-neighbour', !isCentre);
    const card = cardEl(el);
    if (card) card.style.pointerEvents = isCentre ? 'auto' : 'none';
  };

  const layoutAll = () => {
    viewportRef.current?.style.setProperty('--card-step', `${step()}px`);
    slideRefs.current.forEach((el) => {
      const idx = indexById.get(el.dataset.findId ?? '');
      if (idx != null) layoutOne(el, idx);
    });
  };

  const registerSlide = (el: HTMLDivElement | null, id: string) => {
    if (el) {
      el.dataset.findId = id;
      slideRefs.current.set(id, el);
      const idx = indexById.get(id);
      // Place immediately so freshly-mounted slides never flash at centre.
      if (idx != null && !pendingFlipRef.current) layoutOne(el, idx);
    } else {
      slideRefs.current.delete(id);
    }
  };

  const animateTo = (target: number) => {
    cancelAnimationFrame(rafRef.current);
    const start = positionRef.current;
    if (Math.abs(target - start) < 0.001) { positionRef.current = target; layoutAll(); return; }
    let startT = 0; // captured from the first rAF timestamp
    tweeningRef.current = true;
    const tick = (now: number) => {
      if (!startT) startT = now;
      const t = Math.min(1, (now - startT) / ANIM_MS);
      positionRef.current = start + (target - start) * easeOut(t);
      layoutAll();
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        positionRef.current = target;
        tweeningRef.current = false;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  // ── Open / navigate in response to the activeId prop ──────────────────────
  // Mirrors the activeId prop into local state so the carousel survives the close
  // animation; the synchronous setState is intentional (prop → local mirror).
  useEffect(() => {
    if (activeId == null) return; // close is driven by triggerClose
    if (currentId == null) {
      // Opening from the calendar — set position instantly; FLIP runs in the layout effect.
      positionRef.current = indexById.get(activeId) ?? 0;
      pendingFlipRef.current = !!sourceRect;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentId(activeId);
    } else if (activeId !== currentId) {
      // Navigating within the open carousel.
      setCurrentId(activeId);
      animateTo(indexById.get(activeId) ?? 0);
    }
  }, [activeId]);

  // FLIP open: fly the active slide from the clicked calendar card to centre.
  useLayoutEffect(() => {
    if (currentId == null) return;
    const el = slideRefs.current.get(currentId);
    // New active card starts read from the top.
    vfracRef.current = 0;
    layoutAll();
    if (!pendingFlipRef.current) return;
    pendingFlipRef.current = false;
    if (!el || !sourceRect) return;
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    const dx = (sourceRect.left + sourceRect.width / 2) - (r.left + r.width / 2);
    const dy = (sourceRect.top + sourceRect.height / 2) - (r.top + r.height / 2);
    const s = Math.min(sourceRect.width / r.width, 0.6);
    // Override the CSS-var-driven transform with an inline FLIP, then clear it so
    // the stylesheet resumes control once the card reaches rest (the resting
    // transform includes the same translateY(vy), so there's no jump on hand-off).
    el.style.transition = 'none';
    el.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(${s})`;
    el.style.opacity = '0';
    el.getBoundingClientRect();
    el.style.transition = `transform ${ANIM_MS}ms ${EASING}, opacity ${ANIM_MS}ms ease`;
    el.style.transform = 'translate(-50%, -50%)';
    el.style.opacity = '1';
    setTimeout(() => {
      el.style.transition = '';
      el.style.transform = '';
      el.style.opacity = '';
    }, ANIM_MS);
  }, [currentId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.body.style.overflow = currentId ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [currentId]);

  // Mark a card "settled" once it has been centred for a beat — gates map mounting.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!currentId) { setSettledId(null); return; }
    const t = setTimeout(() => setSettledId(currentId), ANIM_MS + 80);
    return () => clearTimeout(t);
  }, [currentId]);

  // Keep the active card's overhang/pan correct as it changes size (e.g. its image
  // loads and the card grows). With the read fraction fixed, re-deriving --vy keeps
  // the card's top pinned in place — no vertical shift while it settles.
  useEffect(() => {
    if (!currentId || typeof ResizeObserver === 'undefined') return;
    const card = cardEl(slideRefs.current.get(currentId));
    if (!card) return;
    const ro = new ResizeObserver(() => layoutAll());
    ro.observe(card);
    return () => ro.disconnect();
  }, [currentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const triggerClose = () => {
    if (animatingCloseRef.current) return;
    animatingCloseRef.current = true;
    cancelAnimationFrame(rafRef.current);

    const el = currentId ? slideRefs.current.get(currentId) : null;
    const bd = backdropRef.current;
    const target = getTargetRect?.();

    onClose();

    if (el && target) {
      const r = el.getBoundingClientRect();
      const dx = (target.left + target.width / 2) - (r.left + r.width / 2);
      const dy = (target.top + target.height / 2) - (r.top + r.height / 2);
      const s = Math.min(target.width / r.width, 0.6);
      const rot = markerRotation(currentId!, 0) * 0.5;
      el.style.transition = `transform ${ANIM_MS}ms ${EASING}, opacity ${Math.round(ANIM_MS * 0.5)}ms ease ${Math.round(ANIM_MS * 0.5)}ms`;
      el.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${s})`;
      el.style.opacity = '0';
    } else if (el) {
      el.style.transition = `opacity ${ANIM_MS}ms ease, transform ${ANIM_MS}ms ease`;
      el.style.opacity = '0';
    }
    // Fade neighbours out.
    slideRefs.current.forEach((node, id) => {
      if (id === currentId) return;
      node.style.transition = `opacity ${ANIM_MS}ms ease`;
      node.style.opacity = '0';
    });
    if (bd) {
      bd.style.transition = `opacity ${ANIM_MS}ms ease`;
      bd.style.opacity = '0';
    }

    setTimeout(() => {
      setCurrentId(null);
      animatingCloseRef.current = false;
    }, ANIM_MS);
  };

  useEffect(() => {
    if (imperativeCloseRef) imperativeCloseRef.current = currentId ? triggerClose : null;
  });

  const navigate = (target: number) => {
    const clamped = clamp(target, 0, finds.length - 1);
    const f = finds[clamped];
    if (!f || f.id === currentId) return;
    onNavigate?.(f);
  };

  // Click a neighbouring (off-centre) card to bring it to the centre, instead of the
  // click falling through to the backdrop and closing the dialog.
  const onSlideClick = (e: React.MouseEvent, id: string) => {
    if (id === currentId || animatingCloseRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const idx = indexById.get(id);
    if (idx != null) navigate(idx);
  };

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentId) return;
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape': triggerClose(); break;
        case 'ArrowRight': case 'PageDown': e.preventDefault(); navigate(activeIndex + 1); break;
        case 'ArrowLeft': case 'PageUp': e.preventDefault(); navigate(activeIndex - 1); break;
        case 'Home': e.preventDefault(); navigate(0); break;
        case 'End': e.preventDefault(); navigate(finds.length - 1); break;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  // ── Wheel + touch on the viewport ───────────────────────────────────────────
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp || !currentId) return;

    const activeSlide = () => (currentId ? slideRefs.current.get(currentId) : null);
    const max = finds.length - 1;
    let snapTimer = 0;

    const applyVy = () =>
      activeSlide()?.style.setProperty('--vy', `${vyFor(cardEl(activeSlide()), vfracRef.current)}px`);

    // Pan a too-tall card vertically (move the whole card up/down through the window).
    // Returns true if it consumed the gesture (i.e. the card had room left to move).
    const panBy = (deltaY: number) => {
      const over = overhang(cardEl(activeSlide()));
      if (over <= 0) return false;
      const next = clamp(vfracRef.current + deltaY / (2 * over), 0, 1);
      if (next === vfracRef.current) return false; // already flush in this direction
      vfracRef.current = next;
      applyVy();
      return true;
    };

    // Limit a single gesture to one card past centre, with a rubber-band beyond that
    // and beyond the list ends — so the window always has a card to reveal.
    const softClamp = (raw: number) => {
      const loB = Math.max(0, activeIndex - 1);
      const hiB = Math.min(max, activeIndex + 1);
      if (raw < loB) return loB + (raw - loB) * 0.3;
      if (raw > hiB) return hiB + (raw - hiB) * 0.3;
      return raw;
    };

    const commitSnap = () => {
      const target = clamp(Math.round(positionRef.current), 0, max);
      if (target === activeIndex) animateTo(target); // settle back to centre
      else navigate(target);
    };

    const onWheel = (e: WheelEvent) => {
      // Use whichever axis dominates so horizontal trackpad swipes (deltaX) page too.
      const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      const atRest = Math.abs(positionRef.current - activeIndex) < 0.001;
      // While centred, a vertical wheel first pans a too-tall card up/down; only
      // once it's flush against the window edge does further scrolling page.
      if (!horizontal && atRest && panBy(e.deltaY)) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      cancelAnimationFrame(rafRef.current);
      const delta = horizontal ? e.deltaX : e.deltaY;
      positionRef.current = softClamp(positionRef.current + delta / WHEEL_DISTANCE);
      layoutAll();
      clearTimeout(snapTimer);
      snapTimer = window.setTimeout(commitSnap, SNAP_IDLE_MS);
    };

    let startX = 0, startY = 0, basePos = 0, baseVfrac = 0, axis: 'x' | 'y' | null = null;
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      startX = t.clientX; startY = t.clientY;
      basePos = positionRef.current; baseVfrac = vfracRef.current; axis = null;
    };
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      const dx = t.clientX - startX, dy = t.clientY - startY;
      if (axis === null) {
        if (Math.abs(dx) > Math.abs(dy) + 4) axis = 'x';
        else if (Math.abs(dy) > Math.abs(dx) + 4) axis = 'y';
        else return;
      }
      if (axis === 'x') {
        // Horizontal swipe pages between cards.
        e.preventDefault();
        cancelAnimationFrame(rafRef.current);
        positionRef.current = softClamp(basePos - dx / step());
        layoutAll();
      } else {
        // Vertical drag pans a too-tall card (drag down → reveal top).
        const over = overhang(cardEl(activeSlide()));
        if (over <= 0) return;
        e.preventDefault();
        vfracRef.current = clamp(baseVfrac - dy / (2 * over), 0, 1);
        applyVy();
      }
    };
    const onTouchEnd = () => {
      if (axis === 'x') commitSnap();
      axis = null;
    };

    vp.addEventListener('wheel', onWheel, { passive: false });
    vp.addEventListener('touchstart', onTouchStart, { passive: true });
    vp.addEventListener('touchmove', onTouchMove, { passive: false });
    vp.addEventListener('touchend', onTouchEnd);
    return () => {
      clearTimeout(snapTimer);
      vp.removeEventListener('wheel', onWheel);
      vp.removeEventListener('touchstart', onTouchStart);
      vp.removeEventListener('touchmove', onTouchMove);
      vp.removeEventListener('touchend', onTouchEnd);
    };
  });

  // Re-layout on resize (step + overhang depend on viewport size).
  useEffect(() => {
    const onResize = () => layoutAll();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  });

  if (currentId == null || finds.length === 0) return null;

  // Render a window of slides around the active card (heavy maps stay scoped to the centre).
  const WINDOW = 2;
  const lo = Math.max(0, activeIndex - WINDOW);
  const hi = Math.min(finds.length - 1, activeIndex + WINDOW);
  const windowFinds = finds.slice(lo, hi + 1);

  return (
    <div ref={viewportRef} className="find-carousel-viewport fixed inset-x-0 top-0 h-[100dvh] z-50 overflow-hidden touch-none">
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="absolute inset-0"
        style={{
          background: 'color-mix(in srgb, var(--color-background) 92%, transparent)',
          animation: `find-backdrop-in ${ANIM_MS}ms ease`,
        }}
        onClick={triggerClose}
      />

      {/* Track */}
      <div className="find-carousel-track absolute inset-0">
        {windowFinds.map((f) => (
          <div
            key={f.id}
            ref={(el) => registerSlide(el, f.id)}
            className="find-carousel-slide"
            onClick={(e) => onSlideClick(e, f.id)}
          >
            <FindCardContent
              find={f}
              userId={userId}
              username={username}
              isActive={f.id === settledId}
              initialOrientation={orientations?.[f.id]}
              theme={theme}
              adminControls={f.id === currentId ? adminControls : undefined}
            />
          </div>
        ))}
      </div>

      {/* Close button — single, fixed to the viewport corner */}
      <XCloseIcon
        onClick={triggerClose}
        size={32}
        strokeWidth={2.08}
        stroke="var(--color-close)"
        fill="color-mix(in srgb, var(--color-close) 25%, var(--color-background) 75%)"
        className="absolute top-3 right-3 z-[200] hover:opacity-80 transition-opacity cursor-pointer drop-shadow-2xl"
        aria-label="Close"
      />
    </div>
  );
}
