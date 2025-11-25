import { useState } from 'react';
import SortDropdown from '../SortDropdown';

export default function SortDropdownExample() {
  const [sort, setSort] = useState('relevancia');

  return (
    <SortDropdown value={sort} onChange={setSort} />
  );
}
