import React, { useState, useMemo } from 'react';
import {
  Search,
  Smile,
  Sparkles,
  X,
  Check,
  Code2,
  Image as ImageIcon
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

export const CategoryIconPicker: React.FC<CategoryIconPickerProps> = ({
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
    <div className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 animate-fadeIn">
      <div
        className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
        style={{ contain: 'content', transform: 'translateZ(0)' }}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div>
            <h3 className="font-heading font-extrabold text-base sm:text-lg text-slate-900">
              Select Category Icon / Emoji
            </h3>
            <p className="text-xs text-slate-500">
              Choose an SVG icon or Emoji to appear before "{categoryName || 'Category'}"
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher & Search Bar */}
        <div className="p-4 border-b border-slate-100 space-y-3 bg-white shrink-0">
          {/* Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('svg')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'svg'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>SVG Icons ({LUCIDE_FOOD_ICONS.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('emoji')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'emoji'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Smile className="w-3.5 h-3.5" />
              <span>Food Emojis</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('custom')}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'custom'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Custom SVG</span>
            </button>
          </div>

          {/* Search Bar for SVG and Emoji tabs */}
          {activeTab !== 'custom' && (
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === 'svg'
                    ? 'Search SVG icon (e.g. pizza, coffee, cake, drinks, salad...)'
                    : 'Search emoji (e.g. burger, ice cream, pasta, drinks...)'
                }
                className="w-full pl-9 pr-8 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="p-4 overflow-y-auto max-h-[50vh] flex-1 custom-scrollbar">
          {/* TAB 1: SVG Icons Grid */}
          {activeTab === 'svg' && (
            <div>
              {filteredSvgIcons.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No SVG icons match "{searchQuery}". Try searching "food", "drink", or "meal".
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
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
                        className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center group cursor-pointer ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20'
                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                            isSelected ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          <IconComp className="w-5 h-5" />
                        </div>
                        <span className="text-[11px] font-bold truncate max-w-full block">
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
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600 shrink-0">Custom Emoji:</span>
                <input
                  type="text"
                  value={customEmojiInput}
                  onChange={(e) => setCustomEmojiInput(e.target.value)}
                  placeholder="Type/Paste any emoji..."
                  className="flex-1 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:ring-1 focus:ring-slate-900"
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
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Use Emoji
                </button>
              </div>

              {filteredEmojis.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
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
                        className={`p-2.5 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all text-center group cursor-pointer ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20'
                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                        title={item.name}
                      >
                        <span className="text-2xl transition-transform group-hover:scale-125 select-none">
                          {item.emoji}
                        </span>
                        <span className="text-[10px] font-medium truncate max-w-full block">
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
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <label className="block text-xs font-bold text-slate-800">
                  Paste Custom SVG Code or Image URL
                </label>
                <textarea
                  rows={4}
                  value={customSvgInput}
                  onChange={(e) => setCustomSvgInput(e.target.value)}
                  placeholder='<svg viewBox="0 0 24 24" ...>...</svg>  OR  https://example.com/icon.svg'
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 placeholder:text-slate-400"
                />

                {customSvgInput.trim() && (
                  <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-500">Live Preview:</span>
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-800 p-1">
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
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Check className="w-4 h-4" />
                  <span>Apply Custom SVG</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <button
            type="button"
            onClick={() => {
              onSelect({ iconType: 'lucide', iconValue: '' });
              onClose();
            }}
            className="text-xs font-bold text-slate-500 hover:text-rose-600 transition-colors"
          >
            Clear / Auto-detect Icon
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
