import Header from "@/components/Header";
import HeroCarousel from "@/components/HeroCarousel";
import DealOfTheDay from "@/components/DealOfTheDay";
import LightningDeals from "@/components/LightningDeals";
import BrandPromotions from "@/components/BrandPromotions";
import CategoryGrid from "@/components/CategoryGrid";
import ProductGrid from "@/components/ProductGrid";
import BrandShowcase from "@/components/BrandShowcase";
import PreviousOffers from "@/components/PreviousOffers";
import BenefitsBar from "@/components/BenefitsBar";
import Newsletter from "@/components/Newsletter";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <HeroCarousel />
        <DealOfTheDay />
        <LightningDeals />
        <BrandPromotions />
        <CategoryGrid />
        <ProductGrid />
        <BrandShowcase />
        <PreviousOffers />
        <BenefitsBar />
        <Newsletter />
      </main>
      <Footer />
    </div>
  );
}
