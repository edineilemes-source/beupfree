import ProductCard from '../ProductCard';
import runningImage from "@assets/generated_images/running_shoes_category.png";

export default function ProductCardExample() {
  return (
    <div className="max-w-xs">
      <ProductCard
        id={1}
        name="Tênis Nike Air Zoom Pegasus 40 Masculino"
        brand="Nike"
        price={599.90}
        oldPrice={799.90}
        image={runningImage}
        category="Corrida"
        mercadoLivreUrl="#"
      />
    </div>
  );
}
