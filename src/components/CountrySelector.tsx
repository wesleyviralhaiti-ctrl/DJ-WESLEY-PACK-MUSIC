import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, Check, Globe } from 'lucide-react';
import {
  POPULAR_COUNTRIES,
  filterCountries,
  getCountryByCode,
  getRegionCurrencyBadge,
} from '../data/countries';

interface CountrySelectorProps {
  selectedCountryCode: string;
  onSelectCountry: (code: string) => void;
  compact?: boolean;
  align?: 'left' | 'right';
}

export const CountrySelector: React.FC<CountrySelectorProps> = ({
  selectedCountryCode,
  onSelectCountry,
  compact = false,
  align = 'right',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const selectedCountry = useMemo(
    () => getCountryByCode(selectedCountryCode),
    [selectedCountryCode]
  );

  const filteredCountries = useMemo(
    () => filterCountries(searchQuery),
    [searchQuery]
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      window.setTimeout(() => {
        searchInputRef.current?.focus();
      }, 30);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  const handlePick = (code: string) => {
    onSelectCountry(code);
    setIsOpen(false);
  };

  const currencyBadge = getRegionCurrencyBadge(selectedCountry.code);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Peyi seleksyone: ${selectedCountry.name} (${currencyBadge})`}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-zinc-700/90 bg-[#13151B] hover:border-emerald-500/60 text-zinc-100 transition-colors cursor-pointer whitespace-nowrap ${
          compact ? 'px-2.5 py-1.5 text-xs' : 'px-2.5 sm:px-3 py-2 text-xs'
        }`}
      >
        <span className="text-base leading-none" aria-hidden="true">
          {selectedCountry.flag}
        </span>
        <span className="font-semibold max-w-[90px] sm:max-w-[140px] truncate">
          {selectedCountry.name}
        </span>
        {!compact && (
          <span className="hidden lg:inline-flex rounded bg-emerald-500/15 border border-emerald-500/35 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
            {currencyBadge}
          </span>
        )}
        <ChevronDown
          className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute mt-2 z-50 w-[min(92vw,360px)] rounded-2xl border border-zinc-700/90 bg-[#13151B] shadow-[0_18px_48px_rgba(0,0,0,0.8)] overflow-hidden ${
            align === 'left' ? 'left-0' : 'right-0'
          }`}
        >
          {/* Search Bar */}
          <div className="p-3 border-b border-zinc-800 bg-[#0B0C10]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Chèche peyi w / Search your country..."
                aria-label="Chèche peyi w"
                className="w-full rounded-xl bg-[#13151B] border border-zinc-700 pl-9 pr-3 py-2.5 text-xs sm:text-sm text-white placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-zinc-800/70">
            {/* Popular Quick-Picks (shown cleanly when search is empty) */}
            {!searchQuery.trim() && (
              <div className="p-3 bg-[#0E1015]">
                <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-400 mb-2">
                  ⭐ Peyi Popilè (Quick-Pick)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_COUNTRIES.map((country) => {
                    const active = country.code === selectedCountry.code;
                    return (
                      <button
                        key={`pop-${country.code}`}
                        type="button"
                        onClick={() => handlePick(country.code)}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                          active
                            ? 'bg-emerald-500 border-emerald-400 text-zinc-950 font-bold'
                            : 'bg-[#13151B] border-zinc-700/80 text-zinc-200 hover:border-emerald-500/60 hover:text-white'
                        }`}
                      >
                        <span aria-hidden="true">{country.flag}</span>
                        <span>{country.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Full Worldwide ISO Country List */}
            <div role="listbox" aria-label="Tout peyi nan mond lan" className="py-1">
              {!searchQuery.trim() && (
                <div className="px-3 py-1.5 flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-400">
                  <Globe className="h-3 w-3 text-emerald-400" />
                  <span>Tout Peyi nan Mond lan ({filteredCountries.length})</span>
                </div>
              )}

              {filteredCountries.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-zinc-400">
                  Pa gen okenn peyi ki koresponn ak « {searchQuery} ».
                </p>
              ) : (
                filteredCountries.map((country) => {
                  const isSelected = country.code === selectedCountry.code;
                  const priceBadge = getRegionCurrencyBadge(country.code);
                  return (
                    <button
                      key={country.code}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handlePick(country.code)}
                      className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left text-xs sm:text-sm transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-500/15 text-emerald-300 font-bold'
                          : 'text-zinc-200 hover:bg-zinc-800/70'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span className="text-base leading-none shrink-0" aria-hidden="true">
                          {country.flag}
                        </span>
                        <span className="truncate">{country.name}</span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono text-zinc-400">
                          {priceBadge}
                        </span>
                        {isSelected && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
