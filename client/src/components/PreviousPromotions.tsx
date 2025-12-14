import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import runningImage from "@assets/generated_images/running_shoes_category.png";
import casualImage from "@assets/generated_images/casual_sneakers_category.png";
import soccerImage from "@assets/generated_images/soccer_cleats_category.png";
import socksImage from "@assets/generated_images/sports_socks_category.png";
import ankleImage from "@assets/generated_images/ankle_support_accessories.png";

interface Promotion {
  id: number;
  name: string;
  brand: string;
  oldPrice: number;
  price: number;
  discount: number;
  image: string;
  validUntil: string;
}

const yesterdayPromotions: Promotion[] = [
  {
    id: 101,
    name: "Asics Gel Nimbus 25",
    brand: "Asics",
    oldPrice: 1199.90,
    price: 799.90,
    discount: 33,
    image: runningImage,
    validUntil: "Válido até esgotar",
  },
  {
    id: 102,
    name: "New Balance 574",
    brand: "New Balance",
    oldPrice: 599.90,
    price: 399.90,
    discount: 33,
    image: casualImage,
    validUntil: "Válido até esgotar",
  },
  {
    id: 103,
    name: "Chuteira Adidas Copa",
    brand: "Adidas",
    oldPrice: 799.90,
    price: 549.90,
    discount: 31,
    image: soccerImage,
    validUntil: "Válido até esgotar",
  },
  {
    id: 104,
    name: "Tornozeleira Pro",
    brand: "Vollo",
    oldPrice: 89.90,
    price: 59.90,
    discount: 33,
    image: ankleImage,
    validUntil: "Válido até esgotar",
  },
];

const previousDaysPromotions: Promotion[] = [
  {
    id: 201,
    name: "Olympikus Corre 3",
    brand: "Olympikus",
    oldPrice: 349.90,
    price: 229.90,
    discount: 34,
    image: runningImage,
    validUntil: "Últimas unidades",
  },
  {
    id: 202,
    name: "Fila Racer",
    brand: "Fila",
    oldPrice: 399.90,
    price: 249.90,
    discount: 38,
    image: casualImage,
    validUntil: "Últimas unidades",
  },
  {
    id: 203,
    name: "Skechers Go Walk",
    brand: "Skechers",
    oldPrice: 499.90,
    price: 329.90,
    discount: 34,
    image: casualImage,
    validUntil: "Últimas unidades",
  },
  {
    id: 204,
    name: "Kit Meias Running",
    brand: "Nike",
    oldPrice: 119.90,
    price: 79.90,
    discount: 33,
    image: socksImage,
    validUntil: "Últimas unidades",
  },
  {
    id: 205,
    name: "Under Armour HOVR",
    brand: "Under Armour",
    oldPrice: 899.90,
    price: 599.90,
    discount: 33,
    image: runningImage,
    validUntil: "Últimas unidades",
  },
  {
    id: 206,
    name: "Puma Future Soccer",
    brand: "Puma",
    oldPrice: 749.90,
    price: 499.90,
    discount: 33,
    image: soccerImage,
    validUntil: "Últimas unidades",
  },
];

function PromotionRow({ 
  title, 
  subtitle, 
  promotions, 
  badgeVariant = "secondary" 
}: { 
  title: string; 
  subtitle: string; 
  promotions: Promotion[];
  badgeVariant?: "secondary" | "outline";
}) {
  return (
    <section className="py-6" data-testid={`promo-section-${title.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold">{title}</h3>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <Link href="/catalogo?ofertas=anteriores">
            <Button variant="ghost" size="sm">Ver Mais</Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {promotions.map((promo) => (
            <Card key={promo.id} className="overflow-hidden hover-elevate" data-testid={`previous-promo-${promo.id}`}>
              <div className="relative">
                <img src={promo.image} alt={promo.name} className="w-full h-28 object-cover" />
                <Badge className="absolute top-2 left-2 bg-destructive text-destructive-foreground text-xs">
                  -{promo.discount}%
                </Badge>
              </div>
              <div className="p-2">
                <p className="text-xs text-muted-foreground">{promo.brand}</p>
                <h4 className="font-medium text-xs line-clamp-2 mb-1">{promo.name}</h4>
                <div className="flex flex-col mb-1">
                  <span className="text-xs text-muted-foreground line-through">
                    R$ {promo.oldPrice.toFixed(2).replace('.', ',')}
                  </span>
                  <span className="text-primary font-bold text-sm">
                    R$ {promo.price.toFixed(2).replace('.', ',')}
                  </span>
                </div>
                <Badge variant={badgeVariant} className="text-xs w-full justify-center">
                  {promo.validUntil}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function PreviousPromotions() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString('pt-BR', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'short' 
  });

  return (
    <>
      <PromotionRow 
        title="Promoções de Ontem" 
        subtitle={`Ainda válidas - ${yesterdayStr}`}
        promotions={yesterdayPromotions}
        badgeVariant="secondary"
      />
      
      <div className="border-t" />
      
      <PromotionRow 
        title="Promoções Anteriores" 
        subtitle="Aproveite enquanto durar o estoque"
        promotions={previousDaysPromotions}
        badgeVariant="outline"
      />
    </>
  );
}
