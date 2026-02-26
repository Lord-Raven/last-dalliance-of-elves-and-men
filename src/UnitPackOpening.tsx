import {ReactElement, useEffect, useMemo, useRef, useState} from "react";
import type {UnitTemplate} from "./Unit";

type PackOpeningPhase = 'tear' | 'edge-flight' | 'reveal' | 'ready';

type UnitPackOpeningProps = {
    templates: ReadonlyArray<UnitTemplate>;
    onComplete: () => void;
};

const SLEEVE_WIDTH = 540;
const SLEEVE_HEIGHT = 340;
const TEAR_SEGMENTS = 18;

export const UnitPackOpening = ({templates, onComplete}: UnitPackOpeningProps): ReactElement => {
    const [phase, setPhase] = useState<PackOpeningPhase>('tear');
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [dragPoint, setDragPoint] = useState<{x: number; y: number}>({x: SLEEVE_WIDTH - 18, y: 20});
    const [sleeveGone, setSleeveGone] = useState<boolean>(false);
    const dragStartRef = useRef<{x: number; y: number} | null>(null);

    useEffect(() => {
        if (phase !== 'edge-flight') {
            return;
        }

        const toRevealTimer = window.setTimeout(() => {
            setPhase('reveal');
        }, 420);

        const sleeveOffTimer = window.setTimeout(() => {
            setSleeveGone(true);
        }, 920);

        return () => {
            window.clearTimeout(toRevealTimer);
            window.clearTimeout(sleeveOffTimer);
        };
    }, [phase]);

    useEffect(() => {
        if (phase !== 'reveal') {
            return;
        }

        const finalRevealDelay = 900 + templates.length * 180;
        const readyTimer = window.setTimeout(() => {
            setPhase('ready');
        }, finalRevealDelay);

        return () => {
            window.clearTimeout(readyTimer);
        };
    }, [phase, templates.length]);

    const tearProgress = useMemo(() => {
        const maxPull = SLEEVE_WIDTH * 0.8;
        const pulled = Math.max(0, (SLEEVE_WIDTH - 18) - dragPoint.x);
        return Math.max(0, Math.min(1, pulled / maxPull));
    }, [dragPoint.x]);

    const canTearOpen = tearProgress > 0.6;

    const topEdgePoints = useMemo(() => {
        const points: Array<{x: number; y: number}> = [];
        const edgeStartX = 20;
        const edgeY = 20;
        const handleX = dragPoint.x;
        const handleY = dragPoint.y;

        for (let index = 0; index <= TEAR_SEGMENTS; index += 1) {
            const t = index / TEAR_SEGMENTS;
            const x = edgeStartX + (handleX - edgeStartX) * t;
            const bendStrength = 16 + tearProgress * 42;
            const bend = Math.sin(t * Math.PI) * bendStrength;
            const y = edgeY + (handleY - edgeY) * t + bend;
            points.push({x, y});
        }

        return points;
    }, [dragPoint, tearProgress]);

    const topEdgePath = useMemo(() => {
        if (topEdgePoints.length === 0) {
            return '';
        }

        const [first, ...rest] = topEdgePoints;
        return `M ${first.x} ${first.y} ${rest.map((point) => `L ${point.x} ${point.y}`).join(' ')}`;
    }, [topEdgePoints]);

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
        if (!isDragging || phase !== 'tear') {
            return;
        }

        const origin = dragStartRef.current;
        if (origin == null) {
            return;
        }

        const deltaX = event.clientX - origin.x;
        const deltaY = event.clientY - origin.y;
        const nextX = Math.max(18, Math.min(SLEEVE_WIDTH - 18, (SLEEVE_WIDTH - 18) + deltaX));
        const nextY = Math.max(10, Math.min(76, 20 + deltaY * 0.42));
        setDragPoint({x: nextX, y: nextY});
    };

    const finishDrag = (): void => {
        if (!isDragging || phase !== 'tear') {
            return;
        }

        setIsDragging(false);

        if (canTearOpen) {
            setPhase('edge-flight');
            return;
        }

        setDragPoint({x: SLEEVE_WIDTH - 18, y: 20});
    };

    const canContinue = phase === 'ready';

    return <div
        role={'button'}
        tabIndex={0}
        aria-label={'Pack opening overlay'}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerLeave={finishDrag}
        onClick={() => {
            if (!canContinue) {
                return;
            }
            onComplete();
        }}
        onKeyDown={(event) => {
            if (!canContinue) {
                return;
            }
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onComplete();
            }
        }}
        style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(circle at 50% 38%, rgba(251, 191, 36, 0.24), rgba(2, 6, 23, 0.92) 62%)',
            zIndex: 40,
            userSelect: 'none',
            cursor: canContinue ? 'pointer' : (phase === 'tear' ? (isDragging ? 'grabbing' : 'default') : 'default'),
        }}
    >
        <div style={{
            position: 'absolute',
            top: 26,
            width: '100%',
            textAlign: 'center',
            color: '#f8fafc',
            fontFamily: 'Inter, Arial, sans-serif',
            letterSpacing: 0.3,
            fontSize: 15,
            fontWeight: 600,
            opacity: 0.94,
            pointerEvents: 'none',
        }}>
            {phase === 'tear' ? 'Drag the foil corner across the edge to tear the pack open.' : null}
            {phase === 'reveal' ? 'New templates discovered...' : null}
            {phase === 'ready' ? 'Pack opened. Click anywhere to add these cards to reserve.' : null}
        </div>

        <div style={{
            width: 860,
            maxWidth: '92vw',
            height: 560,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            perspective: 1200,
        }}>
            <div style={{
                position: 'absolute',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 32,
                width: '100%',
                transformStyle: 'preserve-3d',
            }}>
                {templates.map((template, index) => {
                    const revealShift = phase === 'ready' || phase === 'reveal'
                        ? (index - ((templates.length - 1) / 2)) * 188
                        : 0;
                    const isFlipped = phase === 'ready' || phase === 'reveal';
                    const delay = `${index * 0.16}s`;
                    return <div key={`${template.name}-${index}`} style={{
                        width: 176,
                        height: 266,
                        position: 'absolute',
                        borderRadius: 14,
                        transformStyle: 'preserve-3d',
                        transition: 'transform 660ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 500ms ease',
                        transitionDelay: delay,
                        transform: `translateX(${revealShift}px) rotateY(${isFlipped ? 180 : 0}deg) translateY(${phase === 'tear' ? 26 : 0}px)`,
                        opacity: phase === 'tear' ? 0 : 1,
                    }}>
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: 14,
                            backfaceVisibility: 'hidden',
                            background: 'linear-gradient(145deg, #f1f5f9, #cbd5e1)',
                            border: '2px solid rgba(15, 23, 42, 0.35)',
                            boxShadow: '0 10px 22px rgba(15, 23, 42, 0.36)',
                        }}/>

                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: 14,
                            backfaceVisibility: 'hidden',
                            transform: 'rotateY(180deg)',
                            overflow: 'hidden',
                            border: '2px solid rgba(148, 163, 184, 0.85)',
                            background: 'linear-gradient(160deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.88))',
                            boxShadow: '0 12px 24px rgba(2, 6, 23, 0.46)',
                            color: '#e2e8f0',
                            fontFamily: 'Inter, Arial, sans-serif',
                        }}>
                            <div style={{
                                height: 110,
                                backgroundImage: `url(${template.portraitUrl})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'top center',
                                borderBottom: '1px solid rgba(148, 163, 184, 0.45)',
                            }}/>
                            <div style={{padding: '10px 10px 8px 10px', display: 'flex', flexDirection: 'column', gap: 6}}>
                                <div style={{fontSize: 14, fontWeight: 700, color: '#f8fafc', lineHeight: 1.18}}>{template.name}</div>
                                <div style={{
                                    display: 'inline-flex',
                                    alignSelf: 'flex-start',
                                    padding: '2px 7px',
                                    borderRadius: 999,
                                    border: '1px solid rgba(196, 181, 253, 0.74)',
                                    fontSize: 11,
                                    textTransform: 'uppercase',
                                    letterSpacing: 0.5,
                                    color: '#ddd6fe',
                                }}>{template.type}</div>
                                <div style={{fontSize: 12, color: '#cbd5e1', lineHeight: 1.32}}>{template.flavor}</div>
                                <div style={{marginTop: 'auto', fontSize: 11, color: '#e2e8f0', display: 'flex', justifyContent: 'space-between'}}>
                                    <span>ATK {template.attack}</span>
                                    <span>HP {template.health}</span>
                                    <span>SHD {template.shield}</span>
                                </div>
                            </div>
                        </div>
                    </div>;
                })}
            </div>

            <div style={{
                width: SLEEVE_WIDTH,
                height: SLEEVE_HEIGHT,
                borderRadius: 18,
                position: 'relative',
                transformStyle: 'preserve-3d',
                transition: 'transform 650ms cubic-bezier(0.2, 0.7, 0.2, 1), opacity 500ms ease',
                transform: phase === 'tear'
                    ? 'translateY(0px) rotateZ(0deg)'
                    : (sleeveGone ? 'translateY(460px) rotateZ(510deg) translateX(460px)' : 'translateY(72px) rotateZ(6deg)'),
                opacity: sleeveGone ? 0 : 1,
                pointerEvents: phase === 'tear' ? 'auto' : 'none',
            }}>
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 18,
                    overflow: 'hidden',
                    background: 'linear-gradient(140deg, rgba(250, 204, 21, 0.82), rgba(251, 191, 36, 0.35) 42%, rgba(100, 116, 139, 0.78))',
                    border: '2px solid rgba(252, 211, 77, 0.86)',
                    boxShadow: '0 18px 40px rgba(15, 23, 42, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.22) inset',
                }}>
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'repeating-linear-gradient(128deg, rgba(255, 255, 255, 0.32) 0px, rgba(255, 255, 255, 0.32) 4px, rgba(148, 163, 184, 0.15) 4px, rgba(148, 163, 184, 0.15) 12px)',
                        mixBlendMode: 'screen',
                    }}/>
                </div>

                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 88,
                    overflow: 'visible',
                    transformOrigin: 'right center',
                    transition: 'transform 520ms cubic-bezier(0.2, 0.7, 0.2, 1), opacity 400ms ease',
                    transform: phase === 'edge-flight' ? 'translateX(120vw) rotate(32deg)' : 'translateX(0)',
                    opacity: phase === 'edge-flight' ? 0 : 1,
                }}>
                    <svg width={SLEEVE_WIDTH} height={110} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
                        <path d={topEdgePath} stroke={'rgba(15, 23, 42, 0.78)'} strokeWidth={3.2} fill={'none'} strokeLinejoin={'round'} strokeLinecap={'round'}/>
                        <path d={topEdgePath} stroke={'rgba(250, 204, 21, 0.96)'} strokeWidth={2} fill={'none'} strokeLinejoin={'round'} strokeLinecap={'round'}/>
                    </svg>

                    {phase === 'tear' ? <div
                        onPointerDown={(event) => {
                            dragStartRef.current = {x: event.clientX, y: event.clientY};
                            setIsDragging(true);
                            event.currentTarget.setPointerCapture(event.pointerId);
                        }}
                        style={{
                            position: 'absolute',
                            width: 28,
                            height: 28,
                            borderRadius: 999,
                            border: '2px solid rgba(15, 23, 42, 0.9)',
                            background: canTearOpen ? 'rgba(34, 197, 94, 0.95)' : 'rgba(248, 250, 252, 0.95)',
                            left: dragPoint.x - 14,
                            top: dragPoint.y - 14,
                            boxShadow: '0 6px 12px rgba(2, 6, 23, 0.4)',
                            cursor: 'grab',
                        }}
                    /> : null}
                </div>
            </div>
        </div>
    </div>;
};
