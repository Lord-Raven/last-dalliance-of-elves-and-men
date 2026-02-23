import {ReactElement, useEffect, useMemo, useRef, useState} from "react";
import {Application, Assets, Container, Graphics, Sprite, Text, TextStyle, TilingSprite, Texture} from "pixi.js";

type ElfType = 'ranged' | 'melee' | 'magic';

type Card = {
    id: string;
    name: string;
    type: ElfType;
    cost: number;
    attack: number;
    health: number;
    shield: number;
    portrait: string;
};

type Enemy = {
    id: string;
    sprite: Sprite;
    speed: number;
    attack: number;
    attackRange: number;
    cooldown: number;
    hp: number;
    maxHp: number;
    healthBarBg: Graphics;
    healthBar: Graphics;
};

type Defender = {
    id: string;
    card: Card;
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
    placeDefender: (card: Card, x: number, y: number) => boolean;
    startWave: () => boolean;
};

const CARD_POOL: ReadonlyArray<Omit<Card, 'id'>> = [
    {name: 'Aelion Sentinel', type: 'melee', cost: 3, attack: 12, health: 90, shield: 44, portrait: '/placeholder/enemy-placeholder.svg'},
    {name: 'Thornblade Guard', type: 'melee', cost: 4, attack: 15, health: 105, shield: 54, portrait: '/placeholder/enemy-placeholder.svg'},
    {name: 'Moonwatch Archer', type: 'ranged', cost: 2, attack: 10, health: 64, shield: 0, portrait: '/placeholder/enemy-placeholder.svg'},
    {name: 'Galeleaf Ranger', type: 'ranged', cost: 3, attack: 13, health: 72, shield: 0, portrait: '/placeholder/enemy-placeholder.svg'},
    {name: 'Starbloom Mage', type: 'magic', cost: 4, attack: 16, health: 58, shield: 0, portrait: '/placeholder/enemy-placeholder.svg'},
    {name: 'Runesong Mystic', type: 'magic', cost: 5, attack: 20, health: 62, shield: 0, portrait: '/placeholder/enemy-placeholder.svg'},
    {name: 'Sunbark Duelist', type: 'melee', cost: 2, attack: 9, health: 78, shield: 36, portrait: '/placeholder/enemy-placeholder.svg'},
    {name: 'Whisperwind Scout', type: 'ranged', cost: 1, attack: 7, health: 54, shield: 0, portrait: '/placeholder/enemy-placeholder.svg'},
    {name: 'Silver Veil Adept', type: 'magic', cost: 3, attack: 12, health: 52, shield: 0, portrait: '/placeholder/enemy-placeholder.svg'},
];

const TYPE_TINT: Record<ElfType, number> = {
    melee: 0x22c55e,
    ranged: 0x60a5fa,
    magic: 0xc084fc,
};

const MELEE_RANGE = 88;
const RANGED_CONE_RANGE = 500;
const RANGED_CONE_HALF_ANGLE = 0.28;
const MAGIC_RANGE = 280;
const ENEMY_MAGNET_RADIUS = 220;
const ENEMY_MAGNET_PULL = 0.22;
const ENEMY_MAX_VERTICAL_DRIFT = 0.32;

const drawHand = (size: number): Card[] => {
    const shuffled = [...CARD_POOL].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, size).map((card, index) => ({
        ...card,
        id: `${card.name}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    }));
};

export const TowerDefenseBoard = (): ReactElement => {
    const stageRef = useRef<HTMLDivElement>(null);
    const boardApiRef = useRef<BoardApi | null>(null);
    const [isWaveRunning, setIsWaveRunning] = useState<boolean>(false);
    const [gold, setGold] = useState<number>(14);
    const [hand, setHand] = useState<Card[]>(() => drawHand(6));
    const [statusText, setStatusText] = useState<string>('Drag an elf card onto the field to place a defender.');

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
        transform: isWaveRunning ? 'translateY(120%)' : 'translateY(0)',
        transition: 'transform 260ms ease',
        pointerEvents: isWaveRunning ? 'none' as const : 'auto' as const,
    }), [isWaveRunning]);

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
                backgroundAlpha: 0,
            });

            if (isDestroyed) {
                app.destroy(true, {children: true});
                return;
            }

            stageHost.appendChild(app.canvas);

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

            const defenderLayer = new Container();
            const enemyLayer = new Container();
            const effectLayer = new Container();
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

            const damageEnemy = (enemy: Enemy, amount: number): void => {
                enemy.hp = Math.max(0, enemy.hp - amount);
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

            const spawnDefender = (card: Card, x: number, y: number): void => {
                const sprite = new Sprite(enemyTexture);
                sprite.anchor.set(0.5);
                sprite.width = 52;
                sprite.height = 52;
                sprite.tint = TYPE_TINT[card.type];
                sprite.x = x;
                sprite.y = y;

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
                    defenderLayer.addChild(rangeCircle);

                    shieldCircle = new Graphics();
                    shieldCircle.x = x;
                    shieldCircle.y = y;
                    defenderLayer.addChild(shieldCircle);

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
                    defenderLayer.addChild(rangeCone);
                } else {
                    rangeCircle = new Graphics();
                    rangeCircle.circle(0, 0, MAGIC_RANGE);
                    rangeCircle.fill({color: 0xc084fc, alpha: 0.07});
                    rangeCircle.stroke({width: 2, color: 0xc084fc, alpha: 0.32});
                    rangeCircle.x = x;
                    rangeCircle.y = y;
                    defenderLayer.addChild(rangeCircle);
                }

                defenderLayer.addChild(sprite);
                defenders.push({
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
                });
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
                        const top = defender.sprite.y - 40;

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
                                damageEnemy(enemy, defender.card.attack * 1.18);
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
                            damageEnemy(target, defender.card.attack * 1.35);
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
                            damageEnemy(target, defender.card.attack * 1.22 * falloff);
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
                        removeDefender(index);
                    }
                }

                if (waveInProgress && enemiesSpawned >= totalEnemiesInWave && enemies.length === 0) {
                    waveInProgress = false;
                    setIsWaveRunning(false);
                    setGold((current) => current + 8);
                    setHand(drawHand(6));
                    setStatusText('Wave cleared. Reinforcements arrived; draw new cards and deploy.');
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

            const placeDefender = (card: Card, x: number, y: number): boolean => {
                if (waveInProgress) {
                    return false;
                }

                const clampedX = Math.max(60, Math.min(app.renderer.width - 70, x));
                const clampedY = Math.max(80, Math.min(app.renderer.height - 80, y));

                const tooClose = defenders.some((defender) => {
                    const dx = defender.sprite.x - clampedX;
                    const dy = defender.sprite.y - clampedY;
                    return (dx * dx + dy * dy) < (70 * 70);
                });

                if (tooClose) {
                    return false;
                }

                spawnDefender(card, clampedX, clampedY);
                return true;
            };

            const resizeScene = (): void => {
                grass.width = app.renderer.width;
                grass.height = app.renderer.height;
            };

            boardApiRef.current = {placeDefender, startWave};
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

            app.destroy(true, {children: true});
        };
    }, []);

    const handleStartWave = (): void => {
        const success = boardApiRef.current?.startWave() ?? false;
        if (!success) {
            setStatusText('A round is already running.');
        }
    };

    const handleDrop = (event: React.DragEvent<HTMLDivElement>): void => {
        event.preventDefault();

        if (isWaveRunning) {
            setStatusText('Cannot deploy while a round is active.');
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
        setHand((current) => current.filter((card) => card.id !== droppedCard.id));
        setStatusText(`Placed ${droppedCard.name}.`);
    };

    return <div
        style={{position: 'relative', width: '100%', height: '100%'}}
        onDragOver={(event) => event.preventDefault()}
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
            disabled={isWaveRunning}
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
                background: isWaveRunning ? '#4b5563' : '#0f766e',
                cursor: isWaveRunning ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 16px rgba(15, 23, 42, 0.35)',
            }}
        >
            {isWaveRunning ? 'Wave Running...' : 'Start Wave'}
        </button>

        <div style={handStyle}>
            {hand.map((card) => {
                const affordable = gold >= card.cost;
                return <div
                    key={card.id}
                    draggable={!isWaveRunning && affordable}
                    onDragStart={(event) => event.dataTransfer.setData('application/x-elf-card', card.id)}
                    style={{
                        width: 146,
                        borderRadius: 12,
                        border: `2px solid ${affordable ? 'rgba(167, 243, 208, 0.65)' : 'rgba(248, 113, 113, 0.75)'}`,
                        background: 'rgba(15, 23, 42, 0.76)',
                        boxShadow: '0 6px 18px rgba(2, 6, 23, 0.42)',
                        color: '#f8fafc',
                        padding: 8,
                        fontFamily: 'Inter, Arial, sans-serif',
                        cursor: affordable ? 'grab' : 'not-allowed',
                        opacity: affordable ? 1 : 0.7,
                    }}
                >
                    <div style={{
                        width: '100%',
                        height: 76,
                        borderRadius: 8,
                        backgroundImage: `url(${card.portrait})`,
                        backgroundPosition: 'center',
                        backgroundSize: 'cover',
                        border: '1px solid rgba(148, 163, 184, 0.5)',
                        marginBottom: 8,
                    }}/>
                    <div style={{fontSize: 13, fontWeight: 700, marginBottom: 6}}>{card.name}</div>
                    <div style={{fontSize: 12, opacity: 0.92, lineHeight: 1.32}}>
                        <div>Type: {card.type}</div>
                        <div>Cost: {card.cost}</div>
                        <div>ATK: {card.attack} • HP: {card.health}</div>
                        {card.type === 'melee' ? <>
                            <div style={{marginTop: 4}}>Shield: {card.shield} (recharging)</div>
                            <div style={{
                                marginTop: 3,
                                width: '100%',
                                height: 5,
                                borderRadius: 999,
                                background: 'rgba(15, 23, 42, 0.95)',
                                border: '1px solid rgba(103, 232, 249, 0.5)',
                            }}>
                                <div style={{
                                    width: '100%',
                                    height: '100%',
                                    borderRadius: 999,
                                    background: 'linear-gradient(90deg, rgba(34,211,238,0.9), rgba(125,211,252,0.95))',
                                }}/>
                            </div>
                        </> : null}
                    </div>
                </div>;
            })}
        </div>
    </div>;
};