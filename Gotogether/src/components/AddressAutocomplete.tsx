import { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2, CheckCircle2, ChevronDown } from 'lucide-react';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
}

interface AddressAutocompleteProps {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  latitude?: string;
  longitude?: string;
  error?: string;
  onChange: (label: string, lat: string, lng: string) => void;
}

export function AddressAutocomplete({
  id,
  label,
  placeholder = 'Search address or landmark...',
  value,
  latitude,
  longitude,
  error,
  onChange,
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showCoords, setShowCoords] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 3 || trimmed === value) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
            trimmed
          )}&format=json&addressdetails=1&limit=5&countrycodes=in`,
          {
            headers: {
              'User-Agent': 'GoTogetherApp-Autocomplete/2.0',
            },
          }
        );
        if (!response.ok) throw new Error('Geocoding request failed');
        const data: NominatimResult[] = await response.json();
        setResults(data);
        setIsOpen(true);
      } catch (err) {
        console.warn('Geocoding error:', err);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [query, value]);

  const handleSelect = (result: NominatimResult) => {
    const parts = result.display_name.split(',').map((p) => p.trim());
    const shortLabel = parts.slice(0, 3).join(', ');

    setQuery(shortLabel);
    setIsOpen(false);
    onChange(shortLabel, parseFloat(result.lat).toFixed(4), parseFloat(result.lon).toFixed(4));
  };

  const hasCoords = Boolean(latitude && longitude && !Number.isNaN(parseFloat(latitude)));

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={id} className="block text-xs font-bold uppercase tracking-wider text-slate-300">
          {label}
        </label>
        {hasCoords && (
          <button
            type="button"
            onClick={() => setShowCoords(!showCoords)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300"
          >
            <CheckCircle2 className="h-3 w-3" />
            <span>{parseFloat(latitude!).toFixed(3)}, {parseFloat(longitude!).toFixed(3)}</span>
            <ChevronDown className="h-2.5 w-2.5 opacity-60" />
          </button>
        )}
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
          <MapPin className="h-4 w-4 text-cyan-400" />
        </div>

        <input
          id={id}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen && e.target.value.length >= 3) setIsOpen(true);
          }}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="glass-input w-full rounded-xl py-2 pl-9 pr-8 text-xs text-white placeholder-slate-400 outline-none"
        />

        <div className="absolute inset-y-0 right-0 flex items-center pr-2.5">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />}
        </div>
      </div>

      {/* Autocomplete Glass Dropdown */}
      {isOpen && results.length > 0 && (
        <ul className="glass-modal absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-2xl p-1.5 text-xs shadow-2xl border border-white/15">
          {results.map((item) => (
            <li
              key={item.place_id}
              onClick={() => handleSelect(item)}
              className="flex cursor-pointer items-start gap-2.5 rounded-xl p-2.5 transition hover:bg-white/10"
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-white">
                  {item.name || item.display_name.split(',')[0]}
                </p>
                <p className="truncate text-[11px] text-slate-400">
                  {item.display_name}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-1 text-xs text-rose-400 font-medium">{error}</p>}
    </div>
  );
}
