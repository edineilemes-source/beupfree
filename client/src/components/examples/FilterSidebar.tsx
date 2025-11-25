import { useState } from 'react';
import FilterSidebar from '../FilterSidebar';
import { Button } from '@/components/ui/button';
import { Filter } from 'lucide-react';

export default function FilterSidebarExample() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="flex">
      <Button 
        variant="outline" 
        className="lg:hidden mb-4"
        onClick={() => setIsOpen(true)}
      >
        <Filter className="h-4 w-4 mr-2" />
        Filtros
      </Button>
      <FilterSidebar isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
}
