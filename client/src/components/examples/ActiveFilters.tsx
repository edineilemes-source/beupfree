import ActiveFilters from '../ActiveFilters';

export default function ActiveFiltersExample() {
  const mockFilters = [
    { category: 'marca', value: 'nike', label: 'Nike' },
    { category: 'genero', value: 'masculino', label: 'Masculino' },
    { category: 'modalidade', value: 'corrida', label: 'Corrida' },
    { category: 'preco', value: '200-400', label: 'R$ 200 - R$ 400' },
  ];

  return (
    <ActiveFilters
      filters={mockFilters}
      onRemove={(category, value) => console.log('Remove filter:', category, value)}
      onClearAll={() => console.log('Clear all filters')}
    />
  );
}
