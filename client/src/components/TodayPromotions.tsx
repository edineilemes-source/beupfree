import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { Link } from "wouter";
import runningImage from "@assets/generated_images/running_shoes_category.png";
import casualImage from "@assets/generated_images/casual_sneakers_category.png";
import soccerImage from "@assets/generated_images/soccer_cleats_category.png";
import socksImage from "@assets/generated_images/sports_socks_category.png";

interface Promotion {
  id: number;
  name: string;
  brand: string;
  oldPrice: number;
  price: number;
  discount: number;
  image: string;
  endTime: Date;
}

const todayPromotions: Promotion[] = [
  {
    id: 1,
    name: "Nike Air Zoom Pegasus 40",
    brand: "Nike",
    oldPrice: 799.90,
    price: 499.90,
    discount: 38,
    image: runningImage,
    endTime: new Date(new Date().setHours(23, 59, 59)),
  },
  {
    id: 2,
    name: "Adidas Ultraboost Light",
    brand: "Adidas",
    oldPrice: 1099.90,
    price: 699.90,
    discount: 36,
    image: casualImage,
    endTime: new Date(new Date().setHours(23, 59, 59)),
  },
  {
    id: 3,
    name: "Chuteira Nike Mercurial",
    brand: "Nike",
    oldPrice: 899.90,
    price: 599.90,
    discount: 33,
    image: soccerImage,
    endTime: new Date(new Date().setHours(23, 59, 59)),
  },
  {
    id: 4,
    name: "Kit Meias Compressão",
    brand: "Vollo",
    oldPrice: 149.90,
    price: 89.90,
    discount: 40,
    image: socksImage,
    endTime: new Date(new Date().setHours(23, 59, 59)),
  },
  {
    id: 5,
    name: "Mizuno Wave Rider 27",
    brand: "Mizuno",
    oldPrice: 999.90,
    price: 649.90,
    discount: 35,
    image: runningImage,
    endTime: new Date(new Date().setHours(23, 59, 59)),
  },
  {
    id: 6,
    name: "Puma RS-X",
    brand: "Puma",
    oldPrice: 699.90,
    price: 449.90,
    discount: 36,
    image: casualImage,
    endTime: new Date(new Date().setHours(23, 59, 59)),
  },
];

function CountdownTimer({ endTime }: { endTime: Date }) {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const diff = endTime.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setTimeLeft({ hours, minutes, seconds });
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [endTime]);

  return (
    <div className="flex items-center gap-1 text-xs font-mono">
      <Clock className="h-3 w-3" />
      <span>{String(timeLeft.hours).padStart(2, '0')}:</span>
      <span>{String(timeLeft.minutes).padStart(2, '0')}:</span>
      <span>{String(timeLeft.seconds).padStart(2, '0')}</span>
    </div>
  );
}

function PromotionCard({ promo }: { promo: Promotion }) {
  return (
    <Card className="flex-shrink-0 w-[200px] md:w-[240px] overflow-hidden hover-elevate" data-testid={`promo-card-${promo.id}`}>
      <div className="relative">
        <img src={promo.image} alt={promo.name} className="w-full h-32 object-cover" />
        <Badge className="absolute top-2 left-2 bg-destructive text-destructive-foreground">
          -{promo.discount}%
        </Badge>
      </div>
      <div className="p-3">
        <p className="text-xs text-muted-foreground">{promo.brand}</p>
        <h4 className="font-medium text-sm line-clamp-2 mb-2">{promo.name}</h4>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-muted-foreground line-through">
            R$ {promo.oldPrice.toFixed(2).replace('.', ',')}
          </span>
          <span className="text-primary font-bold">
            R$ {promo.price.toFixed(2).replace('.', ',')}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <CountdownTimer endTime={promo.endTime} />
          <Link href={`/catalogo?produto=${promo.id}`}>
            <Button size="sm" variant="secondary">Ver</Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

export default function TodayPromotions() {
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 260;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const today = new Date().toLocaleDateString('pt-BR', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long' 
  });

  return (
    <section className="py-8 bg-muted/30" data-testid="today-promotions">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              <span className="text-2xl">🔥</span>
              Promoções de Hoje
            </h3>
            <p className="text-sm text-muted-foreground capitalize">{today}</p>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            data-testid="button-expand-today"
          >
            {isExpanded ? (
              <>Recolher <ChevronUp className="ml-1 h-4 w-4" /></>
            ) : (
              <>Ver Todas <ChevronDown className="ml-1 h-4 w-4" /></>
            )}
          </Button>
        </div>

        {isExpanded ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {todayPromotions.map((promo) => (
              <Card key={promo.id} className="overflow-hidden hover-elevate">
                <div className="relative">
                  <img src={promo.image} alt={promo.name} className="w-full h-32 object-cover" />
                  <Badge className="absolute top-2 left-2 bg-destructive text-destructive-foreground">
                    -{promo.discount}%
                  </Badge>
                </div>
                <div className="p-3">
                  <p className="text-xs text-muted-foreground">{promo.brand}</p>
                  <h4 className="font-medium text-sm line-clamp-2 mb-2">{promo.name}</h4>
                  <div className="flex flex-col gap-1 mb-2">
                    <span className="text-xs text-muted-foreground line-through">
                      R$ {promo.oldPrice.toFixed(2).replace('.', ',')}
                    </span>
                    <span className="text-primary font-bold">
                      R$ {promo.price.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <CountdownTimer endTime={promo.endTime} />
                    <Link href={`/catalogo?produto=${promo.id}`}>
                      <Button size="sm" variant="secondary">Ver</Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="relative">
            <button
              onClick={() => scroll('left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background border shadow-md flex items-center justify-center hover-elevate"
              data-testid="today-scroll-left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            <div
              ref={scrollRef}
              className="flex gap-4 overflow-x-auto scrollbar-hide px-8"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {todayPromotions.map((promo) => (
                <PromotionCard key={promo.id} promo={promo} />
              ))}
            </div>

            <button
              onClick={() => scroll('right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background border shadow-md flex items-center justify-center hover-elevate"
              data-testid="today-scroll-right"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
