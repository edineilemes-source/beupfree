import { useEffect } from "react";
import { Tag } from "lucide-react";
import Header from "@/components/Header";
import HeroCarousel from "@/components/HeroCarousel";
import LightningDeals from "@/components/LightningDeals";
import DealOfTheDay from "@/components/DealOfTheDay";
import PaginatedDealSection from "@/components/PaginatedDealSection";
import BrandsCarousel from "@/components/BrandsCarousel";
import PreviousOffers from "@/components/PreviousOffers";
import BenefitsBar from "@/components/BenefitsBar";
import Newsletter from "@/components/Newsletter";
import Footer from "@/components/Footer";

export default function Home() {
  // Se a URL chegou com hash (ex: /#marcas), rola até a sessão.
  // Tenta múltiplas vezes pois as seções carregam dados assíncronos e mudam de altura.
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash) {
      window.scrollTo({ top: 0, behavior: "auto" });
      return;
    }
    const tryScroll = (attempt = 0) => {
      const el = document.getElementById(hash);
      if (el) {
        el.scrollIntoView({ behavior: "auto", block: "start" });
      } else if (attempt < 10) {
        setTimeout(() => tryScroll(attempt + 1), 150);
      }
    };
    tryScroll();
  }, []);

  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <HeroCarousel />
        <LightningDeals />
        <DealOfTheDay />
        <PaginatedDealSection
          endpoint="/api/sections/ofertas-gerais"
          title="Outras Ofertas"
          icon={<Tag className="w-6 h-6 text-primary" />}
          emptyMessage="Sem outras ofertas no momento."
          testIdPrefix="outras-ofertas"
        />
        <BrandsCarousel />
        <PreviousOffers />
        <BenefitsBar />
        <Newsletter />
      </main>
      <Footer />
    </div>
  );
}
