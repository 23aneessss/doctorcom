import { ModeleOrdonnanceDialog } from "./modele-ordonnance-dialog";

export function ModifierOrdonnanceDialog({
  open,
  onOpenChange,
  templateId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string | null;
  onSaved?: () => Promise<void> | void;
}) {
  return (
    <ModeleOrdonnanceDialog
      mode="edit"
      onOpenChange={onOpenChange}
      onSaved={onSaved}
      open={open}
      templateId={templateId}
    />
  );
}
