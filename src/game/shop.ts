export type PlayerSkinStyle =
  | 'classic'
  | 'custom'
  | 'menor_aprendiz'
  | 'estagiario_chefe'
  | 'estagiario_ninja'
  | 'motoboy_turbinado'
  | 'golden_exec'
  | 'night_brawler'
  | 'cyber_rush';

export type ShopCategory = 'custom' | 'perk' | 'garage';

export type GarageGender = 'male' | 'female';
export type GarageHairStyle = 'pompadour' | 'spiky' | 'afro' | 'ponytail';
export type GarageNeonKey = 'neon_green' | 'neon_pink' | 'neon_cyan' | 'neon_yellow';
export type GarageSlot = 'hairColor' | 'tieColor' | 'backpackColor';

export interface GarageConfig {
  gender: GarageGender;
  hairStyle: GarageHairStyle;
  hairColor: string;
  tieColor: string;
  backpackColor: string;
}

export interface GarageSwatchDef {
  key: string;
  label: string;
  main: string;
  dark: string;
  highlight: string;
  isNeon?: boolean;
  shopItemId?: string;
}

export const GARAGE_COLOR_DEFS: Record<string, GarageSwatchDef> = {
  // Free classic colors
  dark_navy: { key: 'dark_navy', label: 'Azul Noturno', main: '#0f1326', dark: '#020617', highlight: '#475569' },
  chestnut: { key: 'chestnut', label: 'Castanho', main: '#78350f', dark: '#451a03', highlight: '#b45309' },
  black: { key: 'black', label: 'Preto', main: '#1e293b', dark: '#090d16', highlight: '#475569' },
  blonde: { key: 'blonde', label: 'Loiro', main: '#eab308', dark: '#a16207', highlight: '#fef08a' },
  burgundy: { key: 'burgundy', label: 'Borgonha', main: '#881337', dark: '#4c0519', highlight: '#e11d48' },
  white: { key: 'white', label: 'Branco', main: '#f1f5f9', dark: '#94a3b8', highlight: '#ffffff' },
  sky_blue: { key: 'sky_blue', label: 'Azul Claro', main: '#bae6fd', dark: '#0284c7', highlight: '#f0f9ff' },
  charcoal: { key: 'charcoal', label: 'Grafite', main: '#475569', dark: '#1e293b', highlight: '#94a3b8' },
  cream: { key: 'cream', label: 'Creme', main: '#fef3c7', dark: '#d97706', highlight: '#fffbeb' },
  crimson: { key: 'crimson', label: 'Vermelho', main: '#dc2626', dark: '#991b1b', highlight: '#f87171' },
  royal_blue: { key: 'royal_blue', label: 'Azul Royal', main: '#1d4ed8', dark: '#0f172a', highlight: '#3b82f6' },
  gold: { key: 'gold', label: 'Dourado', main: '#eab308', dark: '#a16207', highlight: '#fef08a' },
  emerald: { key: 'emerald', label: 'Verde', main: '#16a34a', dark: '#14532d', highlight: '#4ade80' },
  navy: { key: 'navy', label: 'Jeans Escuro', main: '#475569', dark: '#1e2b58', highlight: '#6076b8' },
  khaki: { key: 'khaki', label: 'Cáqui', main: '#a16207', dark: '#713f12', highlight: '#ca8a04' },
  olive: { key: 'olive', label: 'Verde Oliva', main: '#4d7c0f', dark: '#1a2e05', highlight: '#84cc16' },
  orange: { key: 'orange', label: 'Laranja', main: '#ea580c', dark: '#9a3412', highlight: '#fb923c' },
  // 4 Neon unlockable colors (1.000 Fichas each)
  neon_green: {
    key: 'neon_green',
    label: 'Verde Tóxico',
    main: '#22c55e',
    dark: '#15803d',
    highlight: '#86efac',
    isNeon: true,
    shopItemId: 'garage_neon_green',
  },
  neon_pink: {
    key: 'neon_pink',
    label: 'Rosa Choque',
    main: '#ec4899',
    dark: '#9d174d',
    highlight: '#f9a8d4',
    isNeon: true,
    shopItemId: 'garage_neon_pink',
  },
  neon_cyan: {
    key: 'neon_cyan',
    label: 'Ciano Elétrico',
    main: '#06b6d4',
    dark: '#0e7490',
    highlight: '#67e8f9',
    isNeon: true,
    shopItemId: 'garage_neon_cyan',
  },
  neon_yellow: {
    key: 'neon_yellow',
    label: 'Amarelo Volt',
    main: '#facc15',
    dark: '#a16207',
    highlight: '#fef08a',
    isNeon: true,
    shopItemId: 'garage_neon_yellow',
  },
};

export const GARAGE_NEON_KEYS: GarageNeonKey[] = [
  'neon_green',
  'neon_pink',
  'neon_cyan',
  'neon_yellow',
];

export const GARAGE_FREE_COLORS: Record<GarageSlot, string[]> = {
  hairColor: ['dark_navy', 'chestnut', 'black', 'blonde', 'burgundy'],
  tieColor: ['crimson', 'royal_blue', 'gold', 'emerald', 'black'],
  backpackColor: ['royal_blue', 'crimson', 'black', 'olive', 'orange'],
};

export const GARAGE_HAIR_DEFS: Array<{
  id: GarageHairStyle;
  label: string;
  shopItemId?: string;
}> = [
  { id: 'pompadour', label: 'Topete Clássico' },
  { id: 'spiky', label: 'Espetado', shopItemId: 'garage_hair_spiky' },
  { id: 'afro', label: 'Black Power', shopItemId: 'garage_hair_afro' },
  { id: 'ponytail', label: 'Rabo de Cavalo', shopItemId: 'garage_hair_ponytail' },
];

export const DEFAULT_GARAGE_CONFIG: GarageConfig = {
  gender: 'male',
  hairStyle: 'pompadour',
  hairColor: 'dark_navy',
  tieColor: 'crimson',
  backpackColor: 'royal_blue',
};

export interface ShopItemDefinition {
  id: string;
  category: ShopCategory;
  name: string;
  subtitle: string;
  description: string;
  price: number;
  skinStyle?: PlayerSkinStyle;
  unlockHairStyle?: GarageHairStyle;
  unlockNeonColor?: GarageNeonKey;
  unlockGender?: boolean;
  maxHpBonus?: number;
  startingCredits?: number;
  startingCane?: number;
  startingDeodorant?: number;
  buffDurationBonus?: number;
  damageMultBonus?: number;
  startingEnergy?: number;
  specialReachBonus?: number;
  ticketDiscount?: number;
  coinBonusMult?: number;
  startingSpeedBonus?: number;
}

export interface ShopState {
  coins: number;
  ownedIds: string[];
  equippedSkin: PlayerSkinStyle;
  garage: GarageConfig;
}

export interface InfiniteRecord {
  bestScore: number;
  bestWave: number;
}

export interface ActiveShopLoadout {
  equippedSkin: PlayerSkinStyle;
  garage: GarageConfig;
  maxHpBonus: number;
  startingCredits: number;
  startingCane: number;
  startingDeodorant: number;
  buffDurationBonus: number;
  damageMultBonus: number;
  startingEnergy: number;
  specialReachBonus: number;
  ticketDiscount: number;
  coinBonusMult: number;
  startingSpeedBonus: number;
}

const STORAGE_KEY = 'horario_de_pico_shop_v1';
const INFINITE_RECORD_KEY = 'horario_de_pico_infinite_v1';
const CAMPAIGN_BEST_KEY = 'horario_de_pico_campaign_best_v1';
const BEST_HITS_KEY_PREFIX = 'horario_de_pico_best_hits_v1_';
const INITIAL_WELCOME_COINS = 180;

export const SHOP_CATALOG: ShopItemDefinition[] = [
  {
    id: 'skin_classic',
    category: 'custom',
    name: 'Uniforme Estagiário',
    subtitle: 'Visual Padrão · Camisa & Gravata Vermelha',
    description: 'Visual clássico do escritório com gravata vermelha e mochila azul.',
    price: 0,
    skinStyle: 'classic',
  },
  {
    id: 'skin_menor_aprendiz',
    category: 'custom',
    name: 'Menor Aprendiz',
    subtitle: 'Visual Personalizado · Camiseta Branca SENAI',
    description: 'Camiseta branca oficial do SENAI com logo vermelho no peito e bandeira do Brasil na manga.',
    price: 60,
    skinStyle: 'menor_aprendiz',
  },
  {
    id: 'skin_estagiario_chefe',
    category: 'custom',
    name: 'Estagiário Chefe',
    subtitle: 'Visual Personalizado · Terno Completo',
    description: 'Terno escuro sob medida com lapela marcada, camisa social branca e gravata de chefia.',
    price: 140,
    skinStyle: 'estagiario_chefe',
  },
  {
    id: 'skin_estagiario_ninja',
    category: 'custom',
    name: 'Estagiário Ninja',
    subtitle: 'Visual Personalizado · Gravata na Cabeça',
    description: 'Traje ninja furtivo com máscara de pano e a gravata amarrada na testa como faixa shinobi.',
    price: 150,
    skinStyle: 'estagiario_ninja',
  },
  {
    id: 'skin_motoboy_turbinado',
    category: 'custom',
    name: 'Motoboy do Terminal',
    subtitle: 'Visual Personalizado · Corta-Vento & Bag Térmica',
    description: 'Jaqueta refletiva neon de entregas, capacete aberto e mochila térmica reforçada.',
    price: 170,
    skinStyle: 'motoboy_turbinado',
  },
  {
    id: 'skin_golden_exec',
    category: 'custom',
    name: 'Executivo Dourado',
    subtitle: 'Visual Personalizado · Gravata Ouro',
    description: 'Paletó grafite, gravata dourada e mochila executiva reforçada.',
    price: 80,
    skinStyle: 'golden_exec',
  },
  {
    id: 'skin_night_brawler',
    category: 'custom',
    name: 'Jaqueta da Madrugada',
    subtitle: 'Visual Personalizado · Couro Noturno',
    description: 'Jaqueta preta de couro, detalhes carmesim e cinto metálico.',
    price: 120,
    skinStyle: 'night_brawler',
  },
  {
    id: 'skin_cyber_rush',
    category: 'custom',
    name: 'Expresso Neon 303',
    subtitle: 'Visual Personalizado · Visor & Mochila Ciano',
    description: 'Visor noturno iluminado, mochila turbo neon e gravata elétrica.',
    price: 160,
    skinStyle: 'cyber_rush',
  },
  {
    id: 'gear_bengala_inicial',
    category: 'custom',
    name: 'Bengala Dobrável',
    subtitle: 'Equipamento de Embarque · +4 Cargas',
    description: 'Comece toda viagem armado com 4 golpes de bengala de longo alcance.',
    price: 70,
    startingCane: 4,
  },
  {
    id: 'gear_spray_inicial',
    category: 'custom',
    name: 'Kit Spray Frescor',
    subtitle: 'Equipamento de Embarque · +2 Desodorantes',
    description: 'Inicie a partida com 2 sprays prontos contra operários fedorentos.',
    price: 90,
    startingDeodorant: 2,
  },
  {
    id: 'gear_garrafa_cafe',
    category: 'custom',
    name: 'Garrafa de Café',
    subtitle: 'Equipamento de Embarque · +Velocidade & +25 Especial',
    description: 'Embarque ligado no 220v com impulso de velocidade e barra de especial adiantada.',
    price: 95,
    startingSpeedBonus: 8,
    startingEnergy: 25,
  },
  {
    id: 'perk_cafe_expresso',
    category: 'perk',
    name: 'Café Expresso Duplo',
    subtitle: 'Vantagem Permanente · +25 HP Máximo',
    description: 'Aumenta a barra de vida máxima de 105 para 130 em todas as linhas.',
    price: 100,
    maxHpBonus: 25,
  },
  {
    id: 'perk_passe_livre',
    category: 'perk',
    name: 'Bilhete Recarregado',
    subtitle: 'Vantagem Permanente · +3 Créditos Iniciais',
    description: 'Embarque já com 3 créditos para validar a catraca ou comprar na banca.',
    price: 80,
    startingCredits: 3,
  },
  {
    id: 'perk_fones_turbinados',
    category: 'perk',
    name: 'Fones Turbinados',
    subtitle: 'Vantagem Permanente · +40 Energia & +20% Alcance Especial',
    description: 'Comece com 40% da barra de Especial carregada e amplie o raio da Explosão Sonora.',
    price: 125,
    startingEnergy: 40,
    specialReachBonus: 0.2,
  },
  {
    id: 'perk_cracha_vip',
    category: 'perk',
    name: 'Crachá VIP do Terminal',
    subtitle: 'Vantagem Permanente · Desconto na Catraca & +15% Fichas',
    description: 'Reduz o custo do validador em 1 crédito e rende 15% mais Fichas após cada partida.',
    price: 145,
    ticketDiscount: 1,
    coinBonusMult: 0.15,
  },
  {
    id: 'perk_energetico',
    category: 'perk',
    name: 'Energético Concentrado',
    subtitle: 'Vantagem Permanente · +4s nos Buffs',
    description: 'Estende em 4 segundos a duração dos buffs de Força e Escudo de Mochila.',
    price: 130,
    buffDurationBonus: 4,
  },
  {
    id: 'perk_punho_aco',
    category: 'perk',
    name: 'Punho de Aço',
    subtitle: 'Vantagem Permanente · +15% de Dano',
    description: 'Aumenta em 15% o dano base de socos, chutes, aéreos e especiais.',
    price: 150,
    damageMultBonus: 0.15,
  },
  // Garagem & Estilo unlocks (estéticos)
  {
    id: 'garage_hair_spiky',
    category: 'garage',
    name: 'Corte Espetado',
    subtitle: 'Garagem · Novo Corte de Cabelo',
    description: 'Libera o corte espetado estilo punk/moicano urbano para personalizar na Garagem.',
    price: 1000,
    unlockHairStyle: 'spiky',
  },
  {
    id: 'garage_hair_afro',
    category: 'garage',
    name: 'Corte Black Power',
    subtitle: 'Garagem · Novo Corte de Cabelo',
    description: 'Libera o corte Black Power volumoso em 16-bit para usar na Garagem.',
    price: 1000,
    unlockHairStyle: 'afro',
  },
  {
    id: 'garage_hair_ponytail',
    category: 'garage',
    name: 'Corte Rabo de Cavalo',
    subtitle: 'Garagem · Novo Corte de Cabelo',
    description: 'Libera o cabelo longo preso em rabo de cavalo dinâmico para a Garagem.',
    price: 1000,
    unlockHairStyle: 'ponytail',
  },
  {
    id: 'garage_neon_green',
    category: 'garage',
    name: 'Neon Verde Tóxico',
    subtitle: 'Garagem · Paleta Neon Vibrante',
    description: 'Libera a cor neon Verde Tóxico para cabelo, gravata e mochila.',
    price: 1000,
    unlockNeonColor: 'neon_green',
  },
  {
    id: 'garage_neon_pink',
    category: 'garage',
    name: 'Neon Rosa Choque',
    subtitle: 'Garagem · Paleta Neon Vibrante',
    description: 'Libera a cor neon Rosa Choque para cabelo, gravata e mochila.',
    price: 1000,
    unlockNeonColor: 'neon_pink',
  },
  {
    id: 'garage_neon_cyan',
    category: 'garage',
    name: 'Neon Ciano Elétrico',
    subtitle: 'Garagem · Paleta Neon Vibrante',
    description: 'Libera a cor neon Ciano Elétrico para cabelo, gravata e mochila.',
    price: 1000,
    unlockNeonColor: 'neon_cyan',
  },
  {
    id: 'garage_neon_yellow',
    category: 'garage',
    name: 'Neon Amarelo Volt',
    subtitle: 'Garagem · Paleta Neon Vibrante',
    description: 'Libera a cor neon Amarelo Volt para cabelo, gravata e mochila.',
    price: 1000,
    unlockNeonColor: 'neon_yellow',
  },
  {
    id: 'garage_gender_switch',
    category: 'garage',
    name: 'Troca de Gênero (Estagiária)',
    subtitle: 'Garagem · Personagem Feminina',
    description: 'Desbloqueia a opção de alternar entre Estagiário e Estagiária na Garagem, HUD e cutscenes.',
    price: 3000,
    unlockGender: true,
  },
];

export function isGarageHairUnlocked(ownedIds: string[], style: GarageHairStyle): boolean {
  if (style === 'pompadour') return true;
  const def = GARAGE_HAIR_DEFS.find((h) => h.id === style);
  return def?.shopItemId ? ownedIds.includes(def.shopItemId) : false;
}

export function isGarageColorUnlocked(ownedIds: string[], colorKey: string): boolean {
  const def = GARAGE_COLOR_DEFS[colorKey];
  if (!def) return false;
  if (!def.shopItemId) return true;
  return ownedIds.includes(def.shopItemId);
}

export function isGarageGenderUnlocked(ownedIds: string[], gender: GarageGender): boolean {
  if (gender === 'male') return true;
  return ownedIds.includes('garage_gender_switch');
}

export function getGarageSwatchDef(key: string, fallbackKey = 'white'): GarageSwatchDef {
  return GARAGE_COLOR_DEFS[key] ?? GARAGE_COLOR_DEFS[fallbackKey] ?? GARAGE_COLOR_DEFS.white;
}

export function sanitizeGarageConfig(
  config: Partial<GarageConfig> | undefined,
  ownedIds: string[]
): GarageConfig {
  const gender: GarageGender =
    config?.gender === 'female' && isGarageGenderUnlocked(ownedIds, 'female') ? 'female' : 'male';
  const rawHair = config?.hairStyle;
  const hairStyle: GarageHairStyle =
    (rawHair === 'pompadour' || rawHair === 'spiky' || rawHair === 'afro' || rawHair === 'ponytail') &&
    isGarageHairUnlocked(ownedIds, rawHair)
      ? rawHair
      : DEFAULT_GARAGE_CONFIG.hairStyle;

  const pickColor = (key: string | undefined, slot: GarageSlot, defVal: string) => {
    if (!key) return defVal;
    const allowed = new Set([...GARAGE_FREE_COLORS[slot], ...GARAGE_NEON_KEYS]);
    if (allowed.has(key) && isGarageColorUnlocked(ownedIds, key)) {
      return key;
    }
    return defVal;
  };

  return {
    gender,
    hairStyle,
    hairColor: pickColor(config?.hairColor, 'hairColor', DEFAULT_GARAGE_CONFIG.hairColor),
    tieColor: pickColor(config?.tieColor, 'tieColor', DEFAULT_GARAGE_CONFIG.tieColor),
    backpackColor: pickColor(config?.backpackColor, 'backpackColor', DEFAULT_GARAGE_CONFIG.backpackColor),
  };
}

const DEFAULT_STATE: ShopState = {
  coins: INITIAL_WELCOME_COINS,
  ownedIds: ['skin_classic'],
  equippedSkin: 'classic',
  garage: { ...DEFAULT_GARAGE_CONFIG },
};

export function loadShopState(): ShopState {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_STATE, garage: { ...DEFAULT_GARAGE_CONFIG } };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_STATE));
      return { ...DEFAULT_STATE, garage: { ...DEFAULT_GARAGE_CONFIG } };
    }
    const parsed = JSON.parse(raw) as Partial<ShopState>;
    const owned = Array.isArray(parsed.ownedIds) ? [...parsed.ownedIds] : ['skin_classic'];
    if (!owned.includes('skin_classic')) owned.push('skin_classic');
    const uniqueOwned = Array.from(new Set(owned));
    return {
      coins: typeof parsed.coins === 'number' && parsed.coins >= 0 ? Math.floor(parsed.coins) : INITIAL_WELCOME_COINS,
      ownedIds: uniqueOwned,
      equippedSkin:
        parsed.equippedSkin === 'custom' ||
        parsed.equippedSkin === 'menor_aprendiz' ||
        parsed.equippedSkin === 'estagiario_chefe' ||
        parsed.equippedSkin === 'estagiario_ninja' ||
        parsed.equippedSkin === 'motoboy_turbinado' ||
        parsed.equippedSkin === 'golden_exec' ||
        parsed.equippedSkin === 'night_brawler' ||
        parsed.equippedSkin === 'cyber_rush'
          ? parsed.equippedSkin
          : 'classic',
      garage: sanitizeGarageConfig(parsed.garage, uniqueOwned),
    };
  } catch {
    return { ...DEFAULT_STATE, garage: { ...DEFAULT_GARAGE_CONFIG } };
  }
}

export function saveShopState(state: ShopState): ShopState {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }
  return state;
}

export function loadInfiniteRecord(): InfiniteRecord {
  if (typeof window === 'undefined') return { bestScore: 0, bestWave: 0 };
  try {
    const raw = window.localStorage.getItem(INFINITE_RECORD_KEY);
    if (!raw) return { bestScore: 0, bestWave: 0 };
    const parsed = JSON.parse(raw) as Partial<InfiniteRecord>;
    return {
      bestScore: typeof parsed.bestScore === 'number' ? Math.max(0, Math.floor(parsed.bestScore)) : 0,
      bestWave: typeof parsed.bestWave === 'number' ? Math.max(0, Math.floor(parsed.bestWave)) : 0,
    };
  } catch {
    return { bestScore: 0, bestWave: 0 };
  }
}

export function saveInfiniteRecord(score: number, wave: number): InfiniteRecord {
  const cur = loadInfiniteRecord();
  const next: InfiniteRecord = {
    bestScore: Math.max(cur.bestScore, Math.floor(score)),
    bestWave: Math.max(cur.bestWave, Math.floor(wave)),
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(INFINITE_RECORD_KEY, JSON.stringify(next));
    } catch {
      // Ignore quota errors
    }
  }
  return next;
}

export function loadCampaignBestScore(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(CAMPAIGN_BEST_KEY);
    if (!raw) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
  } catch {
    return 0;
  }
}

export function saveCampaignBestScore(score: number): number {
  const cur = loadCampaignBestScore();
  const next = Math.max(cur, Math.max(0, Math.floor(score)));
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(CAMPAIGN_BEST_KEY, String(next));
    } catch {
      // Ignore quota errors
    }
  }
  return next;
}

export function loadBestHitChain(mode: 'campaign' | 'infinite'): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(`${BEST_HITS_KEY_PREFIX}${mode}`);
    if (!raw) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
  } catch {
    return 0;
  }
}

export function saveBestHitChain(mode: 'campaign' | 'infinite', hits: number): number {
  const cur = loadBestHitChain(mode);
  const next = Math.max(cur, Math.max(0, Math.floor(hits)));
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(`${BEST_HITS_KEY_PREFIX}${mode}`, String(next));
    } catch {
      // Ignore quota errors
    }
  }
  return next;
}

export function purchaseShopItem(itemId: string): { ok: boolean; state: ShopState; reason?: string } {
  const item = SHOP_CATALOG.find((i) => i.id === itemId);
  const current = loadShopState();
  if (!item) return { ok: false, state: current, reason: 'Item não encontrado.' };

  if (current.ownedIds.includes(item.id)) {
    if (item.skinStyle) {
      const next = saveShopState({ ...current, equippedSkin: item.skinStyle });
      return { ok: true, state: next };
    }
    return { ok: false, state: current, reason: 'Item já adquirido.' };
  }

  if (current.coins < item.price) {
    return { ok: false, state: current, reason: 'Fichas insuficientes.' };
  }

  const next: ShopState = {
    coins: current.coins - item.price,
    ownedIds: [...current.ownedIds, item.id],
    equippedSkin: item.skinStyle ? item.skinStyle : current.equippedSkin,
    garage: current.garage,
  };
  return { ok: true, state: saveShopState(next) };
}

export function equipShopSkin(skin: PlayerSkinStyle): ShopState {
  const current = loadShopState();
  if (skin === 'custom') {
    return saveShopState({ ...current, equippedSkin: 'custom' });
  }
  const matchingItem = SHOP_CATALOG.find((i) => i.skinStyle === skin);
  if (!matchingItem || !current.ownedIds.includes(matchingItem.id)) {
    return current;
  }
  return saveShopState({ ...current, equippedSkin: skin });
}

export function equipGarageLook(): ShopState {
  const current = loadShopState();
  return saveShopState({ ...current, equippedSkin: 'custom' });
}

export function saveGarageConfig(config: GarageConfig, equipCustom = true): ShopState {
  const current = loadShopState();
  const sanitized = sanitizeGarageConfig(config, current.ownedIds);
  return saveShopState({
    ...current,
    garage: sanitized,
    equippedSkin: equipCustom ? 'custom' : current.equippedSkin,
  });
}

export function awardCoinsFromRun(
  score: number,
  enemiesDefeated: number,
  victory: boolean,
  infiniteWave = 0
): { earned: number; total: number } {
  const current = loadShopState();
  const loadout = getActiveShopLoadout();
  const rawEarned = Math.max(
    15,
    Math.round(score / 45) + enemiesDefeated * 3 + (victory ? 120 : 0) + infiniteWave * 8
  );
  const earned = Math.round(rawEarned * (1 + loadout.coinBonusMult));
  const next = saveShopState({
    ...current,
    coins: current.coins + earned,
  });
  return { earned, total: next.coins };
}

export function awardBonusCoins(amount: number): { added: number; total: number } {
  const safeAmount = Math.max(0, Math.floor(amount));
  const current = loadShopState();
  if (safeAmount <= 0) {
    return { added: 0, total: current.coins };
  }
  const next = saveShopState({
    ...current,
    coins: current.coins + safeAmount,
  });
  return { added: safeAmount, total: next.coins };
}

export function getActiveShopLoadout(): ActiveShopLoadout {
  const state = loadShopState();
  const ownedSet = new Set(state.ownedIds);
  let maxHpBonus = 0;
  let startingCredits = 0;
  let startingCane = 0;
  let startingDeodorant = 0;
  let buffDurationBonus = 0;
  let damageMultBonus = 0;
  let startingEnergy = 0;
  let specialReachBonus = 0;
  let ticketDiscount = 0;
  let coinBonusMult = 0;
  let startingSpeedBonus = 0;

  for (const item of SHOP_CATALOG) {
    if (!ownedSet.has(item.id)) continue;
    if (item.maxHpBonus) maxHpBonus += item.maxHpBonus;
    if (item.startingCredits) startingCredits += item.startingCredits;
    if (item.startingCane) startingCane += item.startingCane;
    if (item.startingDeodorant) startingDeodorant += item.startingDeodorant;
    if (item.buffDurationBonus) buffDurationBonus += item.buffDurationBonus;
    if (item.damageMultBonus) damageMultBonus += item.damageMultBonus;
    if (item.startingEnergy) startingEnergy += item.startingEnergy;
    if (item.specialReachBonus) specialReachBonus += item.specialReachBonus;
    if (item.ticketDiscount) ticketDiscount += item.ticketDiscount;
    if (item.coinBonusMult) coinBonusMult += item.coinBonusMult;
    if (item.startingSpeedBonus) startingSpeedBonus += item.startingSpeedBonus;
  }

  return {
    equippedSkin: state.equippedSkin,
    garage: state.garage,
    maxHpBonus,
    startingCredits,
    startingCane,
    startingDeodorant,
    buffDurationBonus,
    damageMultBonus,
    startingEnergy: Math.min(100, startingEnergy),
    specialReachBonus,
    ticketDiscount,
    coinBonusMult,
    startingSpeedBonus,
  };
}
