import {ReactElement} from "react";
import {StageBase, StageResponse, InitialData, Message} from "@chub-ai/stages-ts";
import {LoadResponse} from "@chub-ai/stages-ts/dist/types/load";
import {TowerDefenseBoard} from "./TowerDefenseBoard";
import {DEMO_FULL_PATHS, generateUnitTemplateFromFullPath, Unit, UnitTemplate, unitsFromTemplates} from "./Unit";

type MessageStateType = any;

type ConfigType = any;

type InitStateType = any;

type ChatStateType = any;

export class Stage extends StageBase<InitStateType, ChatStateType, MessageStateType, ConfigType> {

    myInternalState: {[key: string]: any};
    private readonly reserveUnitTemplates: UnitTemplate[] = [];
    private reservePendingLoads = 0;
    private reserveLoadingStarted = false;
    private readonly reserveListeners = new Set<() => void>();

    readonly characterDetailQuery = 'https://inference.chub.ai/api/characters/{fullPath}?full=true';

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
        this.startReserveTemplateLoading();
    }

    private notifyReserveListeners(): void {
        for (const listener of this.reserveListeners) {
            listener();
        }
    }

    private startReserveTemplateLoading(): void {
        if (this.reserveLoadingStarted) {
            return;
        }

        this.reserveLoadingStarted = true;
        this.reservePendingLoads = DEMO_FULL_PATHS.length;

        for (const fullPath of DEMO_FULL_PATHS) {
            void this.loadTemplateIntoReserve(fullPath);
        }
    }

    private async loadTemplateIntoReserve(fullPath: string): Promise<void> {
        try {
            const template = await generateUnitTemplateFromFullPath(fullPath, this);
            if (template != null) {
                this.reserveUnitTemplates.push(template);
            }
        } catch (error) {
            console.error(`Failed loading unit template for ${fullPath}`, error);
        } finally {
            this.reservePendingLoads = Math.max(0, this.reservePendingLoads - 1);
            this.notifyReserveListeners();
        }
    }

    getReserveTemplateCount(): number {
        return this.reserveUnitTemplates.length;
    }

    getReservePendingLoads(): number {
        return this.reservePendingLoads;
    }

    subscribeReserveUpdates(listener: () => void): () => void {
        this.reserveListeners.add(listener);
        return () => {
            this.reserveListeners.delete(listener);
        };
    }

    drawUnitsFromReserve(size: number): Unit[] {
        if (size <= 0) {
            return [];
        }

        const drawnTemplates = this.reserveUnitTemplates.splice(0, size);
        return unitsFromTemplates(drawnTemplates);
    }

    addTemplatesToReserve(templates: ReadonlyArray<UnitTemplate>): void {
        if (templates.length === 0) {
            return;
        }

        this.reserveUnitTemplates.push(...templates);
        this.notifyReserveListeners();
    }

    async generatePackTemplates(size: number): Promise<UnitTemplate[]> {
        if (size <= 0) {
            return [];
        }

        const packTasks: Array<Promise<UnitTemplate | null>> = [];
        for (let index = 0; index < size; index += 1) {
            packTasks.push(this.generateTemplateForPack());
        }

        const templates = await Promise.all(packTasks);
        return templates.filter((template): template is UnitTemplate => template != null);
    }

    private async generateTemplateForPack(): Promise<UnitTemplate | null> {
        const randomPath = DEMO_FULL_PATHS[Math.floor(Math.random() * DEMO_FULL_PATHS.length)];
        if (!randomPath) {
            return null;
        }

        try {
            return await generateUnitTemplateFromFullPath(randomPath, this);
        } catch (error) {
            console.error(`Failed generating pack template for ${randomPath}`, error);
            return null;
        }
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
            <TowerDefenseBoard stage={this} />
        </div>;
    }

}
