export type UnitType = 'melee' | 'ranged' | 'magic';
export type BodyType = 'slim' | 'average' | 'curvy';
export type HairType = 'short' | 'long' | 'ponytail';

export type Card = {
    id: string;
    name: string;
    type: UnitType;
    bodyType: BodyType;
    hairType: HairType;
    cost: number;
    attack: number;
    health: number;
    shield: number;
    portrait: string;
};

type CardTemplate = Omit<Card, 'id' | 'portrait'>;

type PortraitMatrix = {
    [type in UnitType]: {
        [body in BodyType]: {
            [hair in HairType]: string[];
        };
    };
};

export const UNIT_TYPE_TINT: Record<UnitType, number> = {
    melee: 0x22c55e,
    ranged: 0x60a5fa,
    magic: 0xc084fc,
};

const DEFAULT_ELF_IMAGE = 'https://media.charhub.io/f20e31b6-662d-4af3-8984-4a06a67071d5/473d4cba-d980-449c-bd49-0dd029dc0126.png';

const baseImages: PortraitMatrix = {
    melee: {
        slim: {
            short: [],
            long: [],
            ponytail: [],
        },
        average: {
            short: [],
            long: [],
            ponytail: [],
        },
        curvy: {
            short: [],
            long: [],
            ponytail: [],
        },
    },
    ranged: {
        slim: {
            short: [],
            long: [],
            ponytail: [],
        },
        average: {
            short: [],
            long: ['https://chub.ai/imagine/project/c8018a02-8bdd-4a12-8285-d2f641014711'],
            ponytail: [],
        },
        curvy: {
            short: [],
            long: [],
            ponytail: [],
        },
    },
    magic: {
        slim: {
            short: [],
            long: [],
            ponytail: [],
        },
        average: {
            short: [],
            long: [],
            ponytail: [],
        },
        curvy: {
            short: [],
            long: [],
            ponytail: [],
        },
    },
};

const CARD_POOL: ReadonlyArray<CardTemplate> = [
    {name: 'Aelion Sentinel', type: 'melee', bodyType: 'average', hairType: 'short', cost: 3, attack: 12, health: 90, shield: 44},
    {name: 'Thornblade Guard', type: 'melee', bodyType: 'curvy', hairType: 'ponytail', cost: 4, attack: 15, health: 105, shield: 54},
    {name: 'Moonwatch Archer', type: 'ranged', bodyType: 'slim', hairType: 'long', cost: 2, attack: 10, health: 64, shield: 0},
    {name: 'Galeleaf Ranger', type: 'ranged', bodyType: 'average', hairType: 'long', cost: 3, attack: 13, health: 72, shield: 0},
    {name: 'Starbloom Mage', type: 'magic', bodyType: 'slim', hairType: 'short', cost: 4, attack: 16, health: 58, shield: 0},
    {name: 'Runesong Mystic', type: 'magic', bodyType: 'curvy', hairType: 'long', cost: 5, attack: 20, health: 62, shield: 0},
    {name: 'Sunbark Duelist', type: 'melee', bodyType: 'average', hairType: 'long', cost: 2, attack: 9, health: 78, shield: 36},
    {name: 'Whisperwind Scout', type: 'ranged', bodyType: 'slim', hairType: 'ponytail', cost: 1, attack: 7, health: 54, shield: 0},
    {name: 'Silver Veil Adept', type: 'magic', bodyType: 'average', hairType: 'ponytail', cost: 3, attack: 12, health: 52, shield: 0},
];

export const getElfPortrait = (type: UnitType, bodyType: BodyType, hairType: HairType): string => {
    const candidates = baseImages[type]?.[bodyType]?.[hairType] ?? [];
    if (candidates.length === 0) {
        return DEFAULT_ELF_IMAGE;
    }

    return candidates[Math.floor(Math.random() * candidates.length)] ?? DEFAULT_ELF_IMAGE;
};

export const drawHand = (size: number): Card[] => {
    const shuffled = [...CARD_POOL].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, size).map((card, index) => ({
        ...card,
        id: `${card.name}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
        portrait: getElfPortrait(card.type, card.bodyType, card.hairType),
    }));
};

