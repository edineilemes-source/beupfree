import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import CategoryGrid from "@/components/CategoryGrid";
import ProductGrid from "@/components/ProductGrid";
import BrandShowcase from "@/components/BrandShowcase";
import BenefitsBar from "@/components/BenefitsBar";
import Newsletter from "@/components/Newsletter";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <HeroSection />
        <CategoryGrid />
        <ProductGrid />
        <BrandShowcase />
        <BenefitsBar />
        <Newsletter />
      </main>
      <Footer />
    </div>
  );
}
