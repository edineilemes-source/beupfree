import { Facebook, Instagram, Youtube } from "lucide-react";
import logoImage from "@assets/Photoroom-20251213_085728_1765685713469.png";

export default function Footer() {
  return (
    <footer className="bg-card border-t" data-testid="footer">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img 
                src={logoImage} 
                alt="BeUpFree Logo" 
                className="h-8 w-auto"
              />
              <h3 className="font-bold text-xl text-primary" data-testid="text-footer-logo">
                BeUpFree
              </h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4" data-testid="text-footer-description">
              Liberte sua performance! Sua loja de confiança para tênis e acessórios esportivos. Parceiro oficial do Mercado Livre.
            </p>
            <div className="flex gap-3">
              <a 
                href="#facebook" 
                className="w-9 h-9 rounded-md bg-muted flex items-center justify-center hover-elevate active-elevate-2"
                data-testid="link-facebook"
              >
                <Facebook className="h-4 w-4" />
              </a>
              <a 
                href="#instagram" 
                className="w-9 h-9 rounded-md bg-muted flex items-center justify-center hover-elevate active-elevate-2"
                data-testid="link-instagram"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a 
                href="#youtube" 
                className="w-9 h-9 rounded-md bg-muted flex items-center justify-center hover-elevate active-elevate-2"
                data-testid="link-youtube"
              >
                <Youtube className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-4" data-testid="text-footer-categories-title">Categorias</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#tenis-corrida" className="text-muted-foreground hover:text-foreground" data-testid="link-footer-corrida">Tênis de Corrida</a></li>
              <li><a href="#tenis-casual" className="text-muted-foreground hover:text-foreground" data-testid="link-footer-casual">Tênis Casual</a></li>
              <li><a href="#chuteiras" className="text-muted-foreground hover:text-foreground" data-testid="link-footer-chuteiras">Chuteiras</a></li>
              <li><a href="#meias" className="text-muted-foreground hover:text-foreground" data-testid="link-footer-meias">Meias</a></li>
              <li><a href="#acessorios" className="text-muted-foreground hover:text-foreground" data-testid="link-footer-acessorios">Acessórios</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4" data-testid="text-footer-about-title">Sobre</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#quem-somos" className="text-muted-foreground hover:text-foreground" data-testid="link-footer-about">Quem Somos</a></li>
              <li><a href="#afiliacao" className="text-muted-foreground hover:text-foreground" data-testid="link-footer-affiliate">Programa de Afiliação</a></li>
              <li><a href="#contato" className="text-muted-foreground hover:text-foreground" data-testid="link-footer-contact">Contato</a></li>
              <li><a href="#faq" className="text-muted-foreground hover:text-foreground" data-testid="link-footer-faq">Perguntas Frequentes</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4" data-testid="text-footer-legal-title">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#privacidade" className="text-muted-foreground hover:text-foreground" data-testid="link-footer-privacy">Política de Privacidade</a></li>
              <li><a href="#termos" className="text-muted-foreground hover:text-foreground" data-testid="link-footer-terms">Termos de Serviço</a></li>
              <li><a href="#cookies" className="text-muted-foreground hover:text-foreground" data-testid="link-footer-cookies">Política de Cookies</a></li>
            </ul>
            <div className="mt-6">
              <p className="text-xs text-muted-foreground" data-testid="text-footer-ml">
                Parceiro Oficial<br />Mercado Livre
              </p>
            </div>
          </div>
        </div>

        <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
          <p data-testid="text-footer-copyright">
            © 2024 BeUpFree. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
