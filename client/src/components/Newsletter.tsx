import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Newsletter() {
  const [email, setEmail] = useState("");
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Newsletter signup:", email);
    toast({
      title: "Inscrição realizada!",
      description: "Você receberá nossas ofertas exclusivas em breve.",
    });
    setEmail("");
  };

  return (
    <section className="py-12 md:py-16 bg-primary text-primary-foreground" data-testid="section-newsletter">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" data-testid="text-newsletter-title">
            Receba Ofertas Exclusivas
          </h2>
          <p className="text-lg mb-8 text-primary-foreground/90" data-testid="text-newsletter-subtitle">
            Cadastre seu e-mail e seja o primeiro a saber sobre lançamentos e promoções
          </p>
          
          <form onSubmit={handleSubmit} className="flex gap-4 flex-wrap justify-center">
            <Input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="max-w-md bg-white text-foreground"
              data-testid="input-newsletter-email"
            />
            <Button 
              type="submit" 
              variant="secondary" 
              size="default"
              data-testid="button-newsletter-submit"
            >
              Inscrever-se
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
