import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  count: number;
  error: string | null;
  isSubmitting: boolean;
  onConfirm: () => void;
  onDecline: () => void;
};

export default function FavoritesImportDialog({ count, error, isSubmitting, onConfirm, onDecline }: Props) {
  return (
    <Dialog open modal>
      <DialogContent
        className="sm:max-w-md"
        data-testid="favorites-import-dialog"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Favoritos salvos neste dispositivo</DialogTitle>
          <DialogDescription>
            Encontramos {count} {count === 1 ? "produto salvo" : "produtos salvos"} neste dispositivo.
            {" "}Deseja adicioná-{count === 1 ? "lo" : "los"} aos Favoritos da sua conta?
          </DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onDecline} disabled={isSubmitting}>
            Não adicionar
          </Button>
          <Button type="button" onClick={onConfirm} disabled={isSubmitting} autoFocus>
            {isSubmitting ? "Adicionando..." : "Adicionar à minha conta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
