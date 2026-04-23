import Header from "@/components/Header";
import HeroCarousel from "@/components/HeroCarousel";
import LightningDeals from "@/components/LightningDeals";
import DealOfTheDay from "@/components/DealOfTheDay";
import GeneralOffers from "@/components/GeneralOffers";
import CategoryGrid from "@/components/CategoryGrid";
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
        <LightningDeals />
        <DealOfTheDay />
        <GeneralOffers />
        <CategoryGrid />
        <BrandShowcase />
        <PreviousOffers />
        <BenefitsBar />
        <Newsletter />
      </main>
      <Footer />
    </div>
  );
}
