import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Catalog from "@/pages/Catalog";
import Marca from "@/pages/Marca";
import AdminTriagem from "@/pages/AdminTriagem";
import NotFound from "@/pages/not-found";
import CatalogV2 from "@/pages/CatalogV2";

function Router() {
  return (
    <Switch>
      <Route path="/" component={CatalogV2} />
      <Route path="/catalogo" component={CatalogV2} />
      <Route path="/catalogo-antigo" component={Catalog} />
      <Route path="/marca/:slug" component={Marca} />
      <Route path="/admin/triagem" component={AdminTriagem} />
      <Route path="/triagem" component={AdminTriagem} />
      <Route path="/catalogo-v2" component={CatalogV2} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
