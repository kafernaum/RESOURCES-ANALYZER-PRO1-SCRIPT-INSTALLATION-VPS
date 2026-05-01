import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Input } from "../components/ui/input";
import { Search, BookOpen } from "lucide-react";

export default function Glossary() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    api.get("/normative/glossary").then(({ data }) => setItems(data.items));
  }, []);

  const filtered = items.filter((it) =>
    !filter || `${it.term} ${it.definition}`.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="p-6" data-testid="glossary-page">
      <h1 className="font-display text-3xl font-bold tracking-tight mb-1">Glossaire interactif</h1>
      <p className="text-sm opacity-70 mb-6">
        50+ termes techniques juridiques, financiers et contractuels avec définitions et références.
      </p>
      <div className="rap-card p-4 mb-4 flex items-center gap-2">
        <Search size={14} className="opacity-50" />
        <Input value={filter} onChange={(e) => setFilter(e.target.value)}
          placeholder="Rechercher un terme... (ex : PSA, royalty, CLPE)"
          className="rounded-sm border-0 bg-transparent focus-visible:ring-0"
          data-testid="glossary-search" />
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {filtered.map((it, i) => (
          <div key={i} className="rap-card p-4" data-testid={`glossary-term-${i}`}>
            <div className="flex items-center gap-2 mb-2">
              <BookOpen size={14} style={{ color: "#D4A017" }} />
              <h3 className="font-display font-bold text-sm">{it.term}</h3>
            </div>
            <p className="text-xs opacity-80 leading-relaxed">{it.definition}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
