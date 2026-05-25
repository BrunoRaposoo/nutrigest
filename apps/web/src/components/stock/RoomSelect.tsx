import { useRooms } from '../../hooks/queries/use-minibar-queries';

interface RoomSelectProps {
  value: number;
  onChange: (room: number) => void;
}

export default function RoomSelect({ value, onChange }: RoomSelectProps) {
  const { data: rooms = [] } = useRooms();

  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full px-4 py-3 text-lg rounded-xl border border-gray-300 dark:border-gray-600
                 bg-white dark:bg-navy-800 font-medium cursor-pointer
                 focus:outline-none focus:ring-2 focus:ring-navy-500"
    >
      <option value="" disabled>
        Selecione um quarto
      </option>
      {rooms.map((room) => (
        <option key={room} value={room}>
          Quarto {room}
        </option>
      ))}
    </select>
  );
}
