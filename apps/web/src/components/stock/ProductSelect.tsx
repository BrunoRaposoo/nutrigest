import { useState, useMemo, useRef, useEffect } from 'react';
import type { Product } from '../../types/product';

interface ProductSelectProps {
  products: Product[];
  value: string;
  onChange: (productId: string) => void;
  placeholder?: string;
  categoryFilter?: string;
}

export default function ProductSelect({
  products,
  value,
  onChange,
  placeholder = 'Buscar produto...',
  categoryFilter,
}: ProductSelectProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    let list = products;
    if (categoryFilter) {
      list = list.filter((p) => p.category === categoryFilter);
    }
    if (!query) return list;
    const q = query.toLowerCase();
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q),
    );
  }, [products, query, categoryFilter]);

  const selected = products.find((p) => p.id === value);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={open ? query : selected?.name ?? ''}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-500 dark:bg-navy-800 dark:border-gray-700"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-navy-800 border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => {
                onChange(product.id);
                setQuery('');
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-navy-700 flex items-center gap-2"
            >
              {product.imageUrl && (
                <img src={product.imageUrl} alt="" className="w-6 h-6 rounded object-cover" />
              )}
              <span>{product.name}</span>
              <span className="ml-auto text-xs text-gray-400">
                {product.category === 'MEAL' ? 'Marmita' : 'Bebida'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
