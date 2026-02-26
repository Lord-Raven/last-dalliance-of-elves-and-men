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
    row: number;
    col: number;
    moveFromCol: number;
    moveToCol: number;
    moveProgress: number;
    attack: number;
    hp: number;
    maxHp: number;
    lastHitByDefenderId: string | null;
    healthPips: Graphics;
};

type Defender = {
    id: string;
    card: Unit;
    sprite: Sprite;
    row: number;
    col: number;
    hp: number;
    maxHp: number;
    shield: number;
    maxShield: number;
    wasAttackedThisTurn: boolean;
    healthPips: Graphics;
    shieldPips: Graphics | null;
    shieldCircle: Graphics | null;
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


const DEFENDER_SPRITE_WIDTH = 200;
const DEFENDER_SPRITE_HEIGHT = 300;
const KILL_LINE_CHANCE = 0.28;
const VOICE_LINE_MIN_GAP_MS = 1000;
const PACK_SIZE = 3;
const GRID_ROWS = 5;
const TURN_INTERVAL_MS = 1000;
const GRID_HEIGHT_RATIO = 0.66;
const GRID_TILE_MIN = 60;
const GRID_TILE_MAX = 120;
const GRID_UPWARD_SHIFT_RATIO = 0.08;
const ENEMY_MOVE_DURATION_RATIO = 0.78;

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
        let turnIntervalId: number | null = null;

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

            let turnCounter = 0;

            const boardGrid = new Graphics();
            defenderGroundLayer.addChild(boardGrid);

            let gridTileSize = 72;
            let gridCols = 10;
            let gridLeft = 0;
            let gridTop = 0;

            const clamp = (value: number, min: number, max: number): number => {
                return Math.max(min, Math.min(max, value));
            };

            const drawHeartPip = (graphic: Graphics, x: number, y: number, size: number, color: number, alpha = 1): void => {
                const top = size * 0.14;
                const radius = size * 0.26;
                graphic.circle(x - radius, y + top, radius);
                graphic.circle(x + radius, y + top, radius);
                graphic.moveTo(x - size * 0.52, y + top + size * 0.06);
                graphic.lineTo(x + size * 0.52, y + top + size * 0.06);
                graphic.lineTo(x, y + size * 0.92);
                graphic.closePath();
                graphic.fill({color, alpha});
            };

            const drawShieldPip = (graphic: Graphics, x: number, y: number, size: number, color: number, alpha = 1): void => {
                const half = size / 2;
                graphic.moveTo(x, y - half);
                graphic.lineTo(x + half * 0.72, y - half * 0.52);
                graphic.lineTo(x + half * 0.64, y + half * 0.42);
                graphic.lineTo(x, y + half);
                graphic.lineTo(x - half * 0.64, y + half * 0.42);
                graphic.lineTo(x - half * 0.72, y - half * 0.52);
                graphic.closePath();
                graphic.fill({color, alpha});
            };

            const updateGridMetrics = (): void => {
                const availableHeight = app.renderer.height * GRID_HEIGHT_RATIO;
                const desiredTile = Math.floor(availableHeight / GRID_ROWS);
                gridTileSize = clamp(desiredTile, GRID_TILE_MIN, GRID_TILE_MAX);
                gridCols = Math.max(8, Math.floor((app.renderer.width * 0.72) / gridTileSize));

                const gridWidth = gridCols * gridTileSize;
                const gridHeight = GRID_ROWS * gridTileSize;
                gridLeft = Math.floor((app.renderer.width - gridWidth) / 2);
                const centeredTop = Math.floor((app.renderer.height - gridHeight) / 2);
                const upwardShift = Math.floor(app.renderer.height * GRID_UPWARD_SHIFT_RATIO);
                gridTop = Math.max(16, centeredTop - upwardShift);
            };

            const drawGrid = (): void => {
                boardGrid.clear();
                const gridWidth = gridCols * gridTileSize;
                const gridHeight = GRID_ROWS * gridTileSize;

                boardGrid.roundRect(gridLeft - 8, gridTop - 8, gridWidth + 16, gridHeight + 16, 16);
                boardGrid.fill({color: 0x0f172a, alpha: 0.44});

                for (let row = 0; row < GRID_ROWS; row += 1) {
                    for (let col = 0; col < gridCols; col += 1) {
                        boardGrid.rect(
                            gridLeft + col * gridTileSize,
                            gridTop + row * gridTileSize,
                            gridTileSize,
                            gridTileSize,
                        );
                        boardGrid.fill({color: (row + col) % 2 === 0 ? 0x0b1220 : 0x111827, alpha: 0.35});
                        boardGrid.stroke({width: 1.5, color: 0x94a3b8, alpha: 0.25});
                    }
                }
            };

            const getTileCenter = (row: number, col: number): {x: number; y: number} => ({
                x: gridLeft + col * gridTileSize + gridTileSize / 2,
                y: gridTop + row * gridTileSize + gridTileSize / 2,
            });

            const tileFromWorld = (x: number, y: number): {row: number; col: number} | null => {
                const col = Math.floor((x - gridLeft) / gridTileSize);
                const row = Math.floor((y - gridTop) / gridTileSize);

                if (row < 0 || row >= GRID_ROWS || col < 0 || col >= gridCols) {
                    return null;
                }

                return {row, col};
            };

            const getDefenderAt = (row: number, col: number): Defender | null => {
                return defenders.find((defender) => defender.row === row && defender.col === col) ?? null;
            };

            const getEnemyAt = (row: number, col: number, ignoreEnemyId?: string): Enemy | null => {
                return enemies.find((enemy) => {
                    if (ignoreEnemyId != null && enemy.id === ignoreEnemyId) {
                        return false;
                    }
                    return enemy.row === row && enemy.col === col;
                }) ?? null;
            };

            const syncDefenderVisual = (defender: Defender): void => {
                const center = getTileCenter(defender.row, defender.col);
                defender.sprite.x = center.x;
                defender.sprite.y = center.y + gridTileSize * 0.34;

                if (defender.rangeCircle != null) {
                    defender.rangeCircle.x = center.x;
                    defender.rangeCircle.y = center.y;
                }

                if (defender.rangeCone != null) {
                    defender.rangeCone.x = center.x;
                    defender.rangeCone.y = center.y;
                }

                if (defender.shieldCircle != null) {
                    defender.shieldCircle.x = center.x;
                    defender.shieldCircle.y = center.y;
                }
            };

            const syncEnemyVisual = (enemy: Enemy): void => {
                const interpolatedCol = enemy.moveFromCol + ((enemy.moveToCol - enemy.moveFromCol) * enemy.moveProgress);
                const center = getTileCenter(enemy.row, interpolatedCol);
                enemy.sprite.x = center.x;
                enemy.sprite.y = center.y;
            };

            const stopEnemyMovement = (enemy: Enemy): void => {
                enemy.moveFromCol = enemy.col;
                enemy.moveToCol = enemy.col;
                enemy.moveProgress = 1;
            };

            const beginEnemyMovement = (enemy: Enemy, fromCol: number, toCol: number): void => {
                enemy.moveFromCol = fromCol;
                enemy.moveToCol = toCol;
                enemy.moveProgress = 0;
            };

            const updateEnemyPips = (enemy: Enemy): void => {
                enemy.healthPips.clear();
                const maxPips = Math.max(1, Math.round(enemy.maxHp));
                const currentPips = Math.max(0, Math.round(enemy.hp));
                const pipSize = Math.max(6, Math.min(12, gridTileSize * 0.13));
                const spacing = pipSize + 3;
                const totalWidth = (maxPips - 1) * spacing;
                const startX = enemy.sprite.x - totalWidth / 2;
                const y = enemy.sprite.y + gridTileSize * 0.42;

                for (let index = 0; index < maxPips; index += 1) {
                    const isFilled = index < currentPips;
                    drawHeartPip(enemy.healthPips, startX + index * spacing, y, pipSize, 0xfb7185, isFilled ? 0.98 : 0.24);
                }
            };

            const spawnEnemyAtRightEdge = (): void => {
                const spawnCol = gridCols - 1;
                const openRows: number[] = [];
                for (let row = 0; row < GRID_ROWS; row += 1) {
                    if (getDefenderAt(row, spawnCol) != null) {
                        continue;
                    }
                    if (getEnemyAt(row, spawnCol) != null) {
                        continue;
                    }
                    openRows.push(row);
                }

                if (openRows.length === 0) {
                    return;
                }

                const row = openRows[Math.floor(Math.random() * openRows.length)] ?? 0;
                const sprite = new Sprite(enemyTexture);
                sprite.anchor.set(0.5);
                sprite.width = gridTileSize * 0.62;
                sprite.height = gridTileSize * 0.62;
                sprite.tint = 0xef4444;

                const healthPips = new Graphics();

                enemyLayer.addChild(sprite);
                enemyLayer.addChild(healthPips);

                const enemy: Enemy = {
                    id: `enemy-${enemyCounter++}`,
                    row,
                    col: spawnCol,
                    moveFromCol: spawnCol,
                    moveToCol: spawnCol,
                    moveProgress: 1,
                    sprite,
                    attack: 2,
                    hp: 6,
                    maxHp: 6,
                    lastHitByDefenderId: null,
                    healthPips,
                };

                enemies.push(enemy);
                syncEnemyVisual(enemy);
                updateEnemyPips(enemy);
            };

            const spawnDefender = (card: Unit, row: number, col: number): void => {
                const sprite = new Sprite(enemyTexture);
                sprite.anchor.set(0.5, 1);
                sprite.width = gridTileSize;
                sprite.height = gridTileSize * 1.28;
                sprite.eventMode = 'none';

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
                let shieldPips: Graphics | null = null;
                const healthPips = new Graphics();

                if (card.type === 'melee') {
                    rangeCircle = new Graphics();
                    rangeCircle.circle(0, 0, gridTileSize * 1.05);
                    rangeCircle.fill({color: 0x4ade80, alpha: 0.08});
                    rangeCircle.stroke({width: 2, color: 0x4ade80, alpha: 0.28});
                    defenderGroundLayer.addChild(rangeCircle);

                    shieldCircle = new Graphics();
                    defenderGroundLayer.addChild(shieldCircle);

                    shieldPips = new Graphics();
                    defenderLayer.addChild(shieldPips);
                } else if (card.type === 'ranged') {
                    rangeCone = new Graphics();
                    const rowLength = (gridCols - col) * gridTileSize;
                    rangeCone.rect(0, -gridTileSize / 2 + 2, rowLength, gridTileSize - 4);
                    rangeCone.fill({color: 0x60a5fa, alpha: 0.08});
                    rangeCone.stroke({width: 2, color: 0x60a5fa, alpha: 0.28});
                    defenderGroundLayer.addChild(rangeCone);
                } else {
                    rangeCircle = new Graphics();
                    rangeCircle.circle(0, 0, gridTileSize * 1.1);
                    rangeCircle.fill({color: 0xc084fc, alpha: 0.07});
                    rangeCircle.stroke({width: 2, color: 0xc084fc, alpha: 0.27});
                    defenderGroundLayer.addChild(rangeCircle);
                }

                defenderLayer.addChild(sprite);
                defenderLayer.addChild(healthPips);
                const defender: Defender = {
                    id: `def-${defenderCounter++}`,
                    card,
                    row,
                    col,
                    sprite,
                    hp: card.health,
                    maxHp: card.health,
                    shield: card.shield,
                    maxShield: card.shield,
                    wasAttackedThisTurn: false,
                    healthPips,
                    shieldPips,
                    shieldCircle,
                    rangeCircle,
                    rangeCone,
                };

                defenders.push(defender);
                syncDefenderVisual(defender);
            };

            const canPlaceAtTile = (row: number, col: number): boolean => {
                return getDefenderAt(row, col) == null;
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

                const tile = tileFromWorld(x, y);
                if (tile == null) {
                    clearPlacementPreview();
                    return;
                }

                const placeable = canPlaceAtTile(tile.row, tile.col);
                const center = getTileCenter(tile.row, tile.col);

                if (placementPreview == null || placementPreviewType !== card.type) {
                    placementPreview?.destroy();
                    placementPreview = new Graphics();
                    placementPreviewType = card.type;
                    defenderGroundLayer.addChild(placementPreview);
                }

                const colorByType: Record<Unit['type'], number> = {
                    melee: 0x4ade80,
                    ranged: 0x60a5fa,
                    magic: 0xc084fc,
                };

                const color = placeable ? colorByType[card.type] : 0xf87171;
                placementPreview.clear();
                placementPreview.rect(
                    center.x - gridTileSize / 2 + 2,
                    center.y - gridTileSize / 2 + 2,
                    gridTileSize - 4,
                    gridTileSize - 4,
                );
                placementPreview.fill({color, alpha: placeable ? 0.16 : 0.22});
                placementPreview.stroke({width: 2, color, alpha: placeable ? 0.65 : 0.85});
            };

            const removeDefender = (index: number): void => {
                const defender = defenders[index];
                defender.sprite.destroy();
                defender.rangeCircle?.destroy();
                defender.rangeCone?.destroy();
                defender.shieldCircle?.destroy();
                defender.healthPips.destroy();
                defender.shieldPips?.destroy();
                defenders.splice(index, 1);
            };

            const damageDefender = (defender: Defender, amount: number): void => {
                defender.wasAttackedThisTurn = true;
                let pendingDamage = amount;

                if (defender.card.type === 'melee' && defender.maxShield > 0) {
                    const absorbed = Math.min(defender.shield, pendingDamage);
                    defender.shield -= absorbed;
                    pendingDamage -= absorbed;
                }

                if (pendingDamage > 0) {
                    defender.hp = Math.max(0, defender.hp - pendingDamage);
                }
            };

            const updateDefenderPips = (defender: Defender): void => {
                defender.healthPips.clear();
                const maxHealthPips = Math.max(1, Math.round(defender.maxHp));
                const currentHealthPips = Math.max(0, Math.round(defender.hp));
                const healthPipSize = Math.max(6, Math.min(12, gridTileSize * 0.13));
                const healthSpacing = healthPipSize + 3;
                const healthWidth = (maxHealthPips - 1) * healthSpacing;
                const healthStartX = defender.sprite.x - healthWidth / 2;
                const healthY = defender.sprite.y + gridTileSize * 0.12;

                for (let index = 0; index < maxHealthPips; index += 1) {
                    const isFilled = index < currentHealthPips;
                    drawHeartPip(defender.healthPips, healthStartX + index * healthSpacing, healthY, healthPipSize, 0xfb7185, isFilled ? 0.98 : 0.22);
                }

                if (defender.shieldPips != null && defender.maxShield > 0) {
                    defender.shieldPips.clear();
                    const maxShieldPips = Math.max(1, Math.round(defender.maxShield));
                    const currentShieldPips = Math.max(0, Math.round(defender.shield));
                    const shieldPipSize = Math.max(6, Math.min(11, gridTileSize * 0.12));
                    const shieldSpacing = shieldPipSize + 3;
                    const shieldWidth = (maxShieldPips - 1) * shieldSpacing;
                    const shieldStartX = defender.sprite.x - shieldWidth / 2;
                    const shieldY = healthY + healthPipSize + 5;

                    for (let index = 0; index < maxShieldPips; index += 1) {
                        const isFilled = index < currentShieldPips;
                        drawShieldPip(defender.shieldPips, shieldStartX + index * shieldSpacing, shieldY, shieldPipSize, 0x67e8f9, isFilled ? 0.96 : 0.2);
                    }
                }
            };

            const updateDefenderShieldVisuals = (): void => {
                for (const defender of defenders) {
                    if (defender.card.type !== 'melee' || defender.maxShield <= 0) {
                        updateDefenderPips(defender);
                        continue;
                    }

                    if (!defender.wasAttackedThisTurn && defender.shield < defender.maxShield) {
                        defender.shield = Math.min(defender.maxShield, defender.shield + 1);
                    }
                    defender.wasAttackedThisTurn = false;

                    const ratio = Math.max(0, Math.min(1, defender.shield / defender.maxShield));

                    if (defender.shieldCircle != null) {
                        defender.shieldCircle.clear();
                        defender.shieldCircle.circle(0, 0, 32 + ratio * 10);
                        defender.shieldCircle.fill({color: 0x67e8f9, alpha: 0.08 + ratio * 0.16});
                        defender.shieldCircle.stroke({width: 2, color: 0x67e8f9, alpha: 0.25 + ratio * 0.55});
                    }

                    updateDefenderPips(defender);
                }
            };

            const collectAdjacentEnemies = (row: number, col: number, includeCenter: boolean): Enemy[] => {
                const targets: Enemy[] = [];
                for (const enemy of enemies) {
                    const rowDiff = Math.abs(enemy.row - row);
                    const colDiff = Math.abs(enemy.col - col);
                    const adjacent = rowDiff <= 1 && colDiff <= 1;
                    if (!adjacent) {
                        continue;
                    }

                    if (!includeCenter && rowDiff === 0 && colDiff === 0) {
                        continue;
                    }

                    targets.push(enemy);
                }
                return targets;
            };

            const executeDefenderTurn = (): void => {
                for (const defender of defenders) {
                    if (defender.card.type === 'melee') {
                        const targets = collectAdjacentEnemies(defender.row, defender.col, false);
                        if (targets.length > 0) {
                            for (const enemy of targets) {
                                damageEnemy(enemy, defender.card.attack, defender);
                            }
                            const center = getTileCenter(defender.row, defender.col);
                            createMeleeEffect(center.x, center.y, gridTileSize * 0.72);
                        }
                        continue;
                    }

                    if (defender.card.type === 'ranged') {
                        const targets = enemies.filter((enemy) => enemy.row === defender.row);
                        if (targets.length > 0) {
                            for (const enemy of targets) {
                                damageEnemy(enemy, defender.card.attack, defender);
                                createArrowEffect(defender.sprite.x, defender.sprite.y - gridTileSize * 0.35, enemy.sprite.x, enemy.sprite.y);
                            }
                        }
                        continue;
                    }

                    const rowPriorityTarget = enemies
                        .filter((enemy) => enemy.row === defender.row)
                        .sort((a, b) => a.col - b.col)[0];

                    const fallbackTarget = enemies
                        .slice()
                        .sort((a, b) => {
                            if (a.col !== b.col) {
                                return a.col - b.col;
                            }
                            return Math.abs(a.row - defender.row) - Math.abs(b.row - defender.row);
                        })[0];

                    const target = rowPriorityTarget ?? fallbackTarget;
                    if (target == null) {
                        continue;
                    }

                    const splashTargets = collectAdjacentEnemies(target.row, target.col, true);
                    for (const enemy of splashTargets) {
                        damageEnemy(enemy, defender.card.attack, defender);
                        createMagicImpactRadiusEffect(enemy.sprite.x, enemy.sprite.y, gridTileSize * 0.56);
                    }

                    createMagicBoltEffect([
                        {x: defender.sprite.x, y: defender.sprite.y - gridTileSize * 0.28},
                        {x: target.sprite.x, y: target.sprite.y},
                    ]);
                }
            };

            const executeEnemyTurn = (): void => {
                const sortedEnemies = enemies.slice().sort((a, b) => {
                    if (a.col !== b.col) {
                        return a.col - b.col;
                    }
                    return a.row - b.row;
                });

                for (const enemy of sortedEnemies) {
                    if (enemy.hp <= 0) {
                        continue;
                    }

                    const nextCol = enemy.col - 1;
                    if (nextCol < 0) {
                        enemy.hp = 0;
                        setStatusText('An enemy slipped through the line.');
                        continue;
                    }

                    const defenderInFront = getDefenderAt(enemy.row, nextCol);
                    if (defenderInFront != null) {
                        damageDefender(defenderInFront, enemy.attack);
                        createEnemyStrikeEffect(defenderInFront.sprite.x, defenderInFront.sprite.y - gridTileSize * 0.35);
                        enemy.sprite.tint = 0xdc2626;
                        stopEnemyMovement(enemy);
                        continue;
                    }

                    const enemyInFront = getEnemyAt(enemy.row, nextCol, enemy.id);
                    if (enemyInFront != null) {
                        enemy.sprite.tint = 0xef4444;
                        stopEnemyMovement(enemy);
                        continue;
                    }

                    const currentCol = enemy.col;
                    enemy.col = nextCol;
                    enemy.sprite.tint = 0xef4444;
                    beginEnemyMovement(enemy, currentCol, nextCol);
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

            const removeDeadUnits = (): void => {
                for (let index = enemies.length - 1; index >= 0; index -= 1) {
                    const enemy = enemies[index];
                    if (enemy.hp > 0) {
                        continue;
                    }

                    if (enemy.lastHitByDefenderId != null) {
                        const killer = defenders.find((defender) => defender.id === enemy.lastHitByDefenderId);
                        playVoiceLine(killer?.card.killLineUrl, KILL_LINE_CHANCE);
                    }

                    enemy.sprite.destroy();
                    enemy.healthPips.destroy();
                    enemies.splice(index, 1);
                }

                for (let index = defenders.length - 1; index >= 0; index -= 1) {
                    if (defenders[index].hp <= 0) {
                        playVoiceLine(defenders[index].card.deathLineUrl);
                        removeDefender(index);
                    }
                }
            };

            const finishWaveIfCleared = (): void => {
                if (!waveInProgress || enemiesSpawned < totalEnemiesInWave || enemies.length > 0) {
                    return;
                }

                waveInProgress = false;
                if (turnIntervalId != null) {
                    window.clearInterval(turnIntervalId);
                    turnIntervalId = null;
                }

                clearPlacementPreview();
                setIsWaveRunning(false);
                setGold((current) => current + 8);
                const nextHand = stage.drawUnitsFromReserve(6);
                setHand(nextHand);
                setStatusText(nextHand.length > 0
                    ? 'Wave cleared. Reinforcements arrived; draw new cards and deploy.'
                    : 'Wave cleared. Waiting for reserve cards to finish loading.');
            };

            const runTurn = (): void => {
                if (!waveInProgress) {
                    return;
                }

                for (const defender of defenders) {
                    defender.wasAttackedThisTurn = false;
                }

                turnCounter += 1;

                if (enemiesSpawned < totalEnemiesInWave) {
                    const priorEnemyCount = enemies.length;
                    spawnEnemyAtRightEdge();
                    if (enemies.length > priorEnemyCount) {
                        enemiesSpawned += 1;
                    }
                }

                executeDefenderTurn();
                removeDeadUnits();

                executeEnemyTurn();
                removeDeadUnits();

                for (const enemy of enemies) {
                    syncEnemyVisual(enemy);
                    updateEnemyPips(enemy);
                }

                updateDefenderShieldVisuals();
                setStatusText(`Turn ${turnCounter} resolved. Enemies remaining: ${enemies.length}.`);
                finishWaveIfCleared();
            };

            const updateBattle = (ticker: {deltaTime: number}): void => {
                updateEffects();

                const turnFrames = (TURN_INTERVAL_MS / 1000) * 60;
                const movementFrames = Math.max(1, turnFrames * ENEMY_MOVE_DURATION_RATIO);
                for (const enemy of enemies) {
                    if (enemy.moveProgress < 1) {
                        enemy.moveProgress = Math.min(1, enemy.moveProgress + (ticker.deltaTime / movementFrames));
                    }

                    syncEnemyVisual(enemy);
                }

                for (const enemy of enemies) {
                    updateEnemyPips(enemy);
                }

                for (const defender of defenders) {
                    updateDefenderPips(defender);
                }
            };

            const startWave = (): boolean => {
                if (waveInProgress) {
                    return false;
                }

                waveInProgress = true;
                enemiesSpawned = 0;
                turnCounter = 0;
                setIsWaveRunning(true);
                setStatusText('Wave started. Turn 1 begins shortly.');

                if (defenders.length > 0) {
                    const randomDefender = defenders[Math.floor(Math.random() * defenders.length)];
                    playVoiceLine(randomDefender?.card.waveLineUrl);
                }

                runTurn();
                turnIntervalId = window.setInterval(runTurn, TURN_INTERVAL_MS);

                return true;
            };

            const placeDefender = (card: Unit, x: number, y: number): boolean => {
                if (waveInProgress) {
                    return false;
                }

                const tile = tileFromWorld(x, y);
                if (tile == null) {
                    return false;
                }

                const placeable = canPlaceAtTile(tile.row, tile.col);
                if (!placeable) {
                    return false;
                }

                spawnDefender(card, tile.row, tile.col);
                clearPlacementPreview();
                return true;
            };

            const resizeScene = (): void => {
                grass.width = app.renderer.width;
                grass.height = app.renderer.height;

                updateGridMetrics();
                drawGrid();

                for (const defender of defenders) {
                    if (defender.card.type === 'ranged' && defender.rangeCone != null) {
                        defender.rangeCone.clear();
                        const rowLength = (gridCols - defender.col) * gridTileSize;
                        defender.rangeCone.rect(0, -gridTileSize / 2 + 2, rowLength, gridTileSize - 4);
                        defender.rangeCone.fill({color: 0x60a5fa, alpha: 0.08});
                        defender.rangeCone.stroke({width: 2, color: 0x60a5fa, alpha: 0.28});
                    }

                    syncDefenderVisual(defender);
                }

                for (const enemy of enemies) {
                    syncEnemyVisual(enemy);
                    updateEnemyPips(enemy);
                }

                for (const defender of defenders) {
                    updateDefenderPips(defender);
                }
            };

            updateGridMetrics();
            drawGrid();

            boardApiRef.current = {placeDefender, startWave, updatePlacementPreview, clearPlacementPreview};
            app.renderer.on('resize', resizeScene);
            app.ticker.add(updateBattle);
        };

        void boot();

        return () => {
            isDestroyed = true;
            boardApiRef.current = null;

            if (turnIntervalId != null) {
                window.clearInterval(turnIntervalId);
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