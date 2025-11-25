import ProductCard from "./ProductCard";
import runningImage from "@assets/generated_images/running_shoes_category.png";
import casualImage from "@assets/generated_images/casual_sneakers_category.png";
import soccerImage from "@assets/generated_images/soccer_cleats_category.png";

//todo: remove mock functionality
const mockProducts = [
  {
    id: 1,
    name: "Tênis Nike Air Zoom Pegasus 40 Masculino",
    brand: "Nike",
    price: 599.90,
    oldPrice: 799.90,
    image: runningImage,
    category: "Corrida"
  },
  {
    id: 2,
    name: "Tênis Adidas Ultraboost Light Running",
    brand: "Adidas",
    price: 899.90,
    oldPrice: 1099.90,
    image: runningImage,
    category: "Corrida"
  },
  {
    id: 3,
    name: "Tênis Nike Court Vision Low Casual",
    brand: "Nike",
    price: 349.90,
    image: casualImage,
    category: "Casual"
  },
  {
    id: 4,
    name: "Chuteira Nike Mercurial Vapor 15 Society",
    brand: "Nike",
    price: 699.90,
    oldPrice: 899.90,
    image: soccerImage,
    category: "Futebol"
  },
  {
    id: 5,
    name: "Tênis Olympikus Corre Vento 2 Masculino",
    brand: "Olympikus",
    price: 279.90,
    image: runningImage,
    category: "Corrida"
  },
  {
    id: 6,
    name: "Tênis Adidas Stan Smith Casual Branco",
    brand: "Adidas",
    price: 549.90,
    oldPrice: 699.90,
    image: casualImage,
    category: "Casual"
  },
  {
    id: 7,
    name: "Chuteira Adidas Predator Accuracy Society",
    brand: "Adidas",
    price: 799.90,
    image: soccerImage,
    category: "Futebol"
  },
  {
    id: 8,
    name: "Tênis Nike Revolution 7 Corrida Masculino",
    brand: "Nike",
    price: 329.90,
    oldPrice: 399.90,
    image: runningImage,
    category: "Corrida"
  },
];

export default function ProductGrid() {
  return (
    <section className="py-12 md:py-16 bg-card/30" data-testid="section-products">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <h2 className="text-3xl md:text-4xl font-bold" data-testid="text-products-title">
            Produtos em Destaque
          </h2>
          <a 
            href="#all-products" 
            className="text-primary font-semibold hover:underline"
            data-testid="link-view-all"
          >
            Ver todos os produtos →
          </a>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
          {mockProducts.map((product) => (
            <ProductCard key={product.id} {...product} />
          ))}
        </div>
      </div>
    </section>
  );
}
