import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import runningImage from "@assets/generated_images/running_shoes_category.png";
import casualImage from "@assets/generated_images/casual_sneakers_category.png";
import soccerImage from "@assets/generated_images/soccer_cleats_category.png";
import socksImage from "@assets/generated_images/sports_socks_category.png";

const banners = [
  {
    id: 1,
    title: "Tênis de Corrida",
    subtitle: "Até 50% OFF",
    description: "Os melhores tênis para sua performance",
    image: runningImage,
    cta: "Ver Ofertas",
    link: "/catalogo?categoria=corrida",
    bgColor: "from-green-900/90 via-green-800/70",
  },
  {
    id: 2,
    title: "Coleção Casual",
    subtitle: "Novidades",
    description: "Estilo e conforto para o dia a dia",
    image: casualImage,
    cta: "Conferir",
    link: "/catalogo?categoria=casual",
    bgColor: "from-yellow-900/90 via-yellow-800/70",
  },
  {
    id: 3,
    title: "Chuteiras",
    subtitle: "Lançamentos",
    description: "Domine o campo com as melhores marcas",
    image: soccerImage,
    cta: "Comprar",
    link: "/catalogo?categoria=futebol",
    bgColor: "from-emerald-900/90 via-emerald-800/70",
  },
  {
    id: 4,
    title: "Acessórios",
    subtitle: "Super Promoção",
    description: "Meias, tornozeleiras e mais",
    image: socksImage,
    cta: "Aproveitar",
    link: "/catalogo?categoria=acessorios",
    bgColor: "from-lime-900/90 via-lime-800/70",
  },
];

export default function HeroCarousel() {
  const [current, setCurrent] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % banners.length);
  }, []);

  const prev = useCallback(() => {
    setCurrent((prev) => (prev - 1 + banners.length) % banners.length);
  }, []);

  const goTo = useCallback((index: number) => {
    setCurrent(index);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 5000);
  }, []);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const timer = setInterval(next, 4000);
    return () => clearInterval(timer);
  }, [isAutoPlaying, next]);

  return (
    <section className="relative h-[400px] md:h-[500px] overflow-hidden" data-testid="hero-carousel">
      {banners.map((banner, index) => (
        <div
          key={banner.id}
          className={`absolute inset-0 transition-opacity duration-700 ${
            index === current ? "opacity-100 z-10" : "opacity-0 z-0"
          }`}
        >
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${banner.image})` }}
          />
          <div className={`absolute inset-0 bg-gradient-to-r ${banner.bgColor} to-transparent`} />
          
          <div className="relative container mx-auto px-4 h-full flex items-center">
            <div className="max-w-xl text-white">
              <span className="inline-block px-3 py-1 bg-yellow-500 text-yellow-900 text-sm font-bold rounded-md mb-4">
                {banner.subtitle}
              </span>
              <h2 className="text-4xl md:text-5xl font-bold mb-3" data-testid={`carousel-title-${index}`}>
                {banner.title}
              </h2>
              <p className="text-lg md:text-xl mb-6 text-white/90">
                {banner.description}
              </p>
              <Link href={banner.link}>
                <Button size="lg" className="text-lg" data-testid={`carousel-cta-${index}`}>
                  {banner.cta}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      ))}

      <button
        onClick={prev}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors"
        data-testid="carousel-prev"
      >
        <ChevronLeft className="h-6 w-6 text-white" />
      </button>
      
      <button
        onClick={next}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors"
        data-testid="carousel-next"
      >
        <ChevronRight className="h-6 w-6 text-white" />
      </button>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {banners.map((_, index) => (
          <button
            key={index}
            onClick={() => goTo(index)}
            className={`w-3 h-3 rounded-full transition-all ${
              index === current 
                ? "bg-white w-8" 
                : "bg-white/50 hover:bg-white/70"
            }`}
            data-testid={`carousel-dot-${index}`}
          />
        ))}
      </div>
    </section>
  );
}
