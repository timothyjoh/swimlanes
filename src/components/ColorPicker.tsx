import { getColorForLabel } from '../utils/cardColors';

type CardColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'gray';

interface ColorPickerProps {
  selectedColor: CardColor;
  onChange: (color: CardColor) => void;
}

export default function ColorPicker({ selectedColor, onChange }: ColorPickerProps) {
  const colors: CardColor[] = ['red', 'blue', 'green', 'yellow', 'purple', 'gray'];

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Color
      </label>
      <div className="grid grid-cols-3 gap-2">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={`
              w-full h-16 rounded-lg border-2 transition-all
              ${selectedColor === color ? 'border-gray-900 scale-105' : 'border-gray-300'}
              hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500
            `}
            style={{ backgroundColor: getColorForLabel(color) }}
            aria-label={`Select ${color} color`}
          >
            {selectedColor === color && (
              <svg className="w-6 h-6 mx-auto text-white filter drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
