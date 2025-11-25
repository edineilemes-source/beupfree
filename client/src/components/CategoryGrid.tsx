import { Card, CardContent } from "@/components/ui/card";
import runningImage from "@assets/generated_images/running_shoes_category.png";
import casualImage from "@assets/generated_images/casual_sneakers_category.png";
import soccerImage from "@assets/generated_images/soccer_cleats_category.png";
import socksImage from "@assets/generated_images/sports_socks_category.png";

const categories = [
  { id: 1, name: "Tênis de Corrida", image: runningImage, count: 234 },
  { id: 2, name: "Tênis Casual", image: casualImage, count: 189 },
  { id: 3, name: "Chuteiras", image: soccerImage, count: 156 },
  { id: 4, name: "Meias Esportivas", image: socksImage, count: 78 },
];

export default function CategoryGrid() {
  return (
    <section className="py-12 md:py-16" data-testid="section-categories">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center" data-testid="text-categories-title">
          Categorias em Destaque
        </h2>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {categories.map((category) => (
            <Card 
              key={category.id} 
              className="hover-elevate active-elevate-2 cursor-pointer overflow-hidden group"
              data-testid={`card-category-${category.id}`}
            >
              <CardContent className="p-0">
                <div className="aspect-square overflow-hidden bg-card">
                  <img
                    src={category.image}
                    alt={category.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    data-testid={`img-category-${category.id}`}
                  />
                </div>
                <div className="p-4 text-center">
                  <h3 className="font-semibold text-lg mb-1" data-testid={`text-category-name-${category.id}`}>
                    {category.name}
                  </h3>
                  <p className="text-sm text-muted-foreground" data-testid={`text-category-count-${category.id}`}>
                    {category.count} produtos
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
