import {
  Check,
  Coins,
  Info,
  Lock,
  RotateCcw,
  ShoppingBag,
  Shuffle,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { audio } from '../game/audio';
import {
  DEFAULT_GARAGE_CONFIG,
  equipGarageLook,
  equipShopSkin,
  GARAGE_COLOR_DEFS,
  GARAGE_FREE_COLORS,
  GARAGE_HAIR_DEFS,
  GARAGE_NEON_KEYS,
  GarageConfig,
  GarageGender,
  GarageHairStyle,
  GarageSlot,
  isGarageColorUnlocked,
  isGarageGenderUnlocked,
  isGarageHairUnlocked,
  purchaseShopItem,
  saveGarageConfig,
  SHOP_CATALOG,
  ShopCategory,
  ShopItemDefinition,
  ShopState,
} from '../game/shop';
import { drawVectorDropItem, drawVectorPlayer } from '../game/vectorArt';

interface ShopModalProps {
  shopState: ShopState;
  initialTab?: ShopCategory;
  onUpdateShop: (next: ShopState) => void;
  onClose: () => void;
}

type PreviewPose = 'idle' | 'punch2' | 'kick';

const SLOT_LABELS: Array<{ key: GarageSlot; label: string }> = [
  { key: 'hairColor', label: 'Cabelo' },
  { key: 'tieColor', label: 'Gravata' },
  { key: 'backpackColor', label: 'Mochila' },
];

const SHOP_TACTICAL_TIPS: Record<string, string> = {
  gear_bengala_inicial: 'Alcance longo para manter rivais afastados desde a 1ª onda.',
  gear_spray_inicial: 'Dispersa o fedor do Operário de Obra e atordoa quem estiver perto (tecla E).',
  gear_garrafa_cafe: '+Velocidade de deslocamento e +25% da barra de Especial já ao embarcar.',
  perk_cafe_expresso: 'Sobe seu HP máximo de 105 para 130 em todas as viagens.',
  perk_passe_livre: 'Comece com 3 créditos para validar a catraca ou comprar na Banca do Ponto.',
  perk_fones_turbinados: 'Inicie com 40% de Especial e amplie o raio da Explosão Sonora.',
  perk_cracha_vip: 'Cobra 1 crédito a menos na catraca e aumenta em 15% as Fichas ganhas.',
  perk_energetico: 'Prolonga em +4s os buffs de Força e o Escudo da Mochila.',
  perk_punho_aco: '+15% de dano em socos, chutes, aéreos e especiais.',
};

function ShopPreviewCanvas({
  skinStyle,
  garageConfig,
  previewItem,
}: {
  skinStyle: ShopState['equippedSkin'];
  garageConfig: GarageConfig;
  previewItem: ShopItemDefinition | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const start = performance.now();

    const activeSkin = previewItem?.skinStyle ?? skinStyle;
    const isCanePreview = Boolean(previewItem?.startingCane);
    const isSprayPreview = Boolean(previewItem?.startingDeodorant);
    const isSpeedCoffeePreview = Boolean(previewItem?.startingSpeedBonus);
    const isTicketVipPreview = Boolean(previewItem?.ticketDiscount || previewItem?.coinBonusMult);
    const isSoundSpecialPreview = Boolean(previewItem?.specialReachBonus);
    const isBuffPreview = Boolean(previewItem?.buffDurationBonus || previewItem?.damageMultBonus);

    const draw = (now: number) => {
      const t = (now - start) / 1000;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#141b2d';
      ctx.fillRect(0, 0, canvas.width, 64);

      ctx.fillStyle = '#0b1429';
      ctx.fillRect(10, 10, canvas.width - 20, 38);
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(10, 10, canvas.width - 20, 38);

      ctx.fillStyle = '#334155';
      ctx.fillRect(0, 64, canvas.width, canvas.height - 64);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(0, 63, canvas.width, 2);

      let anim: string = 'idle';
      let animTimer = t;
      if (isCanePreview) {
        const cycle = t % 1.4;
        if (cycle < 0.26) {
          anim = 'cane';
          animTimer = 0.26 - cycle;
        }
      } else if (isSprayPreview) {
        const cycle = t % 1.4;
        if (cycle < 0.45) {
          anim = 'spray';
          animTimer = 0.45 - cycle;
        }
      } else if (isSoundSpecialPreview) {
        const cycle = t % 1.6;
        if (cycle < 0.42) {
          anim = 'soundSpecial';
          animTimer = 0.42 - cycle;
        }
      } else if (previewItem?.skinStyle) {
        const cycle = t % 2.2;
        if (cycle > 1.5) {
          anim = 'punch2';
          animTimer = 0.2;
        }
      }

      const hasSideDrop =
        isCanePreview ||
        isSprayPreview ||
        isSpeedCoffeePreview ||
        isTicketVipPreview ||
        Boolean(previewItem?.startingCredits || previewItem?.maxHpBonus);

      drawVectorPlayer(
        ctx,
        hasSideDrop ? 44 : canvas.width / 2,
        82,
        0,
        1,
        anim,
        animTimer,
        isCanePreview,
        Boolean(previewItem?.buffDurationBonus),
        false,
        Boolean(isBuffPreview),
        false,
        t,
        activeSkin,
        garageConfig
      );

      if (isCanePreview) {
        drawVectorDropItem(ctx, 'bengala', 82, 82, 4, t * 2);
      } else if (isSprayPreview) {
        drawVectorDropItem(ctx, 'desodorante', 82, 82, 4, t * 2);
      } else if (isSpeedCoffeePreview) {
        drawVectorDropItem(ctx, 'cafezinho', 82, 82, 4, t * 2);
      } else if (isTicketVipPreview) {
        drawVectorDropItem(ctx, 'bilhete_dourado', 82, 82, 4, t * 2);
      } else if (previewItem?.startingCredits) {
        drawVectorDropItem(ctx, 'creditos', 82, 82, 4, t * 2);
      } else if (previewItem?.maxHpBonus) {
        drawVectorDropItem(ctx, 'chocolate', 82, 82, 4, t * 2);
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [skinStyle, garageConfig, previewItem]);

  return (
    <canvas
      ref={canvasRef}
      width={108}
      height={96}
      aria-label="Prévia animada"
      style={{ imageRendering: 'pixelated' }}
      className="w-[108px] h-[96px] rounded-xl border-2 border-slate-700 bg-[#090d16] shrink-0"
    />
  );
}

function GaragePreviewCanvas({
  config,
  pose,
}: {
  config: GarageConfig;
  pose: PreviewPose;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const start = performance.now();

    const draw = (now: number) => {
      const t = (now - start) / 1000;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#141b2d';
      ctx.fillRect(0, 0, canvas.width, 90);

      ctx.fillStyle = '#0b1429';
      ctx.fillRect(14, 14, canvas.width - 28, 54);
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 2;
      ctx.strokeRect(14, 14, canvas.width - 28, 54);

      ctx.fillStyle = '#facc15';
      ctx.fillRect(0, 20, canvas.width, 3);

      ctx.fillStyle = '#334155';
      ctx.fillRect(0, 90, canvas.width, canvas.height - 90);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(0, 89, canvas.width, 2);

      let anim: string = 'idle';
      let animTimer = t;
      if (pose === 'punch2') {
        const cyc = t % 0.9;
        if (cyc < 0.35) {
          anim = 'punch2';
          animTimer = 0.25;
        }
      } else if (pose === 'kick') {
        const cyc = t % 1.0;
        if (cyc < 0.42) {
          anim = 'kick';
          animTimer = 0.28;
        }
      }

      ctx.save();
      ctx.translate(canvas.width / 2, 118);
      ctx.scale(1.6, 1.6);
      drawVectorPlayer(
        ctx,
        0,
        0,
        0,
        1,
        anim,
        animTimer,
        false,
        false,
        false,
        false,
        false,
        t,
        'custom',
        config
      );
      ctx.restore();

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [config, pose]);

  return (
    <canvas
      ref={canvasRef}
      width={176}
      height={140}
      aria-label="Prévia da Garagem"
      style={{ imageRendering: 'pixelated' }}
      className="w-full max-w-[210px] aspect-[176/140] rounded-xl border-2 border-[#38bdf8]/70 bg-[#090d16] mx-auto"
    />
  );
}

export function ShopModal({
  shopState,
  initialTab = 'custom',
  onUpdateShop,
  onClose,
}: ShopModalProps) {
  const [activeTab, setActiveTab] = useState<ShopCategory>(initialTab);
  const [previewItemId, setPreviewItemId] = useState<string>(() => {
    const first =
      initialTab === 'perk'
        ? SHOP_CATALOG.find((i) => i.category === 'perk')?.id
        : SHOP_CATALOG.find((i) => i.skinStyle === shopState.equippedSkin)?.id ??
          SHOP_CATALOG.find((i) => i.category === 'custom')?.id;
    return first ?? 'skin_classic';
  });
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string>('');

  // Embedded Garagem draft state
  const [draft, setDraft] = useState<GarageConfig>(() => ({ ...shopState.garage }));
  const [pose, setPose] = useState<PreviewPose>('idle');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const items = SHOP_CATALOG.filter((item) => item.category === activeTab);
  const ownedSet = new Set(shopState.ownedIds);
  const activeInspectId = hoveredItemId ?? previewItemId;
  const previewItem = SHOP_CATALOG.find((i) => i.id === activeInspectId) ?? null;

  const lockedItemsInDraft = useMemo(() => {
    const missing: Array<{ shopItemId: string; label: string; price: number }> = [];
    const seen = new Set<string>();
    const addById = (shopItemId?: string) => {
      if (!shopItemId || seen.has(shopItemId) || ownedSet.has(shopItemId)) return;
      const def = SHOP_CATALOG.find((i) => i.id === shopItemId);
      if (!def) return;
      seen.add(shopItemId);
      missing.push({ shopItemId: def.id, label: def.name, price: def.price });
    };

    if (!isGarageGenderUnlocked(shopState.ownedIds, draft.gender)) {
      addById('garage_gender_switch');
    }
    if (!isGarageHairUnlocked(shopState.ownedIds, draft.hairStyle)) {
      const h = GARAGE_HAIR_DEFS.find((d) => d.id === draft.hairStyle);
      addById(h?.shopItemId);
    }
    for (const slot of SLOT_LABELS) {
      const key = draft[slot.key];
      if (!isGarageColorUnlocked(shopState.ownedIds, key)) {
        addById(GARAGE_COLOR_DEFS[key]?.shopItemId);
      }
    }
    return missing;
  }, [draft, shopState.ownedIds]);

  const hasLockedSelection = lockedItemsInDraft.length > 0;
  const firstLocked = lockedItemsInDraft[0] ?? null;

  const handleAction = (item: ShopItemDefinition) => {
    setPreviewItemId(item.id);
    const isOwned = ownedSet.has(item.id);
    if (isOwned && item.skinStyle) {
      const next = equipShopSkin(item.skinStyle);
      onUpdateShop(next);
      audio.playPickup();
      setFeedback(`"${item.name}" equipado.`);
      return;
    }

    const res = purchaseShopItem(item.id);
    if (res.ok) {
      onUpdateShop(res.state);
      audio.playValidate();
      setFeedback(`"${item.name}" adquirido!`);
    } else {
      audio.playBlock();
      setFeedback(res.reason ?? 'Fichas insuficientes.');
    }
  };

  const handleEquipGarage = () => {
    const next = equipGarageLook();
    onUpdateShop(next);
    audio.playPickup();
    setFeedback('Visual da Garagem equipado.');
  };

  const handleUnlockInGarage = (shopItemId: string) => {
    const res = purchaseShopItem(shopItemId);
    if (res.ok) {
      onUpdateShop(res.state);
      audio.playValidate();
      setFeedback('Desbloqueado!');
    } else {
      audio.playBlock();
      setFeedback(res.reason ?? 'Fichas insuficientes.');
    }
  };

  const handleRandomize = () => {
    const unlockedGenders: GarageGender[] = isGarageGenderUnlocked(shopState.ownedIds, 'female')
      ? ['male', 'female']
      : ['male'];
    const unlockedHairs = GARAGE_HAIR_DEFS.filter((h) =>
      isGarageHairUnlocked(shopState.ownedIds, h.id)
    ).map((h) => h.id);
    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const pickSlotColor = (slot: GarageSlot) => {
      const pool = [
        ...GARAGE_FREE_COLORS[slot],
        ...GARAGE_NEON_KEYS.filter((k) => isGarageColorUnlocked(shopState.ownedIds, k)),
      ];
      return pick(pool);
    };

    setDraft({
      gender: pick(unlockedGenders),
      hairStyle: pick(unlockedHairs),
      hairColor: pickSlotColor('hairColor'),
      tieColor: pickSlotColor('tieColor'),
      backpackColor: pickSlotColor('backpackColor'),
    });
    audio.playPickup();
    setFeedback('');
  };

  const handleResetGarage = () => {
    setDraft({ ...DEFAULT_GARAGE_CONFIG });
    audio.playPickup();
    setFeedback('');
  };

  const handleSaveGarage = () => {
    if (hasLockedSelection) {
      audio.playBlock();
      return;
    }
    const next = saveGarageConfig(draft, true);
    onUpdateShop(next);
    audio.playValidate();
    setFeedback('Garagem salva e equipada!');
  };

  const switchTab = (tab: ShopCategory) => {
    setActiveTab(tab);
    setHoveredItemId(null);
    setFeedback('');
    if (tab === 'custom' || tab === 'perk') {
      const first = SHOP_CATALOG.find((i) => i.category === tab);
      if (first) setPreviewItemId(first.id);
    }
  };

  const previewTacticalTip = previewItem ? SHOP_TACTICAL_TIPS[previewItem.id] : undefined;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#090d16]/85 p-3 sm:p-4">
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-[#0f172a] border-4 border-[#facc15] shadow-[0_10px_0_#020617] overflow-hidden">
        {/* Compact Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-slate-800 bg-[#090d16]">
          <div className="flex items-center gap-2.5 min-w-0">
            <ShoppingBag className="w-5 h-5 text-[#facc15] shrink-0" />
            <h2 className="font-arcade-display text-sm sm:text-base text-[#facc15] truncate">
              LOJINHA
            </h2>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="inline-flex items-center gap-1.5 font-mono-num text-sm font-bold text-[#facc15] tabular-nums">
              <Coins className="w-4 h-4 shrink-0" />
              <span>{shopState.coins.toLocaleString('pt-BR')} Fichas</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar lojinha"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="px-4 sm:px-5 py-2.5 bg-slate-900/75 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#090d16] rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => switchTab('custom')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'custom'
                  ? 'bg-[#facc15] text-[#090d16]'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Skins & Itens
            </button>
            <button
              type="button"
              onClick={() => switchTab('garage')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'garage'
                  ? 'bg-[#38bdf8] text-[#090d16]'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Garagem
            </button>
            <button
              type="button"
              onClick={() => switchTab('perk')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'perk'
                  ? 'bg-[#facc15] text-[#090d16]'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Vantagens
            </button>
          </div>

          {feedback && (
            <span className="text-xs font-semibold text-amber-300 truncate">{feedback}</span>
          )}
        </div>

        {/* Body */}
        {activeTab === 'garage' ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
            {/* Left: Live Animated Preview */}
            <div className="flex flex-col items-center gap-2.5 bg-slate-900/75 rounded-xl border border-slate-800 p-3 h-fit">
              <GaragePreviewCanvas config={draft} pose={pose} />

              <div className="w-full grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'idle', label: 'Parado' },
                    { id: 'punch2', label: 'Soco' },
                    { id: 'kick', label: 'Chute' },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPose(p.id)}
                    className={`py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                      pose === p.id
                        ? 'bg-[#38bdf8] text-[#090d16] border-[#020617]'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="w-full grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={handleRandomize}
                  className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <Shuffle className="w-3.5 h-3.5 text-[#38bdf8]" />
                  Aleatório
                </button>
                <button
                  type="button"
                  onClick={handleResetGarage}
                  className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                  Padrão
                </button>
              </div>

              {firstLocked ? (
                <button
                  type="button"
                  disabled={shopState.coins < firstLocked.price}
                  onClick={() => handleUnlockInGarage(firstLocked.shopItemId)}
                  className={`w-full py-2 px-3 rounded-xl font-arcade-display text-[11px] border-2 border-[#020617] shadow-[0_3px_0_#020617] whitespace-nowrap ${
                    shopState.coins >= firstLocked.price
                      ? 'bg-[#facc15] hover:bg-[#fde047] text-[#090d16] cursor-pointer'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  LIBERAR · {firstLocked.price.toLocaleString('pt-BR')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveGarage}
                  className="w-full py-2 px-3 rounded-xl bg-gradient-to-b from-[#fde047] to-[#eab308] hover:from-[#fef08a] hover:to-[#facc15] text-[#090d16] font-arcade-display text-[11px] border-2 border-[#020617] shadow-[0_3px_0_#020617] cursor-pointer whitespace-nowrap"
                >
                  SALVAR E EQUIPAR
                </button>
              )}
            </div>

            {/* Right: Minimal Controls (Gender, Hair, Colors) */}
            <div className="space-y-3">
              {/* Gender */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDraft((prev) => ({ ...prev, gender: 'male' }));
                    audio.playPickup();
                  }}
                  className={`min-h-[40px] px-3 py-1.5 rounded-xl border-2 text-xs font-bold flex items-center justify-center cursor-pointer transition-colors ${
                    draft.gender === 'male'
                      ? 'bg-[#38bdf8]/20 border-[#38bdf8] text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  Estagiário
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft((prev) => ({ ...prev, gender: 'female' }));
                    audio.playPickup();
                  }}
                  className={`min-h-[40px] px-3 py-1.5 rounded-xl border-2 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    draft.gender === 'female'
                      ? isGarageGenderUnlocked(shopState.ownedIds, 'female')
                        ? 'bg-[#38bdf8]/20 border-[#38bdf8] text-white'
                        : 'bg-amber-950/50 border-[#facc15] text-amber-200'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {!isGarageGenderUnlocked(shopState.ownedIds, 'female') && (
                    <Lock className="w-3.5 h-3.5 text-[#facc15] shrink-0" />
                  )}
                  <span>Estagiária</span>
                  {!isGarageGenderUnlocked(shopState.ownedIds, 'female') && (
                    <span className="font-mono-num text-[10px] text-[#facc15]">3.000</span>
                  )}
                </button>
              </div>

              {/* Haircuts */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {GARAGE_HAIR_DEFS.map((hair) => {
                  const unlocked = isGarageHairUnlocked(shopState.ownedIds, hair.id);
                  const selected = draft.hairStyle === hair.id;
                  return (
                    <button
                      key={hair.id}
                      type="button"
                      onClick={() => {
                        setDraft((prev) => ({ ...prev, hairStyle: hair.id }));
                        audio.playPickup();
                      }}
                      className={`min-h-[40px] px-2 py-1.5 rounded-xl border-2 text-xs font-semibold flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors ${
                        selected
                          ? unlocked
                            ? 'bg-[#38bdf8]/20 border-[#38bdf8] text-white'
                            : 'bg-amber-950/50 border-[#facc15] text-amber-200'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1 leading-tight text-center">
                        {!unlocked && <Lock className="w-3 h-3 text-[#facc15] shrink-0" />}
                        {hair.label}
                      </span>
                      {!unlocked && (
                        <span className="font-mono-num text-[10px] text-[#facc15]">1.000</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Color Swatches */}
              <div className="space-y-2">
                {SLOT_LABELS.map((slot) => {
                  const freeKeys = GARAGE_FREE_COLORS[slot.key];
                  const allKeys = [...freeKeys, ...GARAGE_NEON_KEYS];
                  const currentKey = draft[slot.key];

                  return (
                    <div
                      key={slot.key}
                      className="bg-slate-900/80 rounded-xl border border-slate-800 px-3 py-2 flex flex-wrap items-center justify-between gap-2"
                    >
                      <span className="text-xs font-semibold text-slate-200 min-w-[54px]">
                        {slot.label}
                      </span>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {allKeys.map((colorKey, idx) => {
                          const def = GARAGE_COLOR_DEFS[colorKey];
                          if (!def) return null;
                          const unlocked = isGarageColorUnlocked(shopState.ownedIds, colorKey);
                          const selected = currentKey === colorKey;
                          const showDivider = idx === freeKeys.length;

                          return (
                            <div key={colorKey} className="inline-flex items-center gap-1.5">
                              {showDivider && (
                                <span className="w-px h-5 bg-slate-700" aria-hidden="true" />
                              )}
                              <button
                                type="button"
                                title={
                                  unlocked
                                    ? def.label
                                    : `${def.label} · 1.000 Fichas`
                                }
                                aria-label={`${slot.label}: ${def.label}`}
                                onClick={() => {
                                  setDraft((prev) => ({ ...prev, [slot.key]: colorKey }));
                                  audio.playPickup();
                                }}
                                style={{
                                  backgroundColor: def.main,
                                  boxShadow: def.isNeon ? `0 0 8px ${def.main}88` : undefined,
                                }}
                                className={`relative w-8 h-8 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-transform active:scale-95 ${
                                  selected
                                    ? 'border-white ring-2 ring-[#facc15] scale-105'
                                    : 'border-slate-950 hover:border-slate-300'
                                }`}
                              >
                                {!unlocked && (
                                  <Lock className="w-3 h-3 text-white drop-shadow-[0_1px_2px_#020617]" />
                                )}
                                {unlocked && selected && (
                                  <Check className="w-3.5 h-3.5 text-white drop-shadow-[0_1px_2px_#020617]" />
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
            {/* Compact Live Preview + Guided Tactical Tooltip */}
            <div className="flex items-center gap-3.5 p-3 rounded-xl bg-slate-900/75 border border-slate-800">
              <ShopPreviewCanvas
                skinStyle={shopState.equippedSkin}
                garageConfig={shopState.garage}
                previewItem={previewItem}
              />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-white truncate">
                    {previewItem?.name ?? 'Uniforme Estagiário'}
                  </span>
                  {previewItem && (
                    <span className="font-mono-num text-xs font-bold text-[#facc15] shrink-0">
                      {ownedSet.has(previewItem.id)
                        ? 'Adquirido'
                        : `${previewItem.price.toLocaleString('pt-BR')} Fichas`}
                    </span>
                  )}
                </div>
                {previewItem && (
                  <div className="text-xs text-sky-300 truncate">{previewItem.subtitle}</div>
                )}
                {previewTacticalTip && (
                  <div className="flex items-start gap-1.5 text-[11px] text-amber-200 leading-snug pt-0.5">
                    <Info className="w-3.5 h-3.5 text-[#38bdf8] shrink-0 mt-0.5" />
                    <span>{previewTacticalTip}</span>
                  </div>
                )}
              </div>
            </div>

            {activeTab === 'custom' && (
              <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-[#38bdf8]/60 bg-slate-900/95">
                <span className="text-xs sm:text-sm font-bold text-[#38bdf8]">
                  Visual da Garagem
                </span>
                {shopState.equippedSkin === 'custom' ? (
                  <span className="px-3 py-1.5 rounded-lg bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap">
                    <Check className="w-3.5 h-3.5" />
                    Equipado
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleEquipGarage}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white border border-[#38bdf8]/70 text-xs font-bold cursor-pointer whitespace-nowrap"
                  >
                    Equipar
                  </button>
                )}
              </div>
            )}

            <div className="space-y-2">
              {items.map((item) => {
                const isOwned = ownedSet.has(item.id);
                const isEquippedSkin = Boolean(
                  item.skinStyle && shopState.equippedSkin === item.skinStyle
                );
                const isPreviewing = activeInspectId === item.id;
                const canAfford = shopState.coins >= item.price;

                return (
                  <div
                    key={item.id}
                    onClick={() => setPreviewItemId(item.id)}
                    onMouseEnter={() => setHoveredItemId(item.id)}
                    onMouseLeave={() => setHoveredItemId(null)}
                    className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${
                      isPreviewing
                        ? 'bg-slate-800/90 border-[#facc15]/80'
                        : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white truncate">{item.name}</div>
                      <div className="text-xs text-sky-300 truncate">{item.subtitle}</div>
                    </div>

                    <div
                      className="flex items-center gap-2.5 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="font-mono-num text-xs font-bold text-[#facc15] whitespace-nowrap">
                        {isOwned ? 'Adquirido' : `${item.price.toLocaleString('pt-BR')} Fichas`}
                      </span>

                      {isOwned ? (
                        item.skinStyle ? (
                          <button
                            type="button"
                            disabled={isEquippedSkin}
                            onClick={() => handleAction(item)}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                              isEquippedSkin
                                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 cursor-default'
                                : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 cursor-pointer'
                            }`}
                          >
                            {isEquippedSkin && <Check className="w-3.5 h-3.5" />}
                            {isEquippedSkin ? 'Equipado' : 'Equipar'}
                          </button>
                        ) : (
                          <span className="px-3.5 py-1.5 rounded-lg bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0">
                            <Check className="w-3.5 h-3.5" />
                            Ativo
                          </span>
                        )
                      ) : (
                        <button
                          type="button"
                          disabled={!canAfford}
                          onClick={() => handleAction(item)}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border whitespace-nowrap shrink-0 transition-colors ${
                            canAfford
                              ? 'bg-gradient-to-b from-[#fde047] to-[#eab308] hover:from-[#fef08a] hover:to-[#facc15] text-[#090d16] border-[#020617] cursor-pointer'
                              : 'bg-slate-800/70 text-slate-500 border-slate-700 cursor-not-allowed'
                          }`}
                        >
                          Comprar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
