import React, { useState, useMemo } from 'react';
import {
  Search,
  Smile,
  Sparkles,
  X,
  Check,
  Code2
} from 'lucide-react';
import {
  LUCIDE_FOOD_ICONS,
  POPULAR_FOOD_EMOJIS,
  CategoryVisual,
  renderCategoryIcon
} from '../../utils/categoryIcons';

interface CategoryIconPickerProps {
  currentVisual?: CategoryVisual;
  categoryName?: string;
  onSelect: (visual: CategoryVisual) => void;
  onClose: () => void;
}

export const CategoryIconPicker: React.FC<CategoryIconPickerProps> = React.memo(({
  currentVisual,
  categoryName = '',
  onSelect,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'svg' | 'emoji' | 'custom'>('svg');
  const [searchQuery, setSearchQuery] = useState('');
  const [customSvgInput, setCustomSvgInput] = useState(
    currentVisual?.iconType === 'custom_svg' ? currentVisual.iconValue || '' : ''
  );
  const [customEmojiInput, setCustomEmojiInput] = useState(
    currentVisual?.iconType === 'emoji' ? currentVisual.iconValue || '' : ''
  );

  // Filter SVG Icons based on search query
  const filteredSvgIcons = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return LUCIDE_FOOD_ICONS;
    return LUCIDE_FOOD_ICONS.filter(
      (icon) =>
        icon.name.toLowerCase().includes(q) ||
        icon.id.toLowerCase().includes(q) ||
        icon.keywords.some((k) => k.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  // Filter Emojis based on search query
  const filteredEmojis = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return POPULAR_FOOD_EMOJIS;
    return POPULAR_FOOD_EMOJIS.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.keywords.some((k) => k.toLowerCase().includes(q)) ||
        item.emoji.includes(q)
    );
  }, [searchQuery]);

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-4 bg-black/80">
      <div
        className="bg-[#18181B] rounded-md max-w-lg w-full max-h-[85vh] border border-[#27272A] overflow-hidden flex flex-col"
        style={{ contain: 'content' }}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#27272A] flex items-center justify-between shrink-0 bg-[#0A0A0A]">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-[#FFFFFF] tracking-[-0.02em] uppercase">
              Select Category Icon / Emoji
            </h3>
            <p className="text-xs text-[#A1A1AA] mt-0.5">
              Choose an SVG icon or Emoji for "{categoryName || 'Category'}"
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-sm text-[#71717A] hover:text-[#FFFFFF] hover:bg-[#18181B] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher & Search Bar */}
        <div className="p-4 border-b border-[#27272A] space-y-3 bg-[#18181B] shrink-0 font-mono">
          {/* Tabs */}
          <div className="flex bg-[#0A0A0A] p-1 rounded-sm border border-[#27272A] gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('svg')}
              className={`flex-1 py-1.5 px-3 rounded-xs text-[11px] font-bold uppercase tracking-[0.06em] flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'svg'
                  ? 'bg-[#FFFFFF] text-[#0A0A0A]'
                  : 'text-[#A1A1AA] hover:text-[#FFFFFF]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>SVG ({LUCIDE_FOOD_ICONS.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('emoji')}
              className={`flex-1 py-1.5 px-3 rounded-xs text-[11px] font-bold uppercase tracking-[0.06em] flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'emoji'
                  ? 'bg-[#FFFFFF] text-[#0A0A0A]'
                  : 'text-[#A1A1AA] hover:text-[#FFFFFF]'
              }`}
            >
              <Smile className="w-3.5 h-3.5" />
              <span>Emojis</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('custom')}
              className={`py-1.5 px-3 rounded-xs text-[11px] font-bold uppercase tracking-[0.06em] flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'custom'
                  ? 'bg-[#FFFFFF] text-[#0A0A0A]'
                  : 'text-[#A1A1AA] hover:text-[#FFFFFF]'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Custom SVG</span>
            </button>
          </div>

          {/* Search Bar for SVG and Emoji tabs */}
          {activeTab !== 'custom' && (
            <div className="relative">
              <Search className="w-4 h-4 text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === 'svg'
                    ? 'SEARCH SVG ICON (PIZZA, COFFEE, CAKE...)'
                    : 'SEARCH EMOJI (BURGER, ICE CREAM...)'
                }
                className="w-full pl-9 pr-8 py-2 bg-[#0A0A0A] border border-[#27272A] focus:border-[#FFFFFF] rounded-sm text-xs font-mono text-[#FFFFFF] placeholder:text-[#71717A] focus:outline-none"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#FFFFFF] p-1"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="p-4 overflow-y-auto max-h-[50vh] flex-1">
          {/* TAB 1: SVG Icons Grid */}
          {activeTab === 'svg' && (
            <div>
              {filteredSvgIcons.length === 0 ? (
                <div className="text-center py-8 text-[#71717A] font-mono text-xs">
                  No SVG icons match "{searchQuery}".
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {filteredSvgIcons.map((item) => {
                    const IconComp = item.component;
                    const isSelected =
                      currentVisual?.iconType === 'lucide' &&
                      currentVisual.iconValue?.toLowerCase() === item.id.toLowerCase();

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onSelect({ iconType: 'lucide', iconValue: item.id });
                          onClose();
                        }}
                        className={`p-3 rounded-sm border flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer ${
                          isSelected
                            ? 'bg-[#FFFFFF] text-[#0A0A0A] border-[#FFFFFF]'
                            : 'bg-[#0A0A0A] hover:bg-[#242427] text-[#FFFFFF] border-[#27272A] hover:border-[#3F3F46]'
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-sm flex items-center justify-center ${
                            isSelected ? 'bg-[#0A0A0A] text-[#FFFFFF]' : 'bg-[#18181B] text-[#FFFFFF]'
                          }`}
                        >
                          <IconComp className="w-5 h-5" />
                        </div>
                        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.06em] truncate max-w-full block">
                          {item.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Emoji Grid */}
          {activeTab === 'emoji' && (
            <div className="space-y-4">
              {/* Quick Custom Emoji Input */}
              <div className="bg-[#0A0A0A] p-3 rounded-sm border border-[#27272A] flex items-center gap-2 font-mono">
                <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#A1A1AA] shrink-0">Custom Emoji:</span>
                <input
                  type="text"
                  value={customEmojiInput}
                  onChange={(e) => setCustomEmojiInput(e.target.value)}
                  placeholder="Paste emoji..."
                  className="flex-1 px-2.5 py-1 bg-[#18181B] border border-[#27272A] focus:border-[#FFFFFF] rounded-sm text-sm text-[#FFFFFF] text-center focus:outline-none"
                />
                <button
                  type="button"
                  disabled={!customEmojiInput.trim()}
                  onClick={() => {
                    if (customEmojiInput.trim()) {
                      onSelect({ iconType: 'emoji', iconValue: customEmojiInput.trim() });
                      onClose();
                    }
                  }}
                  className="px-3 py-1.5 bg-[#FF5500] hover:bg-[#e04b00] disabled:bg-[#27272A] disabled:text-[#71717A] text-[#FFFFFF] text-[11px] font-bold uppercase tracking-[0.06em] rounded-sm cursor-pointer"
                >
                  Use Emoji
                </button>
              </div>

              {filteredEmojis.length === 0 ? (
                <div className="text-center py-8 text-[#71717A] font-mono text-xs">
                  No emojis match "{searchQuery}".
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {filteredEmojis.map((item) => {
                    const isSelected =
                      currentVisual?.iconType === 'emoji' && currentVisual.iconValue === item.emoji;

                    return (
                      <button
                        key={item.emoji + item.name}
                        type="button"
                        onClick={() => {
                          onSelect({ iconType: 'emoji', iconValue: item.emoji });
                          onClose();
                        }}
                        className={`p-2.5 rounded-sm border flex flex-col items-center justify-center gap-1 text-center cursor-pointer ${
                          isSelected
                            ? 'bg-[#FFFFFF] text-[#0A0A0A] border-[#FFFFFF]'
                            : 'bg-[#0A0A0A] hover:bg-[#242427] text-[#FFFFFF] border-[#27272A]'
                        }`}
                        title={item.name}
                      >
                        <span className="text-2xl select-none">
                          {item.emoji}
                        </span>
                        <span className="font-mono text-[10px] font-medium truncate max-w-full block">
                          {item.name.split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Custom SVG Code / Icon URL */}
          {activeTab === 'custom' && (
            <div className="space-y-4 font-mono">
              <div className="bg-[#0A0A0A] p-4 rounded-sm border border-[#27272A] space-y-3">
                <label className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[#A1A1AA]">
                  Paste Custom SVG Code or Image URL
                </label>
                <textarea
                  rows={4}
                  value={customSvgInput}
                  onChange={(e) => setCustomSvgInput(e.target.value)}
                  placeholder='<svg viewBox="0 0 24 24" ...>...</svg>  OR  https://example.com/icon.svg'
                  className="w-full px-3 py-2 bg-[#18181B] border border-[#27272A] focus:border-[#FFFFFF] rounded-sm text-xs font-mono text-[#FFFFFF] focus:outline-none placeholder:text-[#71717A]"
                />

                {customSvgInput.trim() && (
                  <div className="flex items-center gap-3 p-3 bg-[#18181B] rounded-sm border border-[#27272A]">
                    <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#A1A1AA]">Live Preview:</span>
                    <div className="w-8 h-8 rounded-sm bg-[#0A0A0A] border border-[#27272A] flex items-center justify-center text-[#FFFFFF] p-1">
                      {renderCategoryIcon(
                        { iconType: 'custom_svg', iconValue: customSvgInput.trim() },
                        categoryName,
                        'w-5 h-5'
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  disabled={!customSvgInput.trim()}
                  onClick={() => {
                    if (customSvgInput.trim()) {
                      onSelect({ iconType: 'custom_svg', iconValue: customSvgInput.trim() });
                      onClose();
                    }
                  }}
                  className="w-full py-2.5 bg-[#FF5500] hover:bg-[#e04b00] disabled:bg-[#27272A] disabled:text-[#71717A] text-[#FFFFFF] text-[11px] font-bold uppercase tracking-[0.06em] rounded-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Apply Custom SVG</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-[#27272A] flex items-center justify-between bg-[#0A0A0A] shrink-0 font-mono">
          <button
            type="button"
            onClick={() => {
              onSelect({ iconType: 'lucide', iconValue: '' });
              onClose();
            }}
            className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#A1A1AA] hover:text-[#EF4444] cursor-pointer"
          >
            Clear / Auto-detect Icon
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-[#18181B] hover:bg-[#242427] border border-[#27272A] text-[#FFFFFF] font-bold text-[11px] uppercase tracking-[0.06em] rounded-sm cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
});

CategoryIconPicker.displayName = 'CategoryIconPicker';
