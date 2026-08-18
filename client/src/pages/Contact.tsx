import PublicPageLayout from "@/components/PublicPageLayout";
import { Button } from "@/components/ui/button";

const contactEmail = String(import.meta.env.PUBLIC_CONTACT_EMAIL || "").trim();

export default function Contact() {
  return (
    <PublicPageLayout title="Contato" eyebrow="BeUpFree / UpPulse">
      <p>Use este canal para assuntos institucionais, privacidade, parcerias e avaliação da demonstração.</p>
      {contactEmail ? (
        <Button asChild>
          <a href={`mailto:${contactEmail}`} data-testid="contact-email">Enviar e-mail para {contactEmail}</a>
        </Button>
      ) : (
        <div className="not-prose rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950" data-testid="contact-pending">
          O e-mail institucional definitivo está em configuração. Antes da publicação, defina <code>PUBLIC_CONTACT_EMAIL</code> no ambiente de build.
        </div>
      )}
    </PublicPageLayout>
  );
}
