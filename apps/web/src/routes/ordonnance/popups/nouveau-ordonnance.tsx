import { ModeleOrdonnanceDialog } from "./modele-ordonnance-dialog";

export function NouveauOrdonnanceDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => Promise<void> | void;
}) {
  return (
    <ModeleOrdonnanceDialog
      mode="create"
      onOpenChange={onOpenChange}
      onSaved={onSaved}
      open={open}
    />
  );
}
