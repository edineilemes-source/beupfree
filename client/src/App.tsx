import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Catalog from "@/pages/Catalog";
import Marca from "@/pages/Marca";
import AdminTriagem from "@/pages/AdminTriagem";
import CurationSources from "@/pages/CurationSources";
import NotFound from "@/pages/not-found";
import CatalogV2 from "@/pages/CatalogV2";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { AuthProvider } from "@/context/AuthContext";
import DemoProductDialogHost from "@/components/DemoProductDialog";
import Home from "@/pages/Home";
import HowItWorks from "@/pages/HowItWorks";
import About from "@/pages/About";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsOfUse from "@/pages/TermsOfUse";
import Contact from "@/pages/Contact";
import { PUBLIC_DEMO_MODE } from "@/lib/publicDemo";
import ScrollToTop from "@/components/ScrollToTop";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/catalogo" component={CatalogV2} />
      <Route path="/como-funciona" component={HowItWorks} />
      <Route path="/sobre" component={About} />
      <Route path="/politica-de-privacidade" component={PrivacyPolicy} />
      <Route path="/termos-de-uso" component={TermsOfUse} />
      <Route path="/contato" component={Contact} />
      {!PUBLIC_DEMO_MODE && <Route path="/catalogo-antigo" component={Catalog} />}
      <Route path="/marca/:slug" component={Marca} />
      {!PUBLIC_DEMO_MODE && <Route path="/admin/triagem" component={AdminTriagem} />}
      {!PUBLIC_DEMO_MODE && <Route path="/admin/curadoria/listas" component={CurationSources} />}
      {!PUBLIC_DEMO_MODE && <Route path="/triagem" component={AdminTriagem} />}
      <Route path="/catalogo-v2" component={CatalogV2} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <FavoritesProvider>
            <Toaster />
            <ScrollToTop />
            <DemoProductDialogHost />
            <Router />
          </FavoritesProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
