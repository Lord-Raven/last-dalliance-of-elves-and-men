import {ReactElement, useEffect, useMemo, useRef, useState} from "react";
import {Application, Assets, Container, Graphics, Sprite, Text, TextStyle, TilingSprite, Texture} from "pixi.js";
import {Unit, UnitTemplate} from "./Unit";
import type {Stage} from "./Stage";
import {UnitPackOpening} from "./UnitPackOpening";
import PaidRoundedIcon from '@mui/icons-material/PaidRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import GavelRoundedIcon from '@mui/icons-material/GavelRounded';
import TrackChangesRoundedIcon from '@mui/icons-material/TrackChangesRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';

type Enemy = {
    id: string;
    sprite: Sprite;
    speed: number;
    attack: number;
    attackRange: number;
    cooldown: number;
    hp: number;
    maxHp: number;
    lastHitByDefenderId: string | null;
    healthBarBg: Graphics;
    healthBar: Graphics;
};

type Defender = {
    id: string;
    card: Unit;
    sprite: Sprite;
    hp: number;
    maxHp: number;
    shield: number;
    maxShield: number;
    shieldRechargeTimer: number;
    shieldCircle: Graphics | null;
    shieldBarBg: Graphics | null;
    shieldBar: Graphics | null;
    cooldown: number;
    rangeCircle: Graphics | null;
    rangeCone: Graphics | null;
};

type Effect = {
    graphic: Graphics;
    life: number;
    maxLife: number;
    update?: (progress: number, graphic: Graphics) => void;
};

type BoardApi = {
    placeDefender: (card: Unit, x: number, y: number) => boolean;
    startWave: () => boolean;
    updatePlacementPreview: (card: Unit, x: number, y: number) => void;
    clearPlacementPreview: () => void;
};


const MELEE_RANGE = 88;
const RANGED_CONE_RANGE = 500;
const RANGED_CONE_HALF_ANGLE = 0.28;
const MAGIC_RANGE = 280;
const ENEMY_MAGNET_RADIUS = 220;
const ENEMY_MAGNET_PULL = 0.22;
const ENEMY_MAX_VERTICAL_DRIFT = 0.32;
const DEFENDER_SPRITE_WIDTH = 200;
const DEFENDER_SPRITE_HEIGHT = 300;
const DEFENDER_HALF_WIDTH = DEFENDER_SPRITE_WIDTH / 2;
const DEFENDER_BAR_Y_OFFSET = DEFENDER_SPRITE_HEIGHT + 18;
const KILL_LINE_CHANCE = 0.28;
const VOICE_LINE_MIN_GAP_MS = 1000;
const PACK_SIZE = 3;

const CARD_THEME: Record<Unit['type'], {
    accent: string;
    accentSoft: string;
    attackLabel: string;
    flavor: string;
}> = {
    melee: {
        accent: '#34d399',
        accentSoft: 'rgba(52, 211, 153, 0.2)',
        attackLabel: 'Blade',
        flavor: 'A living bulwark of bark and steel.',
    },
    ranged: {
        accent: '#60a5fa',
        accentSoft: 'rgba(96, 165, 250, 0.2)',
        attackLabel: 'Arrow',
        flavor: 'Wind-guided volleys from the treeline.',
    },
    magic: {
        accent: '#c084fc',
        accentSoft: 'rgba(192, 132, 252, 0.2)',
        attackLabel: 'Arcana',
        flavor: 'Moonlit runes hum with ancient power.',
    },
};

const getAttackIcon = (type: Unit['type']): ReactElement => {
    if (type === 'melee') {
        return <GavelRoundedIcon style={{fontSize: 14}}/>;
    }

    if (type === 'ranged') {
        return <TrackChangesRoundedIcon style={{fontSize: 14}}/>;
    }

    return <AutoFixHighRoundedIcon style={{fontSize: 14}}/>;
};

export const TowerDefenseBoard = ({stage}: {stage: Stage}): ReactElement => {
    const stageRef = useRef<HTMLDivElement>(null);
    const boardApiRef = useRef<BoardApi | null>(null);
    const dragImageRef = useRef<HTMLImageElement | null>(null);
    const [isWaveRunning, setIsWaveRunning] = useState<boolean>(false);
    const [gold, setGold] = useState<number>(14);
    const [hand, setHand] = useState<Unit[]>(() => stage.drawUnitsFromReserve(6));
    const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
    const [statusText, setStatusText] = useState<string>('Drag an elf card onto the field to place a defender.');
    const [packTemplates, setPackTemplates] = useState<UnitTemplate[]>([]);
    const [isOpeningPack, setIsOpeningPack] = useState<boolean>(false);
    const [isGeneratingPack, setIsGeneratingPack] = useState<boolean>(false);
    const activeVoiceAudioRef = useRef<HTMLAudioElement | null>(null);
    const lastVoicePlaybackAtRef = useRef<number>(0);
    const interactionLocked = isWaveRunning || isOpeningPack || isGeneratingPack;

    const playVoiceLine = (lineUrl: string | undefined, chance = 1): void => {
        const sanitizedUrl = (lineUrl ?? '').trim();
        if (!sanitizedUrl) {
            return;
        }

        if (chance < 1 && Math.random() > chance) {
            return;
        }

        const now = Date.now();
        if (now - lastVoicePlaybackAtRef.current < VOICE_LINE_MIN_GAP_MS) {
            return;
        }

        if (activeVoiceAudioRef.current != null) {
            activeVoiceAudioRef.current.pause();
            activeVoiceAudioRef.current = null;
        }

        const audio = new Audio(sanitizedUrl);
        activeVoiceAudioRef.current = audio;
        lastVoicePlaybackAtRef.current = now;
        audio.onended = () => {
            if (activeVoiceAudioRef.current === audio) {
                activeVoiceAudioRef.current = null;
            }
        };
        audio.onerror = () => {
            if (activeVoiceAudioRef.current === audio) {
                activeVoiceAudioRef.current = null;
            }
        };
        void audio.play().catch(() => {
            if (activeVoiceAudioRef.current === audio) {
                activeVoiceAudioRef.current = null;
            }
        });
    };

    const handStyle = useMemo(() => ({
        position: 'absolute' as const,
        left: 0,
        right: 0,
        bottom: 0,
        padding: '12px 14px 14px 14px',
        display: 'flex',
        gap: 10,
        justifyContent: 'center',
        alignItems: 'flex-end',
        transform: interactionLocked ? 'translateY(120%)' : 'translateY(0)',
        transition: 'transform 260ms ease',
        pointerEvents: interactionLocked ? 'none' as const : 'auto' as const,
    }), [interactionLocked]);

    useEffect(() => {
        const refillHand = (): void => {
            setHand((current) => {
                if (isWaveRunning || current.length >= 6) {
                    return current;
                }

                const refill = stage.drawUnitsFromReserve(6 - current.length);
                if (refill.length === 0) {
                    return current;
                }

                return [...current, ...refill];
            });
        };

        const unsubscribe = stage.subscribeReserveUpdates(refillHand);
        refillHand();

        return unsubscribe;
    }, [isWaveRunning, stage]);

    useEffect(() => {
        const stageHost = stageRef.current;
        if (stageHost == null) {
            return;
        }

        const app = new Application();
        let isDestroyed = false;
        let spawnIntervalId: number | null = null;

        const boot = async (): Promise<void> => {
            await app.init({
                resizeTo: stageHost,
                antialias: true,
                resolution: Math.max(2, window.devicePixelRatio || 1),
                autoDensity: true,
                backgroundAlpha: 0,
            });

            if (isDestroyed) {
                app.destroy(true, {children: true});
                return;
            }

            stageHost.appendChild(app.canvas);
            app.canvas.style.imageRendering = 'auto';
            app.canvas.style.setProperty('image-rendering', 'smooth');
            app.canvas.style.setProperty('image-rendering', 'high-quality');

            const world = new Container();
            app.stage.addChild(world);

            const [grassTexture, enemyTexture] = await Promise.all([
                Assets.load('/placeholder/grass-tile.svg') as Promise<Texture>,
                Assets.load('/placeholder/enemy-placeholder.svg') as Promise<Texture>,
            ]);

            const grass = new TilingSprite({
                texture: grassTexture,
                width: app.renderer.width,
                height: app.renderer.height,
            });
            world.addChild(grass);

            const defenderGroundLayer = new Container();
            const defenderLayer = new Container();
            const enemyLayer = new Container();
            const effectLayer = new Container();
            world.addChild(defenderGroundLayer);
            world.addChild(defenderLayer);
            world.addChild(enemyLayer);
            world.addChild(effectLayer);

            const title = new Text({
                text: 'Elven Defense - Round Battle',
                style: new TextStyle({
                    fill: 0xffffff,
                    fontFamily: 'Inter, Arial, sans-serif',
                    fontSize: 27,
                    fontWeight: '700',
                }),
            });
            title.position.set(20, 16);
            world.addChild(title);

            const enemies: Enemy[] = [];
            const defenders: Defender[] = [];
            const effects: Effect[] = [];
            let placementPreview: Graphics | null = null;
            let placementPreviewType: Unit['type'] | null = null;

            const laneFractions = [0.2, 0.35, 0.5, 0.65, 0.8];
            const totalEnemiesInWave = 12;
            let enemiesSpawned = 0;
            let waveInProgress = false;
            let enemyCounter = 0;
            let defenderCounter = 0;

            const getLaneY = (): number => {
                const laneIndex = Math.floor(Math.random() * laneFractions.length);
                return app.renderer.height * laneFractions[laneIndex];
            };

            const damageEnemy = (enemy: Enemy, amount: number, attacker?: Defender): void => {
                enemy.hp = Math.max(0, enemy.hp - amount);
                if (attacker != null) {
                    enemy.lastHitByDefenderId = attacker.id;
                }
            };

            const createArrowEffect = (startX: number, startY: number, endX: number, endY: number): void => {
                const arrow = new Graphics();
                const life = 16;
                effectLayer.addChild(arrow);
                effects.push({
                    graphic: arrow,
                    life,
                    maxLife: life,
                    update: (progress, graphic) => {
                        const clamped = Math.max(0, Math.min(1, progress));
                        const headX = startX + (endX - startX) * clamped;
                        const headY = startY + (endY - startY) * clamped;
                        const tailRatio = Math.max(0, clamped - 0.16);
                        const tailX = startX + (endX - startX) * tailRatio;
                        const tailY = startY + (endY - startY) * tailRatio;
                        const angle = Math.atan2(endY - startY, endX - startX);

                        graphic.clear();
                        graphic.moveTo(tailX, tailY);
                        graphic.lineTo(headX, headY);
                        graphic.stroke({width: 2.6, color: 0xf8fafc, alpha: 0.96});

                        const wing = 6;
                        const back = 9;
                        graphic.moveTo(headX, headY);
                        graphic.lineTo(headX - Math.cos(angle - 0.35) * back, headY - Math.sin(angle - 0.35) * back);
                        graphic.lineTo(headX - Math.cos(angle) * wing, headY - Math.sin(angle) * wing);
                        graphic.lineTo(headX - Math.cos(angle + 0.35) * back, headY - Math.sin(angle + 0.35) * back);
                        graphic.closePath();
                        graphic.fill({color: 0xe2e8f0, alpha: 0.95});
                    },
                });
            };

            const createMeleeEffect = (x: number, y: number, radius: number): void => {
                const slash = new Graphics();
                const life = 12;
                effectLayer.addChild(slash);
                effects.push({
                    graphic: slash,
                    life,
                    maxLife: life,
                    update: (progress, graphic) => {
                        const sweep = progress * Math.PI * 1.75;
                        const slashRadius = radius * 0.62;
                        graphic.clear();

                        graphic.arc(x, y, slashRadius, -0.9 + sweep, -0.18 + sweep);
                        graphic.stroke({width: 4, color: 0x86efac, alpha: 0.95});

                        graphic.arc(x, y, slashRadius * 0.72, 0.8 + sweep, 1.4 + sweep);
                        graphic.stroke({width: 3, color: 0xbbf7d0, alpha: 0.88});

                        const flashRadius = 14 + progress * 22;
                        graphic.circle(x, y, flashRadius);
                        graphic.fill({color: 0xdcfce7, alpha: 0.22 * (1 - progress)});
                    },
                });
            };

            const createMagicBoltEffect = (points: Array<{x: number; y: number}>): void => {
                if (points.length < 2) {
                    return;
                }

                const bolt = new Graphics();
                const life = 20;
                effectLayer.addChild(bolt);
                effects.push({
                    graphic: bolt,
                    life,
                    maxLife: life,
                    update: (progress, graphic) => {
                        const clamped = Math.max(0, Math.min(1, progress));
                        const visibleSegments = Math.max(1, Math.ceil(clamped * (points.length - 1)));
                        graphic.clear();

                        for (let segment = 0; segment < visibleSegments; segment += 1) {
                            const from = points[segment];
                            const to = points[segment + 1];
                            if (to == null) {
                                continue;
                            }

                            const jitter = (1 - clamped) * 8;
                            const midX = (from.x + to.x) / 2 + (Math.random() - 0.5) * jitter;
                            const midY = (from.y + to.y) / 2 + (Math.random() - 0.5) * jitter;

                            graphic.moveTo(from.x, from.y);
                            graphic.lineTo(midX, midY);
                            graphic.lineTo(to.x, to.y);
                            graphic.stroke({width: 3.2, color: 0xc084fc, alpha: 0.92});

                            graphic.moveTo(from.x, from.y);
                            graphic.lineTo(midX, midY);
                            graphic.lineTo(to.x, to.y);
                            graphic.stroke({width: 1.2, color: 0xffffff, alpha: 0.95});
                        }
                    },
                });
            };

            const createMagicImpactRadiusEffect = (x: number, y: number, radius: number): void => {
                const impact = new Graphics();
                const life = 14;
                effectLayer.addChild(impact);
                effects.push({
                    graphic: impact,
                    life,
                    maxLife: life,
                    update: (progress, graphic) => {
                        const clamped = Math.max(0, Math.min(1, progress));
                        const currentRadius = radius * (0.55 + clamped * 0.65);
                        const innerRadius = currentRadius * 0.62;

                        graphic.clear();
                        graphic.circle(x, y, currentRadius);
                        graphic.stroke({width: 3, color: 0xe9d5ff, alpha: 0.92 * (1 - clamped * 0.75)});

                        graphic.circle(x, y, innerRadius);
                        graphic.fill({color: 0xc084fc, alpha: 0.24 * (1 - clamped)});
                    },
                });
            };

            const createEnemyStrikeEffect = (x: number, y: number): void => {
                const strike = new Graphics();
                strike.moveTo(x - 12, y - 12);
                strike.lineTo(x + 12, y + 12);
                strike.moveTo(x + 12, y - 12);
                strike.lineTo(x - 12, y + 12);
                strike.stroke({width: 3, color: 0xfca5a5, alpha: 0.95});
                effectLayer.addChild(strike);
                effects.push({graphic: strike, life: 7, maxLife: 7});
            };

            const spawnEnemy = (): void => {
                const sprite = new Sprite(enemyTexture);
                sprite.anchor.set(0.5);
                sprite.width = 56;
                sprite.height = 56;
                sprite.tint = 0xef4444;
                sprite.x = app.renderer.width + 48 + Math.random() * 120;
                sprite.y = getLaneY();

                const healthBarBg = new Graphics();
                const healthBar = new Graphics();

                enemyLayer.addChild(sprite);
                enemyLayer.addChild(healthBarBg);
                enemyLayer.addChild(healthBar);

                enemies.push({
                    id: `enemy-${enemyCounter++}`,
                    sprite,
                    speed: 0.72 + Math.random() * 0.52,
                    attack: 10,
                    attackRange: 60,
                    cooldown: 0,
                    hp: 110,
                    maxHp: 110,
                    lastHitByDefenderId: null,
                    healthBarBg,
                    healthBar,
                });
            };

            const updateEnemyBar = (enemy: Enemy): void => {
                const width = 44;
                const height = 5;
                const ratio = Math.max(0, enemy.hp / enemy.maxHp);

                enemy.healthBarBg.clear();
                enemy.healthBarBg.rect(enemy.sprite.x - width / 2, enemy.sprite.y - 40, width, height);
                enemy.healthBarBg.fill({color: 0x111827, alpha: 0.75});

                enemy.healthBar.clear();
                enemy.healthBar.rect(enemy.sprite.x - width / 2, enemy.sprite.y - 40, width * ratio, height);
                enemy.healthBar.fill({color: 0x22c55e, alpha: 0.95});
            };

            const spawnDefender = (card: Unit, x: number, y: number): void => {
                const sprite = new Sprite(enemyTexture);
                sprite.anchor.set(0.5, 1);
                sprite.width = DEFENDER_SPRITE_WIDTH;
                sprite.height = DEFENDER_SPRITE_HEIGHT;
                sprite.x = x;
                sprite.y = y;
                sprite.eventMode = 'static';
                sprite.cursor = 'grab';

                void Assets.load(card.imageUrl)
                    .then((texture) => {
                        if (sprite.destroyed) {
                            return;
                        }

                        const loadedTexture = texture as Texture;
                        const sourceWithScaleMode = loadedTexture.source as unknown as {
                            scaleMode?: 'nearest' | 'linear';
                            autoGenerateMipmaps?: boolean;
                            mipmap?: 'off' | 'on';
                        };
                        if (sourceWithScaleMode.scaleMode != null) {
                            sourceWithScaleMode.scaleMode = 'linear';
                        }

                        if (sourceWithScaleMode.autoGenerateMipmaps != null) {
                            sourceWithScaleMode.autoGenerateMipmaps = true;
                        }

                        if (sourceWithScaleMode.mipmap != null) {
                            sourceWithScaleMode.mipmap = 'on';
                        }

                        sprite.texture = loadedTexture;
                    })
                    .catch(() => undefined);

                let rangeCircle: Graphics | null = null;
                let rangeCone: Graphics | null = null;
                let shieldCircle: Graphics | null = null;
                let shieldBarBg: Graphics | null = null;
                let shieldBar: Graphics | null = null;
                if (card.type === 'melee') {
                    rangeCircle = new Graphics();
                    rangeCircle.circle(0, 0, MELEE_RANGE);
                    rangeCircle.fill({color: 0x4ade80, alpha: 0.1});
                    rangeCircle.stroke({width: 2, color: 0x4ade80, alpha: 0.35});
                    rangeCircle.x = x;
                    rangeCircle.y = y;
                    defenderGroundLayer.addChild(rangeCircle);

                    shieldCircle = new Graphics();
                    shieldCircle.x = x;
                    shieldCircle.y = y;
                    defenderGroundLayer.addChild(shieldCircle);

                    shieldBarBg = new Graphics();
                    shieldBar = new Graphics();
                    defenderLayer.addChild(shieldBarBg);
                    defenderLayer.addChild(shieldBar);
                } else if (card.type === 'ranged') {
                    rangeCone = new Graphics();
                    rangeCone.moveTo(0, 0);
                    rangeCone.arc(0, 0, RANGED_CONE_RANGE, -RANGED_CONE_HALF_ANGLE, RANGED_CONE_HALF_ANGLE);
                    rangeCone.closePath();
                    rangeCone.fill({color: 0x60a5fa, alpha: 0.08});
                    rangeCone.stroke({width: 2, color: 0x60a5fa, alpha: 0.34});
                    rangeCone.x = x;
                    rangeCone.y = y;
                    defenderGroundLayer.addChild(rangeCone);
                } else {
                    rangeCircle = new Graphics();
                    rangeCircle.circle(0, 0, MAGIC_RANGE);
                    rangeCircle.fill({color: 0xc084fc, alpha: 0.07});
                    rangeCircle.stroke({width: 2, color: 0xc084fc, alpha: 0.32});
                    rangeCircle.x = x;
                    rangeCircle.y = y;
                    defenderGroundLayer.addChild(rangeCircle);
                }

                defenderLayer.addChild(sprite);
                const defender: Defender = {
                    id: `def-${defenderCounter++}`,
                    card,
                    sprite,
                    hp: card.health,
                    maxHp: card.health,
                    shield: card.shield,
                    maxShield: card.shield,
                    shieldRechargeTimer: 0,
                    shieldCircle,
                    shieldBarBg,
                    shieldBar,
                    cooldown: 0,
                    rangeCircle,
                    rangeCone,
                };

                const syncDefenderVisuals = (): void => {
                    if (defender.rangeCircle != null) {
                        defender.rangeCircle.x = defender.sprite.x;
                        defender.rangeCircle.y = defender.sprite.y;
                    }

                    if (defender.rangeCone != null) {
                        defender.rangeCone.x = defender.sprite.x;
                        defender.rangeCone.y = defender.sprite.y;
                    }

                    if (defender.shieldCircle != null) {
                        defender.shieldCircle.x = defender.sprite.x;
                        defender.shieldCircle.y = defender.sprite.y;
                    }
                };

                let dragStartX = defender.sprite.x;
                let dragStartY = defender.sprite.y;
                let dragOffsetX = 0;
                let dragOffsetY = 0;
                let isDraggingDefender = false;

                const getClampedPosition = (targetX: number, targetY: number): {x: number; y: number} => {
                    const clampedX = Math.max(60, Math.min(app.renderer.width - 70, targetX));
                    const clampedY = Math.max(DEFENDER_SPRITE_HEIGHT + 20, Math.min(app.renderer.height - 20, targetY));
                    const clampedSafeX = Math.max(DEFENDER_HALF_WIDTH + 10, Math.min(app.renderer.width - DEFENDER_HALF_WIDTH - 10, clampedX));
                    return {x: clampedSafeX, y: clampedY};
                };

                const canMoveDefender = (targetX: number, targetY: number): boolean => {
                    return !defenders.some((otherDefender) => {
                        if (otherDefender.id === defender.id) {
                            return false;
                        }

                        const dx = otherDefender.sprite.x - targetX;
                        const dy = otherDefender.sprite.y - targetY;
                        return (dx * dx + dy * dy) < (216 * 216);
                    });
                };

                const endDefenderDrag = (): void => {
                    if (!isDraggingDefender) {
                        return;
                    }

                    isDraggingDefender = false;
                    sprite.alpha = 1;

                    const currentX = defender.sprite.x;
                    const currentY = defender.sprite.y;
                    const validPosition = canMoveDefender(currentX, currentY);

                    if (!validPosition) {
                        defender.sprite.x = dragStartX;
                        defender.sprite.y = dragStartY;
                        syncDefenderVisuals();
                        setStatusText('Cannot reposition here. Keep some spacing between defenders.');
                    }
                };

                sprite.on('pointerdown', (event) => {
                    if (waveInProgress) {
                        return;
                    }

                    const pointerPosition = event.getLocalPosition(world);
                    dragStartX = defender.sprite.x;
                    dragStartY = defender.sprite.y;
                    dragOffsetX = pointerPosition.x - defender.sprite.x;
                    dragOffsetY = pointerPosition.y - defender.sprite.y;
                    isDraggingDefender = true;
                    sprite.alpha = 0.86;
                });

                sprite.on('pointermove', (event) => {
                    if (!isDraggingDefender || waveInProgress) {
                        return;
                    }

                    const pointerPosition = event.getLocalPosition(world);
                    const clampedPosition = getClampedPosition(pointerPosition.x - dragOffsetX, pointerPosition.y - dragOffsetY);
                    defender.sprite.x = clampedPosition.x;
                    defender.sprite.y = clampedPosition.y;
                    syncDefenderVisuals();
                });

                sprite.on('pointerup', endDefenderDrag);
                sprite.on('pointerupoutside', endDefenderDrag);

                defenders.push(defender);
            };

            const getClampedPlacement = (x: number, y: number): {x: number; y: number} => {
                const clampedX = Math.max(60, Math.min(app.renderer.width - 70, x));
                const clampedY = Math.max(DEFENDER_SPRITE_HEIGHT + 20, Math.min(app.renderer.height - 20, y));
                const clampedSafeX = Math.max(DEFENDER_HALF_WIDTH + 10, Math.min(app.renderer.width - DEFENDER_HALF_WIDTH - 10, clampedX));
                return {x: clampedSafeX, y: clampedY};
            };

            const canPlaceAt = (x: number, y: number): boolean => {
                return !defenders.some((defender) => {
                    const dx = defender.sprite.x - x;
                    const dy = defender.sprite.y - y;
                    return (dx * dx + dy * dy) < (216 * 216);
                });
            };

            const clearPlacementPreview = (): void => {
                if (placementPreview != null) {
                    placementPreview.destroy();
                    placementPreview = null;
                    placementPreviewType = null;
                }
            };

            const updatePlacementPreview = (card: Unit, x: number, y: number): void => {
                if (waveInProgress) {
                    clearPlacementPreview();
                    return;
                }

                const clampedPosition = getClampedPlacement(x, y);
                const placeable = canPlaceAt(clampedPosition.x, clampedPosition.y);

                if (placementPreview == null || placementPreviewType !== card.type) {
                    placementPreview?.destroy();
                    placementPreview = new Graphics();
                    placementPreviewType = card.type;
                    defenderGroundLayer.addChild(placementPreview);
                }

                const fillAlpha = placeable ? 0.1 : 0.07;
                const strokeAlpha = placeable ? 0.38 : 0.72;

                placementPreview.clear();
                placementPreview.x = clampedPosition.x;
                placementPreview.y = clampedPosition.y;

                if (card.type === 'melee') {
                    const color = placeable ? 0x4ade80 : 0xf87171;
                    placementPreview.circle(0, 0, MELEE_RANGE);
                    placementPreview.fill({color, alpha: fillAlpha});
                    placementPreview.stroke({width: 2, color, alpha: strokeAlpha});
                } else if (card.type === 'ranged') {
                    const color = placeable ? 0x60a5fa : 0xf87171;
                    placementPreview.moveTo(0, 0);
                    placementPreview.arc(0, 0, RANGED_CONE_RANGE, -RANGED_CONE_HALF_ANGLE, RANGED_CONE_HALF_ANGLE);
                    placementPreview.closePath();
                    placementPreview.fill({color, alpha: placeable ? 0.09 : 0.06});
                    placementPreview.stroke({width: 2, color, alpha: placeable ? 0.34 : 0.7});
                } else {
                    const color = placeable ? 0xc084fc : 0xf87171;
                    placementPreview.circle(0, 0, MAGIC_RANGE);
                    placementPreview.fill({color, alpha: placeable ? 0.08 : 0.06});
                    placementPreview.stroke({width: 2, color, alpha: placeable ? 0.33 : 0.7});
                }

                placementPreview.circle(0, 0, 12);
                placementPreview.fill({color: placeable ? 0xe2e8f0 : 0xfca5a5, alpha: 0.9});
            };

            const findClosestDefender = (x: number, y: number, predicate?: (defender: Defender) => boolean): Defender | null => {
                let closest: Defender | null = null;
                let minDistance = Number.POSITIVE_INFINITY;
                for (const defender of defenders) {
                    if (predicate != null && !predicate(defender)) {
                        continue;
                    }

                    const dx = defender.sprite.x - x;
                    const dy = defender.sprite.y - y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closest = defender;
                    }
                }
                return closest;
            };

            const removeDefender = (index: number): void => {
                const defender = defenders[index];
                defender.sprite.destroy();
                defender.rangeCircle?.destroy();
                defender.rangeCone?.destroy();
                defender.shieldCircle?.destroy();
                defender.shieldBarBg?.destroy();
                defender.shieldBar?.destroy();
                defenders.splice(index, 1);
            };

            const damageDefender = (defender: Defender, amount: number): void => {
                let pendingDamage = amount;

                if (defender.card.type === 'melee' && defender.maxShield > 0) {
                    const absorbed = Math.min(defender.shield, pendingDamage);
                    defender.shield -= absorbed;
                    pendingDamage -= absorbed;
                    defender.shieldRechargeTimer = 110;
                }

                if (pendingDamage > 0) {
                    defender.hp = Math.max(0, defender.hp - pendingDamage);
                }
            };

            const updateDefenderShieldVisuals = (deltaTime: number): void => {
                for (const defender of defenders) {
                    if (defender.card.type !== 'melee' || defender.maxShield <= 0) {
                        continue;
                    }

                    defender.shieldRechargeTimer = Math.max(0, defender.shieldRechargeTimer - deltaTime);
                    if (defender.shieldRechargeTimer <= 0 && defender.shield < defender.maxShield) {
                        defender.shield = Math.min(defender.maxShield, defender.shield + 0.36 * deltaTime);
                    }

                    const ratio = Math.max(0, Math.min(1, defender.shield / defender.maxShield));

                    if (defender.shieldCircle != null) {
                        defender.shieldCircle.clear();
                        defender.shieldCircle.circle(0, 0, 32 + ratio * 10);
                        defender.shieldCircle.fill({color: 0x67e8f9, alpha: 0.08 + ratio * 0.16});
                        defender.shieldCircle.stroke({width: 2, color: 0x67e8f9, alpha: 0.25 + ratio * 0.55});
                    }

                    if (defender.shieldBarBg != null && defender.shieldBar != null) {
                        const barWidth = 42;
                        const barHeight = 5;
                        const left = defender.sprite.x - barWidth / 2;
                        const top = defender.sprite.y - DEFENDER_BAR_Y_OFFSET;

                        defender.shieldBarBg.clear();
                        defender.shieldBarBg.rect(left, top, barWidth, barHeight);
                        defender.shieldBarBg.fill({color: 0x0f172a, alpha: 0.72});

                        defender.shieldBar.clear();
                        defender.shieldBar.rect(left, top, barWidth * ratio, barHeight);
                        defender.shieldBar.fill({color: 0x67e8f9, alpha: 0.9});
                    }
                }
            };

            const updateDefenderAttacks = (deltaTime: number): void => {
                if (!waveInProgress || enemies.length === 0) {
                    return;
                }

                for (const defender of defenders) {
                    defender.cooldown = Math.max(0, defender.cooldown - deltaTime);
                    if (defender.cooldown > 0) {
                        continue;
                    }

                    if (defender.card.type === 'melee') {
                        const slashRadius = MELEE_RANGE;
                        const targets = enemies.filter((enemy) => {
                            const dx = enemy.sprite.x - defender.sprite.x;
                            const dy = enemy.sprite.y - defender.sprite.y;
                            return (dx * dx + dy * dy) <= slashRadius * slashRadius;
                        });

                        if (targets.length > 0) {
                            for (const enemy of targets) {
                                damageEnemy(enemy, defender.card.attack * 1.18, defender);
                            }
                            createMeleeEffect(defender.sprite.x, defender.sprite.y, slashRadius);
                            defender.cooldown = 36;
                        }
                        continue;
                    }

                    if (defender.card.type === 'ranged') {
                        const coneLength = RANGED_CONE_RANGE;
                        const halfAngle = RANGED_CONE_HALF_ANGLE;

                        const inCone = enemies
                            .filter((enemy) => {
                                const dx = enemy.sprite.x - defender.sprite.x;
                                const dy = enemy.sprite.y - defender.sprite.y;
                                if (dx <= 0) {
                                    return false;
                                }

                                const distance = Math.sqrt(dx * dx + dy * dy);
                                if (distance > coneLength) {
                                    return false;
                                }

                                const angle = Math.abs(Math.atan2(dy, dx));
                                return angle <= halfAngle;
                            })
                            .sort((a, b) => a.sprite.x - b.sprite.x);

                        const target = inCone[0];
                        if (target != null) {
                            damageEnemy(target, defender.card.attack * 1.35, defender);
                            createArrowEffect(defender.sprite.x + 8, defender.sprite.y - 3, target.sprite.x, target.sprite.y);
                            defender.cooldown = 29;
                        }
                        continue;
                    }

                    const inMagicRange = enemies.filter((enemy) => {
                        const dx = enemy.sprite.x - defender.sprite.x;
                        const dy = enemy.sprite.y - defender.sprite.y;
                        return (dx * dx + dy * dy) <= MAGIC_RANGE * MAGIC_RANGE;
                    });

                    const randomEnemy = inMagicRange[Math.floor(Math.random() * inMagicRange.length)];
                    if (randomEnemy != null) {
                        const jumpPoints: Array<{x: number; y: number}> = [{x: defender.sprite.x, y: defender.sprite.y}];
                        const chainTargets: Enemy[] = [randomEnemy];
                        let anchor = randomEnemy;

                        for (let jump = 0; jump < 2; jump += 1) {
                            const nextTarget = enemies
                                .filter((enemy) => enemy.id !== anchor.id && !chainTargets.some((used) => used.id === enemy.id))
                                .map((enemy) => {
                                    const dx = enemy.sprite.x - anchor.sprite.x;
                                    const dy = enemy.sprite.y - anchor.sprite.y;
                                    return {enemy, distanceSq: dx * dx + dy * dy};
                                })
                                .filter((entry) => entry.distanceSq <= 165 * 165)
                                .sort((a, b) => a.distanceSq - b.distanceSq)[0]?.enemy;

                            if (nextTarget == null) {
                                break;
                            }

                            chainTargets.push(nextTarget);
                            anchor = nextTarget;
                        }

                        for (let index = 0; index < chainTargets.length; index += 1) {
                            const target = chainTargets[index];
                            jumpPoints.push({x: target.sprite.x, y: target.sprite.y});
                            const falloff = Math.max(0.55, 1 - index * 0.23);
                            damageEnemy(target, defender.card.attack * 1.22 * falloff, defender);
                            createMagicImpactRadiusEffect(target.sprite.x, target.sprite.y, 56);
                        }

                        createMagicBoltEffect(jumpPoints);
                        defender.cooldown = 64;
                    }
                }
            };

            const updateEffects = (): void => {
                for (let index = effects.length - 1; index >= 0; index -= 1) {
                    const effect = effects[index];
                    const progress = 1 - (effect.life / effect.maxLife);
                    effect.update?.(progress, effect.graphic);
                    effect.life -= 1;
                    effect.graphic.alpha = Math.max(0, effect.life / effect.maxLife);
                    if (effect.life <= 0) {
                        effect.graphic.destroy();
                        effects.splice(index, 1);
                    }
                }
            };

            const updateBattle = (ticker: {deltaTime: number}): void => {
                const deltaTime = ticker.deltaTime;

                updateDefenderAttacks(deltaTime);
                updateDefenderShieldVisuals(deltaTime);
                updateEffects();

                for (let index = enemies.length - 1; index >= 0; index -= 1) {
                    const enemy = enemies[index];
                    enemy.cooldown = Math.max(0, enemy.cooldown - deltaTime);

                    const attackTarget = findClosestDefender(enemy.sprite.x, enemy.sprite.y, (defender) => {
                        const dx = defender.sprite.x - enemy.sprite.x;
                        const dy = defender.sprite.y - enemy.sprite.y;
                        return (dx * dx + dy * dy) <= enemy.attackRange * enemy.attackRange;
                    });

                    if (attackTarget != null) {
                        enemy.sprite.tint = 0xdc2626;
                        if (enemy.cooldown <= 0) {
                            damageDefender(attackTarget, enemy.attack);
                            createEnemyStrikeEffect(attackTarget.sprite.x, attackTarget.sprite.y);
                            enemy.cooldown = 42;
                        }
                    } else {
                        enemy.sprite.tint = 0xef4444;
                        enemy.sprite.x -= enemy.speed * deltaTime;

                        const magnetTarget = findClosestDefender(enemy.sprite.x, enemy.sprite.y, (defender) => {
                            const dx = defender.sprite.x - enemy.sprite.x;
                            const dy = defender.sprite.y - enemy.sprite.y;
                            return (dx * dx + dy * dy) <= ENEMY_MAGNET_RADIUS * ENEMY_MAGNET_RADIUS;
                        });

                        if (magnetTarget != null) {
                            const dy = magnetTarget.sprite.y - enemy.sprite.y;
                            const maxDrift = ENEMY_MAX_VERTICAL_DRIFT * deltaTime;
                            const pullDelta = dy * ENEMY_MAGNET_PULL;
                            const clampedDelta = Math.max(-maxDrift, Math.min(maxDrift, pullDelta));
                            enemy.sprite.y += clampedDelta;
                        }

                        enemy.sprite.y = Math.max(42, Math.min(app.renderer.height - 42, enemy.sprite.y));
                    }

                    if (enemy.hp <= 0) {
                        if (enemy.lastHitByDefenderId != null) {
                            const killer = defenders.find((defender) => defender.id === enemy.lastHitByDefenderId);
                            playVoiceLine(killer?.card.killLineUrl, KILL_LINE_CHANCE);
                        }
                        enemy.sprite.destroy();
                        enemy.healthBarBg.destroy();
                        enemy.healthBar.destroy();
                        enemies.splice(index, 1);
                        continue;
                    }

                    updateEnemyBar(enemy);

                    if (enemy.sprite.x < -70) {
                        enemy.sprite.destroy();
                        enemy.healthBarBg.destroy();
                        enemy.healthBar.destroy();
                        enemies.splice(index, 1);
                    }
                }

                for (let index = defenders.length - 1; index >= 0; index -= 1) {
                    if (defenders[index].hp <= 0) {
                        playVoiceLine(defenders[index].card.deathLineUrl);
                        removeDefender(index);
                    }
                }

                if (waveInProgress && enemiesSpawned >= totalEnemiesInWave && enemies.length === 0) {
                    waveInProgress = false;
                    clearPlacementPreview();
                    setIsWaveRunning(false);
                    setGold((current) => current + 8);
                    const nextHand = stage.drawUnitsFromReserve(6);
                    setHand(nextHand);
                    setStatusText(nextHand.length > 0
                        ? 'Wave cleared. Reinforcements arrived; draw new cards and deploy.'
                        : 'Wave cleared. Waiting for reserve cards to finish loading.');
                }
            };

            const startWave = (): boolean => {
                if (waveInProgress) {
                    return false;
                }

                waveInProgress = true;
                enemiesSpawned = 0;
                setIsWaveRunning(true);
                setStatusText('Round started. Hand retracted while defenders engage.');

                if (defenders.length > 0) {
                    const randomDefender = defenders[Math.floor(Math.random() * defenders.length)];
                    playVoiceLine(randomDefender?.card.waveLineUrl);
                }

                spawnEnemy();
                enemiesSpawned += 1;

                spawnIntervalId = window.setInterval(() => {
                    if (enemiesSpawned >= totalEnemiesInWave) {
                        if (spawnIntervalId != null) {
                            window.clearInterval(spawnIntervalId);
                            spawnIntervalId = null;
                        }
                        return;
                    }

                    spawnEnemy();
                    enemiesSpawned += 1;
                }, 750);

                return true;
            };

            const placeDefender = (card: Unit, x: number, y: number): boolean => {
                if (waveInProgress) {
                    return false;
                }

                const clampedPosition = getClampedPlacement(x, y);
                const placeable = canPlaceAt(clampedPosition.x, clampedPosition.y);
                if (!placeable) {
                    return false;
                }

                spawnDefender(card, clampedPosition.x, clampedPosition.y);
                clearPlacementPreview();
                return true;
            };

            const resizeScene = (): void => {
                grass.width = app.renderer.width;
                grass.height = app.renderer.height;
            };

            boardApiRef.current = {placeDefender, startWave, updatePlacementPreview, clearPlacementPreview};
            app.renderer.on('resize', resizeScene);
            app.ticker.add(updateBattle);
        };

        void boot();

        return () => {
            isDestroyed = true;
            boardApiRef.current = null;

            if (spawnIntervalId != null) {
                window.clearInterval(spawnIntervalId);
            }

            clearDragImage();

            if (activeVoiceAudioRef.current != null) {
                activeVoiceAudioRef.current.pause();
                activeVoiceAudioRef.current = null;
            }

            app.destroy(true, {children: true});
        };
    }, []);

    const handleStartWave = (): void => {
        if (isOpeningPack || isGeneratingPack) {
            setStatusText('Finish opening the current pack before starting a wave.');
            return;
        }

        const success = boardApiRef.current?.startWave() ?? false;
        if (!success) {
            setStatusText('A round is already running.');
        }
    };

    const handleOpenPack = async (): Promise<void> => {
        if (interactionLocked) {
            return;
        }

        setIsGeneratingPack(true);
        setStatusText('Preparing a foil pack from reserve...');

        try {
            const revealedTemplates = await stage.generatePackTemplates(PACK_SIZE);
            if (revealedTemplates.length === 0) {
                setStatusText('Reserve still loading. Try opening a pack again in a moment.');
                return;
            }

            setPackTemplates(revealedTemplates);
            setIsOpeningPack(true);
            setStatusText('Tear the sleeve to reveal reserve units.');
        } catch (error) {
            console.error('Failed to open pack', error);
            setStatusText('Pack opening hit an error. Please try again.');
        } finally {
            setIsGeneratingPack(false);
        }
    };

    const handlePackComplete = (): void => {
        const revealedCount = packTemplates.length;
        setPackTemplates([]);
        setIsOpeningPack(false);
        setStatusText(revealedCount > 0
            ? `Revealed ${revealedCount} reserve units.`
            : 'Pack closed.');
    };

    const clearDragImage = (): void => {
        if (dragImageRef.current != null) {
            dragImageRef.current.remove();
            dragImageRef.current = null;
        }
    };

    const handleCardDragStart = (event: React.DragEvent<HTMLDivElement>, card: Unit): void => {
        event.dataTransfer.setData('application/x-elf-card', card.id);
        setDraggingCardId(card.id);

        clearDragImage();

        const dragImage = document.createElement('img');
        dragImage.src = card.imageUrl;
        dragImage.alt = card.name;
        dragImage.width = DEFENDER_SPRITE_WIDTH;
        dragImage.height = DEFENDER_SPRITE_HEIGHT;
        dragImage.style.position = 'fixed';
        dragImage.style.top = '-10000px';
        dragImage.style.left = '-10000px';
        dragImage.style.width = `${DEFENDER_SPRITE_WIDTH}px`;
        dragImage.style.height = `${DEFENDER_SPRITE_HEIGHT}px`;
        dragImage.style.pointerEvents = 'none';

        document.body.appendChild(dragImage);
        dragImageRef.current = dragImage;
        event.dataTransfer.setDragImage(dragImage, DEFENDER_SPRITE_WIDTH / 2, DEFENDER_SPRITE_HEIGHT);
    };

    const handleDrop = (event: React.DragEvent<HTMLDivElement>): void => {
        event.preventDefault();
        clearDragImage();
        setDraggingCardId(null);
        boardApiRef.current?.clearPlacementPreview();

        if (interactionLocked) {
            setStatusText('Cannot deploy while gameplay is paused.');
            return;
        }

        const payload = event.dataTransfer.getData('application/x-elf-card');
        if (!payload) {
            return;
        }

        const droppedCard = hand.find((card) => card.id === payload);
        if (droppedCard == null) {
            return;
        }

        if (gold < droppedCard.cost) {
            setStatusText(`Not enough gold for ${droppedCard.name}. Need ${droppedCard.cost}.`);
            return;
        }

        const stageBounds = stageRef.current?.getBoundingClientRect();
        if (stageBounds == null) {
            return;
        }

        const x = event.clientX - stageBounds.left;
        const y = event.clientY - stageBounds.top;
        const placed = boardApiRef.current?.placeDefender(droppedCard, x, y) ?? false;

        if (!placed) {
            setStatusText('Cannot place here. Move to an open battlefield position.');
            return;
        }

        setGold((current) => current - droppedCard.cost);
        setHand((current) => {
            const remaining = current.filter((card) => card.id !== droppedCard.id);
            const refill = stage.drawUnitsFromReserve(6 - remaining.length);
            return [...remaining, ...refill];
        });
        setStatusText(`Placed ${droppedCard.name}.`);
        playVoiceLine(droppedCard.deployLineUrl);
    };

    return <div
        style={{position: 'relative', width: '100%', height: '100%'}}
        onDragOver={(event) => {
            event.preventDefault();

            if (interactionLocked || draggingCardId == null) {
                boardApiRef.current?.clearPlacementPreview();
                return;
            }

            const draggedCard = hand.find((card) => card.id === draggingCardId);
            const stageBounds = stageRef.current?.getBoundingClientRect();
            if (draggedCard == null || stageBounds == null) {
                boardApiRef.current?.clearPlacementPreview();
                return;
            }

            const x = event.clientX - stageBounds.left;
            const y = event.clientY - stageBounds.top;
            boardApiRef.current?.updatePlacementPreview(draggedCard, x, y);
        }}
        onDragLeave={() => {
            boardApiRef.current?.clearPlacementPreview();
        }}
        onDrop={handleDrop}
    >
        <div ref={stageRef} style={{width: '100%', height: '100%'}}/>

        <div style={{
            position: 'absolute',
            top: 14,
            left: 16,
            color: '#e5e7eb',
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: 14,
            fontWeight: 600,
            padding: '8px 12px',
            borderRadius: 10,
            background: 'rgba(17, 24, 39, 0.68)',
            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.28)',
        }}>
            Gold: {gold}
        </div>

        <div style={{
            position: 'absolute',
            top: 14,
            right: 168,
            color: '#d1fae5',
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: 13,
            fontWeight: 500,
            maxWidth: 380,
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            padding: '8px 12px',
            borderRadius: 10,
            background: 'rgba(17, 24, 39, 0.6)',
        }}>
            {statusText}
        </div>

        <button
            type={'button'}
            onClick={handleStartWave}
            disabled={interactionLocked}
            style={{
                position: 'absolute',
                top: 16,
                right: 16,
                border: 'none',
                borderRadius: 10,
                color: '#ffffff',
                fontSize: 15,
                fontWeight: 700,
                padding: '10px 16px',
                background: interactionLocked ? '#4b5563' : '#0f766e',
                cursor: interactionLocked ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 16px rgba(15, 23, 42, 0.35)',
            }}
        >
            {isWaveRunning ? 'Wave Running...' : 'Start Wave'}
        </button>

        <button
            type={'button'}
            onClick={() => {
                void handleOpenPack();
            }}
            disabled={interactionLocked}
            style={{
                position: 'absolute',
                top: 16,
                right: 136,
                border: 'none',
                borderRadius: 10,
                color: '#ffffff',
                fontSize: 14,
                fontWeight: 700,
                padding: '10px 14px',
                background: interactionLocked ? '#374151' : '#7c3aed',
                cursor: interactionLocked ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 16px rgba(15, 23, 42, 0.35)',
            }}
        >
            {isGeneratingPack ? 'Opening...' : 'Open Pack'}
        </button>

        <div style={handStyle}>
            {hand.map((card) => {
                const affordable = gold >= card.cost;
                const theme = CARD_THEME[card.type];
                return <div
                    key={card.id}
                    draggable={!interactionLocked && affordable}
                    onDragStart={(event) => handleCardDragStart(event, card)}
                    onDragEnd={() => {
                        clearDragImage();
                        setDraggingCardId(null);
                        boardApiRef.current?.clearPlacementPreview();
                    }}
                    style={{
                        width: 172,
                        minHeight: 340,
                        borderRadius: 14,
                        border: `2px solid ${affordable ? theme.accent : 'rgba(248, 113, 113, 0.75)'}`,
                        background: `
                            linear-gradient(160deg, rgba(17, 24, 39, 0.9), rgba(15, 23, 42, 0.82)),
                            repeating-linear-gradient(
                                135deg,
                                ${theme.accentSoft} 0px,
                                ${theme.accentSoft} 2px,
                                rgba(15, 23, 42, 0.1) 2px,
                                rgba(15, 23, 42, 0.1) 8px
                            )
                        `,
                        boxShadow: `0 8px 20px rgba(2, 6, 23, 0.45), 0 0 0 1px ${theme.accentSoft} inset`,
                        color: '#f8fafc',
                        padding: '10px 42px 10px 10px',
                        fontFamily: 'Inter, Arial, sans-serif',
                        cursor: affordable ? 'grab' : 'not-allowed',
                        opacity: affordable ? 1 : 0.7,
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-start',
                        overflow: 'hidden',
                    }}
                >
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: `url(${card.imageUrl})`,
                        backgroundPosition: 'center 30%',
                        backgroundSize: 'cover',
                        backgroundRepeat: 'no-repeat',
                        opacity: 0.16,
                        filter: 'saturate(0.95)',
                        pointerEvents: 'none',
                    }}/>

                    <div style={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        background: 'rgba(15, 23, 42, 0.88)',
                        border: `1px solid ${theme.accent}`,
                        borderRadius: 999,
                        padding: '3px 7px',
                        color: '#fef9c3',
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: 0.2,
                        zIndex: 1,
                    }}>
                        <PaidRoundedIcon style={{fontSize: 13}}/>
                        {card.cost}
                    </div>

                    <div style={{
                        position: 'absolute',
                        top: 36,
                        right: 8,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        zIndex: 1,
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 4,
                            minWidth: 26,
                            color: '#fde68a',
                            fontSize: 12,
                            fontWeight: 700,
                        }}>
                            {getAttackIcon(card.type)}
                            <span>{card.attack}</span>
                        </div>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 4,
                            minWidth: 26,
                            color: '#fecaca',
                            fontSize: 12,
                            fontWeight: 700,
                        }}>
                            <FavoriteRoundedIcon style={{fontSize: 14}}/>
                            <span>{card.health}</span>
                        </div>
                        {card.shield > 0 ? <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 4,
                            minWidth: 26,
                            color: '#bae6fd',
                            fontSize: 12,
                            fontWeight: 700,
                        }}>
                            <ShieldRoundedIcon style={{fontSize: 14}}/>
                            <span>{card.shield}</span>
                        </div> : null}
                    </div>

                    <div style={{
                        width: '100%',
                        height: 162,
                        borderRadius: 8,
                        backgroundImage: `url(${card.portraitUrl})`,
                        backgroundPosition: 'top center',
                        backgroundSize: 'cover',
                        border: `1px solid ${theme.accent}`,
                        marginBottom: 8,
                        position: 'relative',
                        zIndex: 1,
                    }}/>
                    <div style={{
                        fontSize: 15,
                        fontWeight: 700,
                        lineHeight: 1.1,
                        marginBottom: 6,
                        fontFamily: 'Georgia, Times New Roman, serif',
                        textShadow: '0 1px 8px rgba(15, 23, 42, 0.75)',
                        position: 'relative',
                        zIndex: 1,
                    }}>
                        {card.name}
                    </div>

                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        marginBottom: 8,
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#e2e8f0',
                        textTransform: 'uppercase',
                        letterSpacing: 0.6,
                        position: 'relative',
                        zIndex: 1,
                    }}>
                        <span style={{
                            borderRadius: 999,
                            border: `1px solid ${theme.accent}`,
                            color: theme.accent,
                            padding: '2px 6px',
                            background: 'rgba(2, 6, 23, 0.5)',
                        }}>
                            {card.type}
                        </span>
                        <span>{theme.attackLabel}</span>
                    </div>

                    <div style={{
                        marginTop: 'auto',
                        borderTop: `1px solid ${theme.accentSoft}`,
                        paddingTop: 8,
                        minHeight: 38,
                        fontSize: 11,
                        color: '#cbd5e1',
                        lineHeight: 1.35,
                        fontStyle: 'italic',
                        position: 'relative',
                        zIndex: 1,
                    }}>
                        {card.flavor || theme.flavor}
                    </div>
                </div>;
            })}
        </div>

        {isOpeningPack ? <UnitPackOpening
            templates={packTemplates}
            onComplete={handlePackComplete}
        /> : null}
    </div>;
};