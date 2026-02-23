import {ReactElement, useEffect, useRef} from "react";
import {StageBase, StageResponse, InitialData, Message} from "@chub-ai/stages-ts";
import {LoadResponse} from "@chub-ai/stages-ts/dist/types/load";
import {Application, Container, Graphics, Text, TextStyle} from "pixi.js";

type MessageStateType = any;

type ConfigType = any;

type InitStateType = any;

type ChatStateType = any;

const TowerDefenseBoard = (): ReactElement => {
    const stageRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const stageHost = stageRef.current;
        if (stageHost == null) {
            return;
        }

        const app = new Application();
        let isDestroyed = false;

        const boot = async (): Promise<void> => {
            await app.init({
                resizeTo: stageHost,
                antialias: true,
                background: 0x0f172a,
            });

            if (isDestroyed) {
                app.destroy(true, {children: true});
                return;
            }

            stageHost.appendChild(app.canvas);

            const world = new Container();
            app.stage.addChild(world);

            const lane = new Graphics()
                .roundRect(80, 300, 900, 90, 28)
                .fill(0x334155);

            const towerSlot = new Graphics()
                .circle(240, 250, 32)
                .fill(0x22c55e)
                .circle(240, 250, 14)
                .fill(0x052e16);

            const enemySpawn = new Graphics()
                .circle(100, 345, 14)
                .fill(0xf59e0b);

            const goal = new Graphics()
                .circle(960, 345, 14)
                .fill(0xef4444);

            const title = new Text({
                text: "Tower Defense Prototype",
                style: new TextStyle({
                    fill: 0xe2e8f0,
                    fontFamily: "Inter, Arial, sans-serif",
                    fontSize: 34,
                    fontWeight: "700",
                }),
            });
            title.position.set(80, 120);

            world.addChild(lane, towerSlot, enemySpawn, goal, title);
        };

        void boot();

        return () => {
            isDestroyed = true;
            app.destroy(true, {children: true});
        };
    }, []);

    return <div ref={stageRef} style={{width: '100%', height: '100%'}} />;
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
