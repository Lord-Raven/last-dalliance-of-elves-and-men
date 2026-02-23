import {ReactElement, useEffect, useRef, useState} from "react";
import {StageBase, StageResponse, InitialData, Message} from "@chub-ai/stages-ts";
import {LoadResponse} from "@chub-ai/stages-ts/dist/types/load";
import {Application, Assets, Container, Sprite, Text, TextStyle, TilingSprite, Texture} from "pixi.js";

type MessageStateType = any;

type ConfigType = any;

type InitStateType = any;

type ChatStateType = any;

type Enemy = {
    sprite: Sprite;
    speed: number;
};

const TowerDefenseBoard = (): ReactElement => {
    const stageRef = useRef<HTMLDivElement>(null);
    const startWaveRef = useRef<() => void>(() => {
    });
    const [isWaveRunning, setIsWaveRunning] = useState<boolean>(false);

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
                Assets.load('/placeholder/enemy-placeholder.svg') as Promise<Texture>
            ]);

            const grass = new TilingSprite({
                texture: grassTexture,
                width: app.renderer.width,
                height: app.renderer.height,
            });
            world.addChild(grass);

            const enemyLayer = new Container();
            world.addChild(enemyLayer);

            const title = new Text({
                text: "Grasslands - Wave Demo",
                style: new TextStyle({
                    fill: 0xffffff,
                    fontFamily: "Inter, Arial, sans-serif",
                    fontSize: 30,
                    fontWeight: "700",
                }),
            });
            title.position.set(20, 16);

            const enemies: Enemy[] = [];
            const laneFractions = [0.2, 0.35, 0.5, 0.65, 0.8];
            const totalEnemiesInWave = 10;
            let enemiesSpawned = 0;
            let waveInProgress = false;

            const getLaneY = (): number => {
                const laneIndex = Math.floor(Math.random() * laneFractions.length);
                return app.renderer.height * laneFractions[laneIndex];
            };

            const spawnEnemy = (): void => {
                const enemy = new Sprite(enemyTexture);
                enemy.anchor.set(0.5);
                enemy.width = 56;
                enemy.height = 56;
                enemy.x = app.renderer.width + 48 + Math.random() * 120;
                enemy.y = getLaneY();

                enemyLayer.addChild(enemy);
                enemies.push({
                    sprite: enemy,
                    speed: 0.9 + Math.random() * 0.7,
                });
            };

            const updateEnemies = (ticker: {deltaTime: number}): void => {
                for (let index = enemies.length - 1; index >= 0; index -= 1) {
                    const currentEnemy = enemies[index];
                    currentEnemy.sprite.x -= currentEnemy.speed * ticker.deltaTime;

                    if (currentEnemy.sprite.x < -70) {
                        currentEnemy.sprite.destroy();
                        enemies.splice(index, 1);
                    }
                }

                if (waveInProgress && enemiesSpawned >= totalEnemiesInWave && enemies.length === 0) {
                    waveInProgress = false;
                    setIsWaveRunning(false);
                }
            };

            const startWave = (): void => {
                if (waveInProgress) {
                    return;
                }

                waveInProgress = true;
                enemiesSpawned = 0;
                setIsWaveRunning(true);

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
                }, 850);
            };

            const resizeScene = (): void => {
                grass.width = app.renderer.width;
                grass.height = app.renderer.height;
            };

            app.renderer.on('resize', resizeScene);
            app.ticker.add(updateEnemies);
            startWaveRef.current = startWave;

            world.addChild(title);
        };

        void boot();

        return () => {
            isDestroyed = true;

            if (spawnIntervalId != null) {
                window.clearInterval(spawnIntervalId);
            }

            app.destroy(true, {children: true});
        };
    }, []);

    return <div style={{position: 'relative', width: '100%', height: '100%'}}>
        <div ref={stageRef} style={{width: '100%', height: '100%'}}/>
        <button
            type={'button'}
            onClick={() => startWaveRef.current()}
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
    </div>;
};

export class Stage extends StageBase<InitStateType, ChatStateType, MessageStateType, ConfigType> {

    myInternalState: {[key: string]: any};

    constructor(data: InitialData<InitStateType, ChatStateType, MessageStateType, ConfigType>) {
        super(data);
        const {
            characters,
            users,
            config,
            messageState,
            environment,
            initState,
            chatState
        } = data;
        this.myInternalState = messageState != null ? messageState : {'someKey': 'someValue'};
        this.myInternalState['numUsers'] = Object.keys(users).length;
        this.myInternalState['numChars'] = Object.keys(characters).length;
    }

    async load(): Promise<Partial<LoadResponse<InitStateType, ChatStateType, MessageStateType>>> {
        return {
            success: true,
            error: null,
            initState: null,
            chatState: null,
        };
    }

    async setState(state: MessageStateType): Promise<void> {
        if (state != null) {
            this.myInternalState = {...this.myInternalState, ...state};
        }
    }

    async beforePrompt(userMessage: Message): Promise<Partial<StageResponse<ChatStateType, MessageStateType>>> {
        const {
            content,
            anonymizedId,
            isBot
        } = userMessage;
        return {
            stageDirections: null,
            messageState: {'someKey': this.myInternalState['someKey']},
            modifiedMessage: null,
            systemMessage: null,
            error: null,
            chatState: null,
        };
    }

    async afterResponse(botMessage: Message): Promise<Partial<StageResponse<ChatStateType, MessageStateType>>> {
        const {
            content,
            anonymizedId,
            isBot
        } = botMessage;
        return {
            stageDirections: null,
            messageState: {'someKey': this.myInternalState['someKey']},
            modifiedMessage: null,
            error: null,
            systemMessage: null,
            chatState: null
        };
    }


    render(): ReactElement {

        return <div style={{
            width: '100vw',
            height: '100vh',
            display: 'grid',
            alignItems: 'stretch'
        }}>
            <TowerDefenseBoard />
        </div>;
    }

}
