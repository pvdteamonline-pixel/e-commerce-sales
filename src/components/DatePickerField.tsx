import React from "react";
import { Calendar } from "lucide-react";
import { formatDateDisplay } from "../utils";

interface DatePickerFieldProps {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  textClassName?: string;
  placeholder?: string;
}

export const DatePickerField: React.FC<DatePickerFieldProps> = ({
  value,
  onChange,
  className,
  textClassName,
  placeholder,
}) => {
  return (
    <div
      className={
        className ||
        "group relative flex items-center justify-between bg-white dark:bg-neutral-900/90 hover:bg-neutral-50 dark:hover:bg-neutral-800/90 border border-neutral-200/80 dark:border-neutral-800 hover:border-indigo-400 dark:hover:border-indigo-500/50 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/15 rounded-xl px-3.5 py-2.5 min-h-[42px] transition-all duration-200 cursor-pointer select-none shadow-xs hover:shadow-sm active:scale-[0.99] flex-1 w-full sm:min-w-[140px]"
      }
    >
      <span
        className={
          textClassName ||
          "text-xs font-semibold text-neutral-800 dark:text-neutral-100 tracking-tight mr-3 flex-1 text-left whitespace-nowrap"
        }
      >
        {formatDateDisplay(value) || placeholder || ""}
      </span>
      <Calendar className="h-4 w-4 text-neutral-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors shrink-0" />
      <input
        type="date"
        value={value}
        onChange={(e) => {
          let val = e.target.value;
          const parts = val.split("-");
          if (parts[0] && parts[0].length > 4) {
            parts[0] = parts[0].slice(0, 4);
            val = parts.join("-");
          }
          onChange(val);
        }}
        onClick={(e) => {
          try {
            e.currentTarget.showPicker();
          } catch {
            // Fallback for older browsers
          }
        }}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 pointer-events-auto"
      />
    </div>
  );
};

