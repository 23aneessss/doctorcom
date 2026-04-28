import { Trash2 } from "lucide-react";

import linkOutlineIcon from "./0bfcd7686f0dd9db316efa2ed4de20daa139f9e4.svg";
import linkSlashIcon from "./b5bd840c227881f698eab2cc9f4278fed5a208ec.svg";
import eyeIcon from "./158f0a8159edfb6da48fd13114421bbe48fb7682.svg";
import pencilIcon from "./80bad5cc01254c23b6c35b19fee9da9ff831e85a.svg";

type MedicationCardProps = {
  id: number;
  name: string;
  scientificName: string;
  primaryTag: string;
  secondaryTag: string;
  condition: string;
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
  secondaryTag,
  condition,
  onView,
  onEdit,
  onDelete,
  isDeleting = false,
}: MedicationCardProps) {
  return (
    <article className="flex h-[239px] w-[335px] flex-col gap-[11px] overflow-hidden rounded-[16px] border border-[#C2E0EF] bg-white p-[20px] shadow-[0px_4px_20px_rgba(194,224,239,0.5)]">
      <div className="flex h-[49px] items-start justify-between gap-[12px]">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-['Plus_Jakarta_Sans'] text-[17px] font-bold leading-[25.5px] text-[#0F3460]">
            {name}
          </h3>
          <p className="mt-[4px] truncate font-['Plus_Jakarta_Sans'] text-[13px] font-normal leading-[19.5px] text-[#052CA0] opacity-70">
            {scientificName}
          </p>
        </div>

        <button
          type="button"
          className="relative flex size-[40px] shrink-0 items-center justify-center rounded-[10px] bg-[rgba(194,224,239,0.2)]"
        >
          <div className="relative size-[20px]">
            <img alt="" aria-hidden="true" className="absolute inset-[1.68px] size-[16.64px] max-w-none" src={linkOutlineIcon} />
            <img alt="" aria-hidden="true" className="absolute inset-[6.67px] size-[6.66px] max-w-none" src={linkSlashIcon} />
          </div>
        </button>
      </div>

      <div className="flex max-w-full min-w-0 items-center gap-[7px] overflow-hidden">
        <span className="h-[30px] w-[134.667px] shrink-0 truncate rounded-[8px] border border-[#052CA0] bg-[#052CA0] px-[12px] py-[6px] font-['Plus_Jakarta_Sans'] text-[12px] font-semibold leading-[18px] text-white shadow-[0_0_0_1px_#052CA0]">
          {primaryTag}
        </span>
        <span className="h-[31.333px] w-[124.667px] shrink-0 truncate rounded-[8px] border border-[#C2E0EF] bg-[#FFFDFB] px-[12px] py-[6px] font-['Plus_Jakarta_Sans'] text-[12px] font-semibold leading-[18px] text-[#052CA0] shadow-[0_0_0_1px_#C2E0EF]">
          {secondaryTag}
        </span>
      </div>

      <p
        className="max-w-[225.667px] overflow-hidden break-words font-['Plus_Jakarta_Sans'] text-[14px] font-normal leading-[22.75px] text-[#052CA0]"
        style={{
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 2,
        }}
      >
        {condition}
      </p>

      <div className="mt-auto flex h-[53px] items-center gap-[8px] border-t-[0.667px] border-[#C2E0EF] pt-[0.667px]">
        <button
          type="button"
          onClick={() => onView(id)}
          className="flex h-[36px] w-[196.333px] items-center justify-center gap-[8px] rounded-[10px] bg-[rgba(194,224,239,0.2)] px-[39px] py-[8px]"
        >
          <img alt="" aria-hidden="true" className="size-[16px]" src={eyeIcon} />
          <span className="font-['Plus_Jakarta_Sans'] text-[14px] font-medium leading-[20px] text-[#052CA0]">
            Voir
          </span>
        </button>

        <button
          type="button"
          onClick={() => onEdit(id)}
          className="flex h-[33.333px] w-[41.333px] items-center justify-center rounded-[10px] border border-[#052CA0] bg-[#FFFDFB]"
        >
          <img alt="" aria-hidden="true" className="size-[14.666px]" src={pencilIcon} />
        </button>

        <button
          type="button"
          disabled={isDeleting}
          onClick={() => onDelete(id)}
          className="flex h-[33.333px] w-[41.333px] items-center justify-center rounded-[10px] border border-[#052CA0] bg-[#FFFDFB] transition-colors hover:bg-[#F7FAFD] disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Trash2 className="size-[14px] text-[#F77A21]" strokeWidth={1.9} />
        </button>
      </div>
    </article>
  );
}
