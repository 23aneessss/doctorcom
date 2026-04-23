import { Eye, Paperclip, Pencil, Trash2 } from "lucide-react";

type MedicationCardProps = {
  name: string;
  scientificName: string;
  primaryTag: string;
  secondaryTag: string;
  condition: string;
};

export function MedicationCard({
  name,
  scientificName,
  primaryTag,
  secondaryTag,
  condition,
}: MedicationCardProps) {
  return (
    <article className="flex h-[239px] w-[335px] flex-col rounded-[14px] border border-[#CBE4F1] bg-white px-[13px] pb-[13px] pt-[15px] shadow-[0px_10px_22px_rgba(118,187,221,0.16)]">
      <div className="mb-[10px] flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-['Inter'] text-[18px] font-semibold leading-[1.1] text-[#0F3460]">
            {name}
          </h3>
          <p className="mt-[5px] font-['Inter'] text-[12px] font-normal leading-none text-[#8AA3C7]">
            {scientificName}
          </p>
        </div>

        <button
          type="button"
          className="flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[#F3F9FD]"
        >
          <Paperclip className="size-[16px] text-[#174AA8]" strokeWidth={2.3} />
        </button>
      </div>

      <div className="mb-[12px] flex flex-wrap gap-[8px]">
        <span className="rounded-[7px] bg-[#173FB8] px-[11px] py-[6px] font-['Inter'] text-[12px] font-medium leading-none text-white">
          {primaryTag}
        </span>
        <span className="rounded-[7px] border border-[#CBE2F0] bg-white px-[11px] py-[6px] font-['Inter'] text-[12px] font-medium leading-none text-[#173FB8]">
          {secondaryTag}
        </span>
      </div>

      <p className="mb-[16px] font-['Inter'] text-[16px] font-normal leading-[1.15] text-[#1F4CC3]">
        {condition}
      </p>

      <div className="mt-auto border-t border-[#E6F0F6] pt-[12px]">
        <div className="flex items-center gap-[8px]">
          <button
            type="button"
            className="flex h-[36px] flex-1 items-center justify-center gap-[7px] rounded-[10px] bg-[#F3F9FD] font-['Inter'] text-[14px] font-normal text-[#173FB8]"
          >
            <Eye className="size-[14px]" strokeWidth={2.1} />
            Voir
          </button>

          <button
            type="button"
            className="flex size-[36px] items-center justify-center rounded-[10px] border border-[#F5D1AF] bg-white text-[#FF8A1F]"
          >
            <Pencil className="size-[14px]" strokeWidth={2.15} />
          </button>

          <button
            type="button"
            className="flex size-[36px] items-center justify-center rounded-[10px] border border-[#F5D1AF] bg-white text-[#FF8A1F]"
          >
            <Trash2 className="size-[14px]" strokeWidth={2.05} />
          </button>
        </div>
      </div>
    </article>
  );
}
