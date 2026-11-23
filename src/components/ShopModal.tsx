import { Check, ShoppingBag, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { audio } from '../game/audio';
import {
  equipShopSkin,
  purchaseShopItem,
  SHOP_CATALOG,
  ShopCategory,
  ShopItemDefinition,
  ShopState,
} from '../game/shop';
import { drawVectorDropItem, drawVectorPlayer } from '../game/vectorArt';

interface ShopModalProps {
  shopState: ShopState;
  onUpdateShop: (next: ShopState) => void;
  onClose: () => void;
}

function ShopPreviewCanvas({
  skinStyle,
  previewItem,
}: {
  skinStyle: ShopState['equippedSkin'];
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

      // Nocturnal bus bay preview backdrop
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#141b2d';
      ctx.fillRect(0, 0, canvas.width, 68);

      // Subtle bus window & fluorescent strip
      ctx.fillStyle = '#0b1429';
      ctx.fillRect(10, 12, canvas.width - 20, 40);
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(10, 12, canvas.width - 20, 40);
      ctx.fillStyle = '#7dd3fc';
      ctx.fillRect(28, 3, canvas.width - 56, 3);

      // Slate bus floor & yellow aisle strip
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, 68, canvas.width, canvas.height - 68);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(0, 67, canvas.width, 2);

      // Preview animation pose when showcasing specific gear/items
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
        hasSideDrop ? 46 : canvas.width / 2,
        88,
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
        activeSkin
      );

      // Show matching item sprite beside player when previewing starting gear or perks
      if (isCanePreview) {
        drawVectorDropItem(ctx, 'bengala', 86, 88, 4, t * 2);
      } else if (isSprayPreview) {
        drawVectorDropItem(ctx, 'desodorante', 86, 88, 4, t * 2);
        if (anim === 'spray') {
          ctx.fillStyle = 'rgba(34, 211, 238, 0.55)';
          ctx.fillRect(68, 56, 16, 8);
          ctx.fillStyle = 'rgba(207, 250, 254, 0.8)';
          ctx.fillRect(72, 58, 8, 4);
        }
      } else if (isSpeedCoffeePreview) {
        drawVectorDropItem(ctx, 'cafezinho', 86, 88, 4, t * 2);
      } else if (isTicketVipPreview) {
        drawVectorDropItem(ctx, 'bilhete_dourado', 86, 88, 4, t * 2);
      } else if (previewItem?.startingCredits) {
        drawVectorDropItem(ctx, 'creditos', 86, 88, 4, t * 2);
      } else if (previewItem?.maxHpBonus) {
        drawVectorDropItem(ctx, 'chocolate', 86, 88, 4, t * 2);
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [skinStyle, previewItem]);

  return (
    <canvas
      ref={canvasRef}
      width={112}
      height={104}
      aria-label="Prévia animada do item personalizado"
      style={{ imageRendering: 'pixelated' }}
      className="w-28 h-[104px] rounded-xl border-2 border-slate-700 bg-[#090d16] shrink-0"
    />
  );
}

export function ShopModal({ shopState, onUpdateShop, onClose }: ShopModalProps) {
  const [activeTab, setActiveTab] = useState<ShopCategory>('custom');
  const [previewItemId, setPreviewItemId] = useState<string>(
    () =>
      SHOP_CATALOG.find((i) => i.skinStyle === shopState.equippedSkin)?.id ?? 'skin_classic'
  );
  const [feedback, setFeedback] = useState<string>('');

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
  const previewItem = SHOP_CATALOG.find((i) => i.id === previewItemId) ?? null;
  const equippedItem =
    SHOP_CATALOG.find((i) => i.skinStyle === shopState.equippedSkin) ?? SHOP_CATALOG[0];

  const handleAction = (item: ShopItemDefinition) => {
    setPreviewItemId(item.id);
    const isOwned = ownedSet.has(item.id);
    if (isOwned && item.skinStyle) {
      const next = equipShopSkin(item.skinStyle);
      onUpdateShop(next);
      audio.playPickup();
      setFeedback(`Visual "${item.name}" equipado!`);
      return;
    }

    const res = purchaseShopItem(item.id);
    if (res.ok) {
      onUpdateShop(res.state);
      audio.playValidate();
      setFeedback(`"${item.name}" adquirido!`);
    } else {
      audio.playBlock();
      setFeedback(res.reason ?? 'Não foi possível concluir a compra.');
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#090d16]/85 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-[#0f172a] border-4 border-[#facc15] shadow-[0_10px_0_#020617] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-800 bg-[#090d16]">
          <div className="flex items-center gap-3 min-w-0">
            <ShoppingBag className="w-5 h-5 text-[#facc15] shrink-0" />
            <h2 className="font-arcade-display text-sm sm:text-base text-[#facc15] truncate">
              LOJINHA DO TERMINAL
            </h2>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right font-mono-num">
              <div className="text-[11px] text-slate-400">Saldo disponível</div>
              <div className="text-sm font-bold text-[#facc15]">{shopState.coins} Fichas</div>
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

        {/* Live Character / Item Preview + Segmented Category Tabs */}
        <div className="px-5 py-3.5 bg-slate-900/70 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 w-full sm:w-auto min-w-0">
            <ShopPreviewCanvas skinStyle={shopState.equippedSkin} previewItem={previewItem} />
            <div className="text-left min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                <span>
                  {previewItem && previewItem.id !== equippedItem.id
                    ? 'Visualizando item'
                    : 'Visual em uso'}
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-slate-400">
                  {previewItem && ownedSet.has(previewItem.id)
                    ? 'Já adquirido'
                    : previewItem
                      ? `${previewItem.price} Fichas`
                      : ''}
                </span>
              </div>
              <div className="text-sm font-bold text-white truncate">
                {previewItem?.name ?? equippedItem.name}
              </div>
              <div className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                {previewItem?.description ??
                  'Ganhe mais fichas completando rotas e nocauteando rivais.'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#090d16] rounded-lg border border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveTab('custom');
                setFeedback('');
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'custom'
                  ? 'bg-[#facc15] text-[#090d16]'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Itens Personalizados
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('perk');
                setFeedback('');
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'perk'
                  ? 'bg-[#facc15] text-[#090d16]'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Vantagens
            </button>
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2.5">
          {feedback && (
            <div className="px-3 py-2 rounded-lg bg-slate-800/90 border border-amber-400/50 text-xs font-medium text-amber-200 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#facc15] shrink-0" />
              <span>{feedback}</span>
            </div>
          )}

          {items.map((item) => {
            const isOwned = ownedSet.has(item.id);
            const isEquippedSkin = Boolean(
              item.skinStyle && shopState.equippedSkin === item.skinStyle
            );
            const isPreviewing = previewItemId === item.id;
            const canAfford = shopState.coins >= item.price;

            return (
              <div
                key={item.id}
                onClick={() => setPreviewItemId(item.id)}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition-colors cursor-pointer ${
                  isPreviewing
                    ? 'bg-slate-800/90 border-[#facc15]/80'
                    : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="space-y-1 text-left min-w-0">
                    <div className="text-sm font-bold text-white">{item.name}</div>
                    <div className="text-xs text-sky-300">{item.subtitle}</div>
                    <p className="text-xs text-slate-400 leading-relaxed">{item.description}</p>
                  </div>
                </div>

                <div
                  className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="font-mono-num text-xs font-bold text-[#facc15] whitespace-nowrap">
                    {isOwned ? 'Adquirido' : `${item.price} Fichas`}
                  </span>

                  {isOwned ? (
                    item.skinStyle ? (
                      <button
                        type="button"
                        disabled={isEquippedSkin}
                        onClick={() => handleAction(item)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                          isEquippedSkin
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 cursor-default'
                            : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 cursor-pointer'
                        }`}
                      >
                        {isEquippedSkin && <Check className="w-3.5 h-3.5" />}
                        {isEquippedSkin ? 'Equipado' : 'Equipar'}
                      </button>
                    ) : (
                      <span className="px-4 py-2 rounded-lg bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0">
                        <Check className="w-3.5 h-3.5" />
                        Ativo
                      </span>
                    )
                  ) : (
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => handleAction(item)}
                      className={`px-4 py-2 rounded-lg text-xs font-bold border whitespace-nowrap shrink-0 transition-colors ${
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
    </div>
  );
}
