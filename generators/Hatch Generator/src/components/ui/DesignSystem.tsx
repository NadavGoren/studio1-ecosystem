import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

// --- LABEL ---
export const Label = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  // INCREASED: Font size and contrast
  <label className={`text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5 block ${className}`}>
    {children}
  </label>
);

// --- INPUT (Text/Number) ---
export const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input 
    {...props}
    className={`w-full bg-white border border-gray-300 rounded-md px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all ${props.className}`}
  />
);

// --- SLIDER ---
export const Slider = ({ value, min, max, step, onChange, label, suffix = "", snapPoints, onMouseDown, onMouseUp }: { value: number, min: number, max: number, step: number, onChange: (val: number) => void, label?: string, suffix?: string, snapPoints?: number[], onMouseDown?: () => void, onMouseUp?: () => void }) => {
  // Helper function to snap to nearest snap point if within threshold
  const snapToPoint = (val: number): number => {
    if (!snapPoints || snapPoints.length === 0) return val;
    
    const threshold = 5; // Snap if within 5 degrees
    const normalizedVal = ((val % 360) + 360) % 360; // Normalize to 0-360
    
    let nearestSnapPoint = normalizedVal;
    let minDistance = Infinity;
    
    for (const point of snapPoints) {
      const normalizedPoint = ((point % 360) + 360) % 360;
      // Check both direct distance and wrapped distance (e.g., 359 to 0)
      const dist1 = Math.abs(normalizedVal - normalizedPoint);
      const dist2 = 360 - dist1;
      const distance = Math.min(dist1, dist2);
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestSnapPoint = normalizedPoint;
      }
    }
    
    // If we're close enough to a snap point, return it; otherwise return original value
    return minDistance <= threshold ? nearestSnapPoint : val;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = parseFloat(e.target.value);
    const snappedValue = snapPoints ? snapToPoint(rawValue) : rawValue;
    onChange(snappedValue);
  };

  return (
    <div className="flex flex-col gap-1.5 w-full mb-2">
      {/* Always render header row if label exists OR just to show value */}
      <div className="flex justify-between items-center">
        {label && <span className="text-sm font-medium text-gray-700">{label}</span>}
        <span className="text-xs font-mono font-bold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded">
          {Math.round(value * 100) / 100}{suffix}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={handleChange}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black hover:bg-gray-300 transition-colors"
      />
    </div>
  );
};

// --- SWITCH (Checkbox) ---
export const Switch = ({ checked, onChange, label }: { checked: boolean, onChange: (val: boolean) => void, label: string }) => (
  <div className="flex items-center justify-between cursor-pointer group py-1" onClick={() => onChange(!checked)}>
    <span className="text-sm text-gray-700 group-hover:text-black transition-colors font-medium">{label}</span>
    <div className={`w-9 h-5 flex items-center rounded-full p-1 transition-colors duration-300 ${checked ? 'bg-black' : 'bg-gray-300'}`}>
      <div className={`bg-white w-3.5 h-3.5 rounded-full shadow-sm transform transition-transform duration-300 ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </div>
  </div>
);

// --- SECTION (Collapsible) ---
export const Section = ({ title, children, defaultOpen = true, extra }: { title: string, children: React.ReactNode, defaultOpen?: boolean, extra?: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-200 last:border-0">
      <div className="flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 cursor-pointer select-none transition-colors" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center gap-2 text-xs font-bold text-gray-800 uppercase tracking-wider">
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {title}
        </div>
        {extra && <div onClick={e => e.stopPropagation()}>{extra}</div>}
      </div>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
};

// --- ICON BUTTON ---
export const IconButton = ({ onClick, icon: Icon, label, active = false, disabled = false }: any) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg border transition-all
      ${active ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-black'}
      ${disabled ? 'opacity-40 cursor-not-allowed grayscale' : 'cursor-pointer shadow-sm'}
    `}
    title={label}
  >
    <Icon size={18} />
    <span className="text-[10px] font-bold">{label}</span>
  </button>
);







