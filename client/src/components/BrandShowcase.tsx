import { SiNike, SiAdidas, SiPuma, SiUnderarmour, SiNewbalance, SiReebok } from "react-icons/si";

const brands = [
  { id: 1, name: "Nike", icon: SiNike },
  { id: 2, name: "Adidas", icon: SiAdidas },
  { id: 3, name: "Puma", icon: SiPuma },
  { id: 4, name: "Under Armour", icon: SiUnderarmour },
  { id: 5, name: "New Balance", icon: SiNewbalance },
  { id: 6, name: "Reebok", icon: SiReebok },
];

export default function BrandShowcase() {
  return (
    <section className="py-12 md:py-16" data-testid="section-brands">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center" data-testid="text-brands-title">
          Marcas Parceiras
        </h2>
        
        <div className="grid grid-cols-3 md:grid-cols-6 gap-6 md:gap-8">
          {brands.map((brand) => {
            const IconComponent = brand.icon;
            return (
              <button
                key={brand.id}
                className="aspect-square flex items-center justify-center p-6 rounded-md border bg-card hover-elevate active-elevate-2"
                data-testid={`button-brand-${brand.id}`}
              >
                <IconComponent className="w-full h-full text-foreground" />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
