import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const EVENT_NAME = "uppulse:demo-product-notice";

function safeReferenceUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (/(^|\.)mercadolivre\.com\.br$/i.test(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function requestDemoProductNotice(referenceUrl?: string | null): void {
  window.dispatchEvent(
    new CustomEvent(EVENT_NAME, { detail: { referenceUrl: safeReferenceUrl(referenceUrl) } }),
  );
}

export default function DemoProductDialogHost() {
  const [open, setOpen] = useState(false);
  const [referenceUrl, setReferenceUrl] = useState<string | null>(null);

  useEffect(() => {
    const show = (event: Event) => {
      const detail = (event as CustomEvent<{ referenceUrl?: string | null }>).detail;
      setReferenceUrl(safeReferenceUrl(detail?.referenceUrl));
      setOpen(true);
    };
    window.addEventListener(EVENT_NAME, show);
    return () => window.removeEventListener(EVENT_NAME, show);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent data-testid="demo-product-dialog" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Produto demonstrativo</DialogTitle>
          <DialogDescription className="leading-6">
            Os produtos desta versão de demonstração são referências selecionadas manualmente.
            Consulte preço, disponibilidade e condições comerciais diretamente na loja responsável.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Entendi
          </Button>
          {referenceUrl && (
            <Button asChild>
              <a href={referenceUrl} target="_blank" rel="noopener noreferrer">
                Visitar loja
              </a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
