import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import heroImage from "@assets/generated_images/hero_banner_athletic_lifestyle.png";

export default function HeroSection() {
  return (
    <section className="relative h-[500px] md:h-[600px] overflow-hidden" data-testid="section-hero">
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${heroImage})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-transparent" />
      
      <div className="relative container mx-auto px-4 h-full flex items-center">
        <div className="max-w-2xl text-white">
          <p className="text-lg md:text-xl mb-2 text-yellow-400 font-semibold" data-testid="text-hero-tagline">
            Liberte Sua Performance
          </p>
          <h2 className="text-5xl md:text-6xl font-bold mb-4" data-testid="text-hero-title">
            Seu Próximo Passo<br />Começa Aqui
          </h2>
          <p className="text-xl md:text-2xl mb-8 text-white/90" data-testid="text-hero-subtitle">
            Encontre os melhores tênis e acessórios esportivos<br />
            Produtos selecionados do Mercado Livre
          </p>
          <div className="flex gap-4 flex-wrap">
            <Link href="/catalogo">
              <Button 
                size="lg" 
                className="text-lg"
                data-testid="button-hero-shop"
              >
                Ver Produtos
              </Button>
            </Link>
            <Button 
              size="lg" 
              variant="outline" 
              className="text-lg bg-white/10 backdrop-blur-sm border-white/30 text-white hover:bg-white/20"
              data-testid="button-hero-learn"
            >
              Saiba Mais
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
