import { Link } from "wouter";
import logoImage from "@assets/Photoroom-20251213_085728_1765685713469.png";

const links = [
  { label: "Sobre", href: "/sobre" },
  { label: "Como funciona", href: "/como-funciona" },
  { label: "Política de Privacidade", href: "/politica-de-privacidade" },
  { label: "Termos de Uso", href: "/termos-de-uso" },
  { label: "Contato", href: "/contato" },
];

export default function Footer() {
  return (
    <footer className="border-t bg-card" data-testid="footer">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 md:grid-cols-[1.2fr_1fr]">
          <div className="max-w-xl">
            <div className="flex items-center gap-2">
              <img src={logoImage} alt="" className="h-8 w-auto" />
              <p className="text-xl font-bold text-primary" data-testid="text-footer-logo">BeUpFree</p>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground" data-testid="text-footer-description">
              O UpPulse é uma demonstração de descoberta, organização e inteligência sobre oportunidades comerciais. Não realizamos vendas diretamente.
            </p>
          </div>
          <nav aria-label="Links institucionais" className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            {links.map((item) => (
              <Link key={item.href} href={item.href} data-testid={`footer-link-${item.href.slice(1)}`}>
                <span className="cursor-pointer text-muted-foreground hover:text-foreground">{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-8 border-t pt-6 text-xs leading-5 text-muted-foreground">
          <p data-testid="footer-demo-disclosure">Produtos e valores desta versão são demonstrativos. Alguns links disponibilizados futuramente poderão ser de afiliados e gerar comissão ao BeUpFree, sem custo adicional ao usuário.</p>
          <p className="mt-2">© 2026 BeUpFree. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
