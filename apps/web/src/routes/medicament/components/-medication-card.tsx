import { Eye, FlaskConical, Pencil, Trash2 } from "lucide-react";

type MedicationCardProps = {
  id: number;
  name: string;
  scientificName: string;
  primaryTag: string;
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  isDeleting?: boolean;
};

export function MedicationCard({
  id,
  name,
  scientificName,
  primaryTag,
  onView,
  onEdit,
  onDelete,
  isDeleting = false,
}: MedicationCardProps) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-[20px] border border-[#cfe6f3] bg-white shadow-[0px_10px_28px_-18px_rgba(15,52,96,0.18)] transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-[3px] hover:border-[#afd4ea] hover:shadow-[0px_20px_36px_-20px_rgba(15,52,96,0.26)]">

      <div className="flex flex-1 flex-col gap-3 px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-['Plus_Jakarta_Sans'] text-[14px] font-bold leading-[1.35] text-[#0f3460] truncate">
              {name}
            </h3>
            <p className="mt-[3px] font-['Inter'] text-[11px] font-medium leading-[1.4] text-[#4d7291] truncate">
              {scientificName}
            </p>
          </div>

          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[9px] border border-[#d6edf8] bg-[#eef7fc]">
            <FlaskConical className="size-[14px] text-[#4a7a9b]" strokeWidth={1.8} />
          </span>
        </div>

        <span className="w-fit inline-flex h-[24px] items-center rounded-full bg-[#052CA0] px-3 font-['Inter'] text-[11px] font-semibold text-white truncate max-w-full">
          {primaryTag}
        </span>
      </div>

      <div className="flex items-center gap-2 border-t border-[#e8f3fb] px-4 py-3">
        <button
          type="button"
          onClick={() => onView(id)}
          className="flex h-[34px] flex-1 items-center justify-center gap-1.5 rounded-[11px] bg-[#f0f8ff] font-['Plus_Jakarta_Sans'] text-[12px] font-semibold text-[#265284] transition-colors hover:bg-[#e2f0fb]"
        >
          <Eye className="size-[13px]" strokeWidth={2} />
          Voir
        </button>

        <button
          type="button"
          onClick={() => onEdit(id)}
          className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-[10px] border border-[#d7e7f2] bg-white text-[#f77a21] shadow-[0px_2px_6px_-4px_rgba(15,52,96,0.14)] transition-[transform,border-color,box-shadow] duration-150 hover:-translate-y-px hover:border-[#b5d5ea] hover:shadow-[0px_6px_12px_-8px_rgba(15,52,96,0.22)]"
        >
          <Pencil className="size-[13px]" strokeWidth={2} />
        </button>

        <button
          type="button"
          disabled={isDeleting}
          onClick={() => onDelete(id)}
          className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-[10px] border border-[#d7e7f2] bg-white text-[#f77a21] shadow-[0px_2px_6px_-4px_rgba(15,52,96,0.14)] transition-[transform,border-color,box-shadow] duration-150 hover:-translate-y-px hover:border-[#b5d5ea] hover:shadow-[0px_6px_12px_-8px_rgba(15,52,96,0.22)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 className="size-[13px]" strokeWidth={2} />
        </button>
      </div>
    </article>
  );
}
