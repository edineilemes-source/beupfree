import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FilterSidebar from "@/components/FilterSidebar";
import ProductCard from "@/components/ProductCard";
import ActiveFilters from "@/components/ActiveFilters";
import SortDropdown from "@/components/SortDropdown";
import { Button } from "@/components/ui/button";
import { Filter, Grid2X2, Grid3X3 } from "lucide-react";
import runningImage from "@assets/generated_images/running_shoes_category.png";
import casualImage from "@assets/generated_images/casual_sneakers_category.png";
import soccerImage from "@assets/generated_images/soccer_cleats_category.png";
import socksImage from "@assets/generated_images/sports_socks_category.png";
import ankleImage from "@assets/generated_images/ankle_support_accessories.png";

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
  {
    id: 9,
    name: "Meia de Compressão Nike Elite Pro",
    brand: "Nike",
    price: 89.90,
    oldPrice: 119.90,
    image: socksImage,
    category: "Meias"
  },
  {
    id: 10,
    name: "Tornozeleira Esportiva Adidas Performance",
    brand: "Adidas",
    price: 79.90,
    image: ankleImage,
    category: "Acessórios"
  },
  {
    id: 11,
    name: "Tênis Mizuno Wave Rider 27 Masculino",
    brand: "Mizuno",
    price: 799.90,
    oldPrice: 999.90,
    image: runningImage,
    category: "Corrida"
  },
  {
    id: 12,
    name: "Tensor de Panturrilha Vollo Sports",
    brand: "Vollo",
    price: 49.90,
    image: ankleImage,
    category: "Acessórios"
  },
];

export default function Catalog() {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState("relevancia");
  const [gridSize, setGridSize] = useState<"small" | "large">("large");
  const [activeFilters, setActiveFilters] = useState([
    { category: "marca", value: "nike", label: "Nike" },
    { category: "genero", value: "masculino", label: "Masculino" },
  ]);

  const removeFilter = (category: string, value: string) => {
    setActiveFilters((prev) =>
      prev.filter((f) => !(f.category === category && f.value === value))
    );
  };

  const clearAllFilters = () => {
    setActiveFilters([]);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-catalog-title">
              Catálogo de Produtos
            </h1>
            <p className="text-muted-foreground" data-testid="text-catalog-count">
              {mockProducts.length} produtos encontrados
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="lg:hidden gap-2"
              onClick={() => setIsFilterOpen(true)}
              data-testid="button-open-filters"
            >
              <Filter className="h-4 w-4" />
              Filtros
            </Button>
            
            <div className="hidden md:flex items-center gap-1 border rounded-md p-1">
              <Button
                variant={gridSize === "large" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setGridSize("large")}
                data-testid="button-grid-large"
              >
                <Grid2X2 className="h-4 w-4" />
              </Button>
              <Button
                variant={gridSize === "small" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setGridSize("small")}
                data-testid="button-grid-small"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
            </div>
            
            <SortDropdown value={sortBy} onChange={setSortBy} />
          </div>
        </div>

        <div className="flex gap-8">
          <div className="hidden lg:block w-80 flex-shrink-0">
            <FilterSidebar isOpen={true} onClose={() => {}} />
          </div>

          <FilterSidebar
            isOpen={isFilterOpen}
            onClose={() => setIsFilterOpen(false)}
          />

          <div className="flex-1">
            <ActiveFilters
              filters={activeFilters}
              onRemove={removeFilter}
              onClearAll={clearAllFilters}
            />

            <div
              className={`grid gap-6 ${
                gridSize === "large"
                  ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                  : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
              }`}
            >
              {mockProducts.map((product) => (
                <ProductCard key={product.id} {...product} />
              ))}
            </div>

            <div className="mt-8 flex justify-center gap-2">
              <Button variant="outline" disabled data-testid="button-prev-page">
                Anterior
              </Button>
              <Button variant="default" data-testid="button-page-1">1</Button>
              <Button variant="outline" data-testid="button-page-2">2</Button>
              <Button variant="outline" data-testid="button-page-3">3</Button>
              <Button variant="outline" data-testid="button-next-page">
                Próximo
              </Button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
