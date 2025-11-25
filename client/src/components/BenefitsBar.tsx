import { Truck, Shield, CreditCard, Headphones } from "lucide-react";

const benefits = [
  {
    id: 1,
    icon: Truck,
    title: "Frete Grátis",
    description: "Em compras acima de R$ 299"
  },
  {
    id: 2,
    icon: Shield,
    title: "Compra Segura",
    description: "Proteção Mercado Livre"
  },
  {
    id: 3,
    icon: CreditCard,
    title: "Parcele em até 12x",
    description: "Sem juros no cartão"
  },
  {
    id: 4,
    icon: Headphones,
    title: "Suporte 24/7",
    description: "Estamos aqui para ajudar"
  }
];

export default function BenefitsBar() {
  return (
    <section className="py-12 md:py-16 bg-muted/30" data-testid="section-benefits">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {benefits.map((benefit) => {
            const IconComponent = benefit.icon;
            return (
              <div 
                key={benefit.id} 
                className="flex flex-col items-center text-center gap-3"
                data-testid={`benefit-${benefit.id}`}
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <IconComponent className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1" data-testid={`text-benefit-title-${benefit.id}`}>
                    {benefit.title}
                  </h3>
                  <p className="text-sm text-muted-foreground" data-testid={`text-benefit-desc-${benefit.id}`}>
                    {benefit.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
