import type { Stage } from "./Stage";

export type UnitType = 'melee' | 'ranged' | 'magic';
export type BodyType = 'slim' | 'average' | 'curvy';
export type HairType = 'short' | 'long' | 'ponytail';

export type Unit = {
    id: string;
    name: string;
    type: UnitType;
    bodyType: BodyType;
    hairType: HairType;
    cost: number;
    attack: number;
    health: number;
    shield: number;
    imageUrl: string;
    portraitUrl: string;
    flavor: string;
    deployLine?: string;
    killLine?: string;
    waveLine?: string;
    deathLine?: string;
    deployLineUrl?: string;
    killLineUrl?: string;
    waveLineUrl?: string;
    deathLineUrl?: string;
};

export type UnitTemplate = Omit<Unit, 'id'> & {
    voice: string;
    color: string;
    description: string;
    persona: string;
    flavor: string;
    deployLine: string;
    killLine: string;
    waveLine: string;
    deathLine: string;
    deployLineUrl: string;
    killLineUrl: string;
    waveLineUrl: string;
    deathLineUrl: string;
};

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
            short: ['https://avatars.charhub.io/avatars/uploads/images/gallery/file/6b878875-757c-491e-9c8e-1e3d421838e1/9bdd3fab-da99-4527-9ee7-50dea8e87a02.png',
                'https://avatars.charhub.io/avatars/uploads/images/gallery/file/9922e1d8-b33f-474b-9c50-3221e8bddc2e/efe09f71-eae9-40e5-bfbd-611579c154c2.png'
            ],
            long: ['https://avatars.charhub.io/avatars/uploads/images/gallery/file/8c8515c3-df3e-4527-95f9-53e0453974e8/c71dbea0-190b-49f9-8d9a-352c7195cb0d.png',
                'https://avatars.charhub.io/avatars/uploads/images/gallery/file/589e14c5-30e2-4f25-8a21-6a25c7874e5d/34390f73-05c9-46db-8804-042c10ce2cc5.png'
            ],
            ponytail: ['https://avatars.charhub.io/avatars/uploads/images/gallery/file/eb80f7df-0fd3-44bd-9b3f-27308fdb21c1/d68f4498-5b99-4a9a-8ab7-81102b822dad.png',
                'https://avatars.charhub.io/avatars/uploads/images/gallery/file/f38605b8-fa88-4d2d-ac8d-abb20ff72dd4/ee3918c3-f38d-4354-beaa-47691b164f8f.png',
                'https://avatars.charhub.io/avatars/uploads/images/gallery/file/d9432c5d-626c-4fb2-a41c-fb7add0609a3/dc4319b0-4cb7-49a1-97b7-4048f2113fb9.png'
            ],
        },
        average: {
            short: ['https://avatars.charhub.io/avatars/uploads/images/gallery/file/175f19a5-7168-4651-9ad8-ce2dd9e6dae9/7907baef-8272-460a-8af9-e16325e1b8b1.png',
                'https://avatars.charhub.io/avatars/uploads/images/gallery/file/a87302cb-cf49-4970-bbe2-03d4ac26bac7/8a5522b7-a41f-47d7-aef3-d7d0af43d963.png'
            ],
            long: ['https://avatars.charhub.io/avatars/uploads/images/gallery/file/126debda-7e91-42b4-8cc5-915ffbd1de96/2d178381-6add-479d-a681-545b05ff70e4.png'],
            ponytail: ['https://avatars.charhub.io/avatars/uploads/images/gallery/file/120ee154-3729-41f3-bff0-d84ccfbd738e/85df53ab-828e-4e1e-bb37-f022b352323d.png',
                'https://avatars.charhub.io/avatars/uploads/images/gallery/file/b00e225e-9700-4ba0-a4f5-e2748bffdfdc/32f61dc8-3d53-442f-a20b-045b45a6316c.png'
            ],
        },
        curvy: {
            short: ['https://avatars.charhub.io/avatars/uploads/images/gallery/file/d84a2dac-7bec-411a-a424-a5714c86dcd4/da9639be-3828-4ad5-9ad8-8d8799cc099d.png',
                'https://avatars.charhub.io/avatars/uploads/images/gallery/file/8f342b92-c40e-4d03-b3bd-4e09b3ebccbd/273935f1-7d35-44fa-9a7a-3c198e4ea460.png'
            ],
            long: ['https://avatars.charhub.io/avatars/uploads/images/gallery/file/ff6b60fe-554d-45da-8417-4a5d5742f16c/f2665f04-243b-4a4f-93ff-8809288f19ed.png',
                'https://avatars.charhub.io/avatars/uploads/images/gallery/file/a8cc8582-f9bf-477a-8ee1-ec185cc1238f/3e13148b-ba69-4580-ad1b-1a4d975ba5a4.png'
            ],
            ponytail: ['https://avatars.charhub.io/avatars/uploads/images/gallery/file/7c0a9469-dc68-4d71-a6e7-9748248097cd/6cc1dace-1ba8-4ceb-8d9b-c6966818f7a6.png'],
        },
    },
    ranged: {
        slim: {
            short: ['https://avatars.charhub.io/avatars/uploads/images/gallery/file/9eadb9e9-e2fa-4649-9df9-ceb02471d660/2060fded-4b0b-4bd2-a0a0-b520a48ef7ed.png'],
            long: ['https://avatars.charhub.io/avatars/uploads/images/gallery/file/6552171b-9a34-43e2-8128-337858b74cef/0887eca3-fdc6-4a5c-8515-fb8bd05f7a41.png',],
            ponytail: ['https://avatars.charhub.io/avatars/uploads/images/gallery/file/9ce0f931-2019-4434-b90d-58427ab96e88/a5df9105-9505-4726-b2ca-295515dbe18e.png'],
        },
        average: {
            short: ['https://avatars.charhub.io/avatars/uploads/images/gallery/file/29b58107-00af-4aaa-9e1e-0a0695757926/856adb04-c66f-4d46-b886-fcc06d6bcef8.png',
                    'https://avatars.charhub.io/avatars/uploads/images/gallery/file/896cbbdf-a345-48b8-b9ce-ac2e064c6e50/4a2e41b6-b815-4d21-a6f7-4ef0a09fa89b.png',
                    'https://avatars.charhub.io/avatars/uploads/images/gallery/file/688f171d-a08c-4c6a-bd8a-d3abc88c8b26/2b91e1e4-9c43-4fdb-9c68-79af3542dbc2.png'
            ],
            long: ['https://avatars.charhub.io/avatars/uploads/images/gallery/file/b3a47ce1-2753-421b-9fa0-42068c2fe3af/2a14ef3e-ee9e-4caf-aaa6-67940ab83552.png'],
            ponytail: ['https://avatars.charhub.io/avatars/uploads/images/gallery/file/7338f071-5f83-4f68-a60c-3fd198bf0757/e3c9bedf-f259-497d-8065-d03a4ac726e3.png',
                    'https://avatars.charhub.io/avatars/uploads/images/gallery/file/2314f3c4-aa40-4ece-9e96-7d2f3f7261c6/ef7394cd-7492-4876-9630-386e3dfe58ff.png'
            ],
        },
        curvy: {
            short: ['https://avatars.charhub.io/avatars/uploads/images/gallery/file/6e3526fe-df52-46b8-871e-3ddba54b7ca8/adba784a-e391-4106-bfc8-d19d282331c1.png'],
            long: ['https://avatars.charhub.io/avatars/uploads/images/gallery/file/6988bb9a-cf75-4cb0-a69a-8f2e0da1c991/538a4fe1-323c-4e48-8ed2-2bb01655f20e.png',
                    'https://avatars.charhub.io/avatars/uploads/images/gallery/file/1515acb6-2b77-46f3-aaf0-05954b19f2aa/162df5f2-6a0e-4110-b405-7b22de88327f.png',
                    'https://avatars.charhub.io/avatars/uploads/images/gallery/file/399d8121-efe4-4ea3-a754-61bc6d6e517c/f7c85249-ff35-4916-8f3c-5fde722213f8.png'],
            ponytail: ['https://avatars.charhub.io/avatars/uploads/images/gallery/file/a1344bb3-e4c0-44dc-9e9c-bcab60cc114b/bf5f068d-6940-4465-83a3-c1b1f83a52fb.png'],
        },
    },
    magic: {
        slim: {
            short: ['https://avatars.charhub.io/avatars/uploads/images/gallery/file/105e5a31-617e-4493-97f7-8c0daa216bcf/621b6f7d-dfc5-417d-95fe-32f31edcc908.png',
                'https://avatars.charhub.io/avatars/uploads/images/gallery/file/c279e106-9b40-43a9-9661-03a9889c5201/5bde0e30-9c3c-4fa7-a29e-59068b125b06.png',
                'https://avatars.charhub.io/avatars/uploads/images/gallery/file/cd86a01e-cc06-4091-bfc9-487b67822ef5/29f0f762-9a2b-4984-8623-7689b0a8fcbf.png',
                'https://avatars.charhub.io/avatars/uploads/images/gallery/file/ba0c0ca3-6db5-412f-95ea-42d8d5eb433b/eb1ab104-68f9-498d-9e61-9135dfdf5854.png'
            ],
            long: ['https://avatars.charhub.io/avatars/uploads/images/gallery/file/5ae9d93e-e114-4bdd-8d06-44d1a03d86e0/af8a3053-6e2a-44d4-969c-07c0d46770cd.png'],
            ponytail: ['https://avatars.charhub.io/avatars/uploads/images/gallery/file/71ab077f-491c-4afa-9333-340369e5e026/be8866fb-9085-484e-a63e-68f1f1b6c7f6.png',
                'https://avatars.charhub.io/avatars/uploads/images/gallery/file/ce72847c-028f-4d83-b17b-e59ebf6c6415/d54e52d9-aa06-48df-bfd7-d4189db2eb45.png'
            ],
        },
        average: {
            short: ['https://avatars.charhub.io/avatars/uploads/images/gallery/file/94dea1ef-55d9-4eaa-a56a-ff0923f110df/c23203f5-3200-4833-9dcc-bb2c73d14b3d.png',
                'https://avatars.charhub.io/avatars/uploads/images/gallery/file/ddc0dba1-005c-4332-ac30-ac46aa7ab161/517e33aa-a889-4d4e-963c-60db6b64976d.png'
            ],
            long: ['https://avatars.charhub.io/avatars/uploads/images/gallery/file/0306fa9a-e1fd-4784-a76b-679ddf1c47e4/7f7b742e-3be1-4664-9f16-1cafaeec711a.png',
                'https://avatars.charhub.io/avatars/uploads/images/gallery/file/0948967a-6d22-4ee2-8cbf-34e0dffb31af/463080e7-2b7c-409c-98f3-be727fd37f3b.png'
            ],
            ponytail: ['https://avatars.charhub.io/avatars/uploads/images/gallery/file/d350780e-1803-40a5-9fa4-7dcb3ff65335/d62af420-9be8-4d9a-adbb-7a96efb592ca.png',
                'https://avatars.charhub.io/avatars/uploads/images/gallery/file/613c66dc-43cb-43f2-9b1f-54e970e2fc3f/66750f18-dc6d-4359-a91d-3bebd1ce9602.png',
                'https://avatars.charhub.io/avatars/uploads/images/gallery/file/16ae942d-3b27-44f5-a791-2e746a6b6fad/c6f84c84-c76a-497c-bd5c-13493f256519.png'
            ],
        },
        curvy: {
            short: ['https://avatars.charhub.io/avatars/uploads/images/gallery/file/21e014c0-b618-4f78-90b0-0f33f254d276/4124efc6-f618-4cc2-8aef-bab3e368c069.png',
                'https://avatars.charhub.io/avatars/uploads/images/gallery/file/fe7b7f82-4b14-474c-9a23-b43280435437/fa5eb189-0c63-4e68-9380-2bc5669cb96f.png',
                'https://avatars.charhub.io/avatars/uploads/images/gallery/file/797af7a9-abc0-411c-a090-6d7f6a890360/c32addff-acd2-487f-8459-4b05f6f22d34.png'
            ],
            long: ['https://avatars.charhub.io/avatars/uploads/images/gallery/file/7bfa6c08-6a9c-451a-bbd7-b17c8598d34d/f8501796-f3ab-4900-b02d-ffb361890704.png',
                'https://avatars.charhub.io/avatars/uploads/images/gallery/file/3423a951-ca8b-4170-a0b2-7a313cf9742e/72c276b4-4dd5-4ff2-b21e-0236427027c9.png'
            ],
            ponytail: ['https://avatars.charhub.io/avatars/uploads/images/gallery/file/6ce8f81b-1602-40ba-87f4-abc09222a0a8/5b127f24-3d66-401d-8da1-504ceb63701e.png',
                'https://avatars.charhub.io/avatars/uploads/images/gallery/file/b412f078-33cd-485d-954e-a2f57ac1bf8c/b0a90247-b73d-482f-ae96-2dda5cb787c6.png'
            ],
        },
    },
};

export const DEMO_FULL_PATHS: ReadonlyArray<string> = [
    /*'Happy_Spanker/gilleandra-therys-f8b0da874905',
    'JakeH/merritrix-f72f6a2bab0a',
    'Happy_Spanker/aelara-veylin-3286274bad6b',
    'Happy_Spanker/elfie-elvenson-75bdd03bad56',
    'Happy_Spanker/crysthea-hellon-ebe30800bba3',
    'Happy_Spanker/eliara-2eaaa1e0cdd4',
    'JakeH/kalariel-ebonheart-a3388e951164',
    'Happy_Spanker/ena-riallath-69d68f3dcafb',
    'ErlkingC/ishe-dark-elf-assassin-077f6ba2962a',
    'Boy_Next_Door/nyrissa-the-runaway-slave-b376f6d5862c',
    'miyo_rin/sylvanetta-disaster-princess-15906b408451',
    'Kapot/Tittyana',
    'qwerty213/princess-elanore-7b56d66a',
    'turnip/hraide-3fc924ae',
    '_DeiV_/lyrei-the-failure-f-rank-is-a-cute-wood-elf-huntress-01a37a47dc6a',
    'EclispedHonor/ava-your-formerly-timid-best-friend-turned-popular-and-resentful-ap-15-0158d0964b77',
    'arachnutron/aubree-elven-emissary-9924cca42442',
    'miyo_rin/cleia-corporate-inquisitor-ef0f5f1c0b24',
    'Sugondees/claudia-5f243e9bfcdb',
    'BackdoorBarry/shortstack-neighbour-2dad6bb7',
    'xXxecksxXxD/amena-816f6eac597e',
    'Sexiam/vex-the-elf-pet-it-s-complicated-3c7037bb5647',
    'miyo_rin/nezraya-matron-mother-of-house-morvyth-19aea27c8346',
    'statuotw/arryn-the-knight-5843a0ee',
    'LilithVirty/lyssandra-the-ironwood-massacre-f191e66c0059',
    'AnonBrier/lyndis-the-vengeful-rogue-mistwater-chronicles-16e26ef00c66',*/
    '7leaf/claire-your-elf-mother-c304f9906eb7',
    'Sexiam/seraphis-darkspire-captured-elf-princess-spoils-of-war-3bbfa54a8921',
    'statuotw/shelara-the-elven-slave-3155631e',
    'marcnen/miriel-royal-handmaiden-74986d9734cd',
    'overheaven31/nylith-elven-diplomat-0e1ff181f6c3',
    'Exmortis/imra-aegis-vanguard-rescue-savior-version-f9b4102c287a',
    'MoistCrow_/neia-the-elf-267ab661',
    'DoktorB/kuroeda-0036c4f3',
    'Tearlament7/elf-slave-shana-40b0e01d30d4'
];

export const getElfPortrait = (type: UnitType, bodyType: BodyType, hairType: HairType): string => {
    const candidates = baseImages[type]?.[bodyType]?.[hairType] ?? [];
    if (candidates.length === 0) {
        return DEFAULT_ELF_IMAGE;
    }

    return candidates[Math.floor(Math.random() * candidates.length)] ?? DEFAULT_ELF_IMAGE;
};

export const unitFromTemplate = (template: UnitTemplate, index: number): Unit => ({
    name: template.name,
    type: template.type,
    bodyType: template.bodyType,
    hairType: template.hairType,
    cost: template.cost,
    attack: template.attack,
    health: template.health,
    shield: template.shield,
    id: `${template.name}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    imageUrl: template.imageUrl,
    portraitUrl: template.portraitUrl,
    flavor: template.flavor,
    deployLine: template.deployLine,
    killLine: template.killLine,
    waveLine: template.waveLine,
    deathLine: template.deathLine,
    deployLineUrl: template.deployLineUrl,
    killLineUrl: template.killLineUrl,
    waveLineUrl: template.waveLineUrl,
    deathLineUrl: template.deathLineUrl,
});

export const unitsFromTemplates = (templates: ReadonlyArray<UnitTemplate>): Unit[] => {
    return templates.map((template, index) => unitFromTemplate(template, index));
};

export async function generateUnitTemplateFromFullPath(fullPath: string, stage: Stage): Promise<UnitTemplate|null> {
    const response = await fetch(stage.characterDetailQuery.replace('{fullPath}', fullPath));
    const item = await response.json();
    const dataName = item.node.definition.name.replaceAll('{{char}}', item.node.definition.name).replaceAll('{{user}}', 'Individual X');
    console.log(item);

    const data = {
        name: dataName,
        personality: item.node.definition.personality.replaceAll('{{char}}', dataName).replaceAll('{{user}}', 'Individual X'),
        fullPath: item.node.fullPath,
        avatar: item.node.max_res_url,
    };
    return loadReserveUnitTemplate(data, stage);
}

const DEFAULT_STATS_BY_TYPE: Record<UnitType, Pick<UnitTemplate, 'cost' | 'attack' | 'health' | 'shield'>> = {
    melee: {cost: 3, attack: 2, health: 8, shield: 3},
    ranged: {cost: 2, attack: 2, health: 5, shield: 0},
    magic: {cost: 4, attack: 3, health: 4, shield: 0},
};

const DEFAULT_THEME_COLORS = ['#788ebdff', '#d3aa68ff', '#75c275ff', '#c28891ff', '#55bbb2ff'];

// Mapping of voice IDs to a description of the voice, so the AI can choose an ID based on the character profile.
export const VOICE_MAP: {[key: string]: string} = {
    '751212e5-a871-45c7-b10b-6f42a5785954': 'feminine - posh and catty',
    '03a438b7-ebfa-4f72-9061-f086d8f1fca6': 'feminine - calm and soothing',
    'a2533977-83cb-4c10-9955-0277e047538f': 'feminine - energetic and lively',
    '057d53b3-bb28-47f1-9c19-a85a79851863': 'feminine - low and warm',
    '6e6619ba-4880-4cf3-a5df-d0697ba46656': 'feminine - high and soft',
    'd6e05564-eea9-4181-aee9-fa0d7315f67d': 'masculine - cool and confident',
    'e6b74abb-f4b2-4a84-b9ef-c390512f2f47': 'masculine - posh and articulate',
    'bright_female_20s': 'feminine - bright and cheerful',
    'resonant_male_40s': 'masculine - resonant and mature',
    'gentle_female_30s': 'feminine - gentle and caring',
    'whispery_female_40s': 'feminine - whispery and mysterious',
    'formal_female_30s': 'feminine - formal and refined',
    'professional_female_30s': 'feminine - professional and direct',
    'calm_female_20s': 'feminine - calm and soothing',
    'light_male_20s': 'masculine - light and thoughtful',
    'animated_male_20s': 'masculine - hip and lively',
};

const sanitizeKey = (key: string): string => key.toLowerCase().replace(/[^a-z]/g, '');

const parseUnitType = (value: string | undefined): UnitType | null => {
    const normalized = (value ?? '').toLowerCase();
    if (normalized.includes('melee')) return 'melee';
    if (normalized.includes('ranged') || normalized.includes('range')) return 'ranged';
    if (normalized.includes('magic') || normalized.includes('mage')) return 'magic';
    return null;
};

const parseBodyType = (value: string | undefined): BodyType | null => {
    const normalized = (value ?? '').toLowerCase();
    if (normalized.includes('slim')) return 'slim';
    if (normalized.includes('average')) return 'average';
    if (normalized.includes('curvy')) return 'curvy';
    return null;
};

const parseHairType = (value: string | undefined): HairType | null => {
    const normalized = (value ?? '').toLowerCase();
    if (normalized.includes('ponytail') || normalized.includes('pony tail')) return 'ponytail';
    if (normalized.includes('short')) return 'short';
    if (normalized.includes('long')) return 'long';
    return null;
};

const parseStat = (value: string | undefined, fallback: number, min: number, max: number): number => {
    if (!value) return fallback;
    const match = value.match(/-?\d+/);
    if (!match) return fallback;
    const parsed = Number.parseInt(match[0], 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
};

const parseColor = (value: string | undefined): string => {
    const candidate = (value ?? '').trim();
    if (/^#([0-9A-F]{6}|[0-9A-F]{8})$/i.test(candidate)) {
        return candidate;
    }
    return DEFAULT_THEME_COLORS[Math.floor(Math.random() * DEFAULT_THEME_COLORS.length)];
};

const parseVoice = (value: string | undefined): string => {
    const candidate = (value ?? '').trim();
    if (!candidate) return '';
    return VOICE_MAP[candidate] ? candidate : '';
};

const parseStructuredFields = (resultText: string | undefined): Record<string, string> => {
    const lines = resultText?.split('\n').map((line: string) => line.trim()) || [];
    const parsedData: Record<string, string> = {};
    for (let line of lines) {
        line = line.replace(/\*\*/g, '');
        const colonIndex = line.indexOf(':');
        if (colonIndex <= 0) continue;
        const rawKey = line.substring(0, colonIndex).replace(/^[\s\-* .\d)]+/, '').trim();
        const key = sanitizeKey(rawKey);
        if (!key) continue;
        const value = line.substring(colonIndex + 1).trim();
        parsedData[key] = value;
    }

    return parsedData;
};

const cleanQuoteText = (value: string | undefined): string => {
    return (value ?? '').trim().replace(/^['"“”]+|['"“”]+$/g, '');
};

export async function loadReserveUnitTemplate(data: any, stage: Stage): Promise<UnitTemplate|null> {
    console.log('Loading reserve unit template:', data.name);
    console.log(data);

    // Attempt to substitute words to avert bad content into something more agreeable (if the distillation still has these, then drop the card).
    const bannedWordSubstitutes: {[key: string]: string} = {
        // Try to age up some terms in the hopes that the character can be salvaged.
        'underage': 'young adult',
        'adolescent': 'young adult',
        'youngster': 'young adult',
        'teen': 'young adult',
        'highschooler': 'young adult',
        'childhood': 'formative years',
        'childish': 'bratty',
        'child': 'young adult',
        // Don't bother with these; just set it to the same word so it gets discarded.
        'toddler': 'toddler',
        'infant': 'infant',
        // Assume that these words are being used in an innocuous way, unless they come back in the distillation.
        'kid': 'joke',
        'baby': 'honey',
        'minor': 'trivial',
        'old-school': 'retro',
        'high school': 'college',
        'school': 'college'};


    // Preserve content while removing JSON-like structures.
    data.name = data.name.replace(/{/g, '(').replace(/}/g, ')');
    data.personality = data.personality.replace(/{/g, '(').replace(/}/g, ')');

    // Apply banned word substitutions:
    for (const [bannedWord, substitute] of Object.entries(bannedWordSubstitutes)) {
        // Need to do a case-insensitive replacement for each occurrence:
        const regex = new RegExp(bannedWord, 'gi');
        data.name = data.name.replace(regex, substitute);
        data.personality = data.personality.replace(regex, substitute);
    }

    if (Object.keys(bannedWordSubstitutes).some(word => data.personality.toLowerCase().includes(word) || data.name.toLowerCase().includes(word))) {
        console.log(`Immediately discarding actor due to banned words: ${data.name}`);
        return null;
    } else if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(`${data.name}${data.personality}`)) {
        console.log(`Immediately discarding actor due to non-english characters: ${data.name}`);
        return null;
    }

    const gamePremise =
        `This is a tower-defense strategy game in which the player manages elven warriors as they defend their homeland from invading forces. ` +
        `This existential threat has drawn elves from all over the universe to defend their realm. The player randomly draws cards representing these elves and can deploy them to the battlefield.`;

    // Take this data and use text generation to get an updated distillation of this character, including a physical description.
    const generatedResponse = await stage.generator.textGen({
        prompt: `{{messages}}This is preparatory request for structured and formatted game content.` +
            `\n\nBackground: ${gamePremise} ` +
            `\n\nThe Original Details below describe an elf or scenario (${data.name}) to convert into one of these cards, representing a unit on the battlefield. ` +
            `This request and response must digest and distill these details to suit the game's narrative scenario, ` +
            `crafting a unit who is prepared to fight for the elven homeland. First, determine the best suited unit type: Ranged (bow and arrow), Melee (sword), or Magic (staff). ` +
            `Describe the characters physical appearance: skin tone, hair color/style, eye color, outfit, and other distinguishing features.` +
            `\n\n` +
            `The provided Original Details may reference 'Individual X' who was a part of their original background; ` +
            `if Individual X remains relevant to this character, Individual X should be replaced with an appropriate name in the distillation below.\n\n` +
            `Original Details about ${data.name}:\n ${data.personality}\n\n` +
            `Available Voices:\n` +
            Object.entries(VOICE_MAP).map(([voiceId, voiceDesc]) => '  - ' + voiceId + ': ' + voiceDesc).join('\n') +
            `\n\n` +
            `Instructions: After carefully considering this description and the rules provided, generate a concise breakdown for a character based upon these details in the following strict format:\n` +
            `System: NAME: Their simple name\n` +
            `UNIT TYPE: MELEE, RANGED, or MAGIC, based on their personality and background. Choose the one that best fits their character and story.\n` +
            `BODY TYPE: SLIM, AVERAGE, or CURVY, based on their physical description and personality.\n` +
            `HAIR TYPE: SHORT, LONG, or PONYTAIL, based on their physical description and personality.\n` +
            `COST: Integer 1-8 representing deployment cost.\n` +
            `ATTACK: Integer 1-3 representing offensive power.\n` +
            `HEALTH: Integer 3-8 representing maximum HP.\n` +
            `SHIELD: Integer 0-3 representing armor or shield points.\n` +
            `VOICE: Output one specific voice ID from Available Voices that best matches the character.\n` +
            `COLOR: A hex color that reflects the character's theme or mood and contrasts with light text.\n` +
            `DESCRIPTION: A vivid description of the character's physical appearance, attire, and any distinguishing features.\n` +
            `PROFILE: A brief summary of the character's observable surface-level personality traits, mannerisms, and public persona. Focus on what others would notice immediately about them.\n` +
            `FLAVOR: A brief quote reflecting the character's style or personality—to be used as a blurb on their card.\n` +
            `#END#\n\n` +
            `Example Response:\n` +
            `NAME: Jane Doe\n` +
            `UNIT TYPE: MELEE\n` +
            `BODY TYPE: AVERAGE\n` +
            `HAIR TYPE: SHORT\n` +
            `COST: 3\n` +
            `ATTACK: 2\n` +
            `HEALTH: 8\n` +
            `SHIELD: 3\n` +
            `VOICE: 03a438b7-ebfa-4f72-9061-f086d8f1fca6\n` +
            `COLOR: #333333\n` +
            `DESCRIPTION: A tall, athletic woman with short, dark hair and piercing blue eyes. She wears a simple, utilitarian outfit made from durable materials.\n` +
            `PROFILE: Jane is confident and determined, quick-witted, and fiercely independent. She has sharp wit and isn't afraid to speak her mind.\n` +
            `FLAVOR: "I don't have time for nonsense."\n` +
            `#END#`,
        stop: ['#END'],
        include_history: true, // There won't be any history, but if this is true, the front-end doesn't automatically apply pre-/post-history prompts.
        max_tokens: 500,
    });
    console.log('Generated character distillation:');
    console.log(generatedResponse);
    const parsedData = parseStructuredFields(generatedResponse?.result);


    const unitType = parseUnitType(parsedData['unittype'] || parsedData['type']) || 'melee';
    const bodyType = parseBodyType(parsedData['bodytype'] || parsedData['body']) || 'average';
    const hairType = parseHairType(parsedData['hairtype'] || parsedData['hair']) || 'long';
    const fallbackType = unitType ?? 'ranged';
    const defaultStats = DEFAULT_STATS_BY_TYPE[fallbackType];
    const unitDescription = {
        'melee': 'a longsword.',
        'ranged': 'a bow and quiver of arrows.',
        'magic': 'a mystical staff.',
    }
    const bodyDescription = {
        'slim': 'slender build',
        'average': 'athletic build',
        'curvy': 'curvy figure',
    }
    const hairDescription = {
        'short': 'short blonde hair',
        'long': 'long blonde hair',
        'ponytail': 'a blonde ponytail',
    }

    // Build a core description based on types:
    const coreDescription = `This character has a naked ${bodyDescription[bodyType]} with ${hairDescription[hairType]}, wielding ${unitDescription[unitType]}.`;

    const [imagePromptResponse, quotesResponse] = await Promise.all([
        // Generate image prompt based on description. Use the description from above and prompt a bullet-pointed breakdown of key features for a concise image prompt.
        stage.generator.textGen({
            prompt: `{{messages}}This is a preparatory request for generating an image prompt based on a character description. ` +
                `The character description is intended to be used for generating a portrait image of a character in a tower-defense strategy game. ` +
                `The description may include details about the character's physical appearance, attire, and distinguishing features. ` +
                `Your task is to analyze the provided character description and extract key visual elements that can be used to create a concise and effective image prompt for an AI image generator. ` +
                `Focus on identifying specific attributes such as clothing style, color scheme, accessories, facial features, and any unique characteristics mentioned in the description. ` +
                `The output should be a bullet-pointed list of these key visual elements that can guide the creation of the character's portrait. ` +
                `Focus on listing details that are a departure from the default description: ${coreDescription}.\n\n` +
                `Character Physical Description:\n${parsedData['description'] || ''}\n\n` +
                `Example Output:\n` +
                `- dark hair\n` +
                `- Blue eyes\n` +
                `- Simple, utilitarian outfit made from durable materials\n` +
                `- Confident and determined expression\n` +
                `- Combat boots\n` +
                `#END#`,
            stop: ['#END'],
            include_history: true,
            max_tokens: 150,
        }),
        stage.generator.textGen({
            prompt: `{{messages}}This is a follow-up request for short in-game situational character voice lines.` +
                `\n\nGame Premise:\n${gamePremise}` +
                `\n\nCharacter Name: ${parsedData['name'] || data.name}` +
                `\nCharacter Description: ${parsedData['description'] || ''}` +
                `\nCharacter Personality/Profile: ${parsedData['profile'] || data.personality}` +
                `\n\nEnemy context: The enemies are generally disgusting human men invading the elven homeland.` +
                `\n\nGenerate four brief lines in this strict format:` +
                `\nDEPLOY LINE: one short line spoken when this character is deployed.` +
                `\nKILL LINE: one short line spoken when this character defeats an enemy.` +
                `\nWAVE LINE: one short line spoken when a wave begins.` +
                `\nDEATH LINE: one short line spoken when this character is defeated by an enemy.` +
                `\n#END#`,
            stop: ['#END'],
            include_history: true,
            max_tokens: 220,
        }),
    ]);
    console.log('Generated image prompt breakdown:');
    console.log(imagePromptResponse);
    const imagePrompt = (imagePromptResponse?.result || '').split('\n').map(line => line.replace(/^-+\s*/, '-').trim()).filter(line => line.length > 0).join('\n') || parsedData['description'] || '';

    console.log('Generated situational quote lines:');
    console.log(quotesResponse);
    const parsedQuotes = parseStructuredFields(quotesResponse?.result);

    const baseUrl = getElfPortrait(unitType ?? 'ranged', bodyType ?? 'average', hairType ?? 'short');


    const quoteUrls: Record<string, string> = await Promise.all(Object.entries(parsedQuotes).filter(([key, value]) => value && value.length > 0).map(async ([key, transcript]) => {
                    try {
                        const ttsResponse = await stage.generator.speak({
                            transcript: cleanQuoteText(transcript),
                            voice_id: parseVoice(parsedData['voice']),
                        });
                        if (ttsResponse && ttsResponse.url) {
                            return [key, ttsResponse.url] as [string, string];
                        } else {
                            return [key, ''] as [string, string];
                        }
                    } catch (err) {
                        console.error('Error generating TTS:', err);
                        return [key, ''] as [string, string];
                    }
                })).then(Object.fromEntries);
    console.log(quoteUrls);


    const newUnitTemplate: UnitTemplate = {
        name: (parsedData['name'] || data.name || '').replace(/["“”]/g, "'"),
        type: unitType ?? fallbackType,
        bodyType: bodyType ?? 'average',
        hairType: hairType ?? 'short',
        description: parsedData['description'] || '',
        persona: parsedData['profile'] || '',
        flavor: parsedData['flavor'] || '',
        cost: parseStat(parsedData['cost'], defaultStats.cost, 1, 8),
        attack: parseStat(parsedData['attack'], defaultStats.attack, 1, 3),
        health: parseStat(parsedData['health'] || parsedData['hp'], defaultStats.health, 3, 8),
        shield: parseStat(parsedData['shield'] || parsedData['armor'], defaultStats.shield, 0, 3),
        voice: parseVoice(parsedData['voice']),
        color: parseColor(parsedData['color']),
        portraitUrl: data.avatar || baseUrl,
        imageUrl: baseUrl,
        deployLine: cleanQuoteText(parsedQuotes['deployline'] || '') || '',
        deployLineUrl: quoteUrls['deployline'],
        killLine: cleanQuoteText(parsedQuotes['killline'] || '') || '',
        killLineUrl: quoteUrls['killline'],
        waveLine: cleanQuoteText(parsedQuotes['waveline'] || '') || '',
        waveLineUrl: quoteUrls['waveline'],
        deathLine: cleanQuoteText(parsedQuotes['deathline'] || '') || '',
        deathLineUrl: quoteUrls['deathline'],
    };

    newUnitTemplate.imageUrl = await generateUnitImage(newUnitTemplate, imagePrompt, stage);

    console.log(`Loaded new unit template: ${newUnitTemplate.name}`);
    console.log(newUnitTemplate);

    const unitTextToValidate = [
        newUnitTemplate.name,
        parsedData['description'] || '',
        parsedData['profile'] || '',
        parsedData['flavor'] || ''
    ].join(' ').toLowerCase();

    if (!newUnitTemplate.name) {
        console.log(`Discarding unit template due to missing name: ${newUnitTemplate.name}`);
        return null;
    } else if (!unitType) {
        console.log(`Discarding unit template due to invalid unit type: ${newUnitTemplate.name}`);
        return null;
    } else if (!bodyType) {
        console.log(`Discarding unit template due to invalid body type: ${newUnitTemplate.name}`);
        return null;
    } else if (!hairType) {
        console.log(`Discarding unit template due to invalid hair type: ${newUnitTemplate.name}`);
        return null;
    } else if (Object.keys(bannedWordSubstitutes).some(word => unitTextToValidate.includes(word))) {
        console.log(`Discarding unit template due to banned words: ${newUnitTemplate.name}`);
        return null;
    } else if (newUnitTemplate.name.length <= 2 || newUnitTemplate.name.length >= 40) {
        console.log(`Discarding unit template due to extreme name length: ${newUnitTemplate.name}`);
        return null;
    } else if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test([newUnitTemplate.name, parsedData['description'] || '', parsedData['profile'] || ''].join(''))) {
        console.log(`Discarding unit template due to non-english characters in key fields: ${newUnitTemplate.name}`);
        return null;
    }

    return newUnitTemplate;
}

async function generateUnitImage(unitTemplate: UnitTemplate, imagePrompt: string, stage: Stage): Promise<string> {
    console.log(`Generating image for unit ${unitTemplate.name}: ${imagePrompt}`);

    try {
        const newImageUrl = (await stage.generator.imageToImage(
            {
                image: unitTemplate.imageUrl,
                prompt: `Update this character's outfit and appearance:\n${imagePrompt}\n` +
                `Maintain the existing art style and white outline.`,
                transfer_type: 'edit'
            }))?.url ?? unitTemplate.imageUrl;

        try {
            const response = await stage.generator.removeBackground({image: newImageUrl});
            return response?.url ?? unitTemplate.imageUrl;
        } catch (error) {
            console.error(`Error removing background`, error);
        }
    } catch (exception: any) {
        console.error(`Failed to generate image for unit ${unitTemplate.name}:`, exception);
    }
    return unitTemplate.imageUrl;
}


/**
 * Calculate a similarity score between two names. Higher scores indicate better matches.
 * Returns a value between 0 and 1, where 1 is a perfect match.
 * @param name The reference name
 * @param possibleName The name to compare against
 * @returns A similarity score between 0 and 1
 */
export function getNameSimilarity(name: string, possibleName: string): number {
    name = name.toLowerCase();
    possibleName = possibleName.toLowerCase();

    // Exact match gets perfect score
    if (name === possibleName) {
        return 1.0;
    }

    // Check word-based matching first (higher priority)
    const names = name.split(' ');
    const possibleNames = possibleName.split(' ');
    
    // Count matching words
    let matchingWords = 0;
    for (const namePart of names) {
        if (possibleName.includes(namePart)) {
            matchingWords++;
        }
    }
    
    // If we have good word matches, prioritize that
    const wordMatchRatio = matchingWords / names.length;
    if (wordMatchRatio >= 0.5) {
        // Boost score for word matches, scaled by the ratio
        return 0.7 + (wordMatchRatio * 0.3);
    }

    // Use Levenshtein distance for fuzzy matching
    const matrix = Array.from({ length: name.length + 1 }, () => Array(possibleName.length + 1).fill(0));
    for (let i = 0; i <= name.length; i++) {
        for (let j = 0; j <= possibleName.length; j++) {
            if (i === 0) {
                matrix[i][j] = j;
            } else if (j === 0) {
                matrix[i][j] = i;
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + (name[i - 1] === possibleName[j - 1] ? 0 : 1)
                );
            }
        }
    }
    
    const distance = matrix[name.length][possibleName.length];
    const maxLength = Math.max(name.length, possibleName.length);
    
    // Convert distance to similarity (0 to 1)
    return Math.max(0, 1 - (distance / maxLength));
}

/**
 * Find the best matching name from a list of candidates.
 * @param searchName The name to search for
 * @param candidates An array of objects with name properties
 * @returns The best matching candidate, or null if no good match is found
 */
export function findBestNameMatch<T extends { name: string }>(
    searchName: string,
    candidates: T[]
): T | null {
    if (!searchName || candidates.length === 0) {
        return null;
    }

    let bestMatch: T | null = null;
    let bestScore = 0;
    const threshold = 0.7; // Minimum similarity threshold

    for (const candidate of candidates) {
        const score = getNameSimilarity(candidate.name, searchName);
        // Only consider matches above threshold
        if (score > threshold && score > bestScore) {
            bestScore = score;
            bestMatch = candidate;
        }
    }

    return bestMatch;
}