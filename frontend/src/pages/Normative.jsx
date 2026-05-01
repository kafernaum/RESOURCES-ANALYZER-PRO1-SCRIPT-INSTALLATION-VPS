import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Input } from "../components/ui/input";
import { BookOpen, Globe2, Scale, FileText, Award, Lightbulb, Search } from "lucide-react";

const FAMILY_ICONS = {
  1: Globe2, 2: Globe2, 3: FileText, 4: Award, 5: Scale, 6: Lightbulb,
};

export default function Normative() {
  const [refs, setRefs] = useState([]);
  const [families, setFamilies] = useState([]);
  const [juris, setJuris] = useState([]);
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState("1");

  useEffect(() => {
    api.get("/normative/references").then(({ data }) => {
      setRefs(data.items);
      setFamilies(data.families);
    });
    api.get("/normative/jurisprudence").then(({ data }) => setJuris(data.items));
  }, []);

  const filtered = refs.filter((r) => {
    if (filter && !`${r.code} ${r.title} ${r.summary}`.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-6" data-testid="normative-page">
      <h1 className="font-display text-3xl font-bold tracking-tight mb-1">Référentiel normatif</h1>
      <p className="text-sm opacity-70 mb-6">
        40+ normes internationales, régionales africaines, standards contractuels et principes doctrinaux.
      </p>

      <div className="rap-card p-4 mb-4 flex items-center gap-2">
        <Search size={14} className="opacity-50" />
        <Input value={filter} onChange={(e) => setFilter(e.target.value)}
          placeholder="Rechercher dans le référentiel..."
          className="rounded-sm border-0 bg-transparent focus-visible:ring-0"
          data-testid="normative-search" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="rounded-sm flex-wrap h-auto">
          {families.map((f) => {
            const Icon = FAMILY_ICONS[f.id] || BookOpen;
            return (
              <TabsTrigger key={f.id} value={String(f.id)} className="text-xs"
                data-testid={`family-tab-${f.id}`}>
                <Icon size={12} className="mr-1" />
                F{f.id} — {f.name.length > 30 ? f.name.slice(0, 30) + "..." : f.name}
              </TabsTrigger>
            );
          })}
          <TabsTrigger value="jurisprudence" data-testid="family-tab-juris">
            <Scale size={12} className="mr-1" />
            Jurisprudence internationale ({juris.length})
          </TabsTrigger>
        </TabsList>

        {families.map((f) => (
          <TabsContent key={f.id} value={String(f.id)} className="mt-4">
            <div className="grid md:grid-cols-2 gap-3">
              {filtered.filter((r) => r.family === f.id).map((r) => (
                <div key={r.code} className="rap-card p-4" data-testid={`norm-${r.code}`}>
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-mono text-xs px-2 py-0.5 rounded-sm font-bold"
                      style={{ background: "rgba(212, 160, 23, 0.15)", color: "#D4A017" }}>
                      {r.code}
                    </span>
                  </div>
                  <h3 className="font-display font-bold text-sm mb-1 leading-snug">{r.title}</h3>
                  <p className="text-xs opacity-80 mb-2 leading-relaxed">{r.summary}</p>
                  {r.test && (
                    <div className="text-xs italic mt-2 pt-2 border-t opacity-70"
                      style={{ borderColor: "hsl(var(--border))" }}>
                      <b>Test :</b> {r.test}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>
        ))}

        <TabsContent value="jurisprudence" className="mt-4">
          <div className="space-y-2">
            {juris.map((j, i) => (
              <div key={i} className="rap-card p-4 flex items-start gap-4" data-testid={`juris-${i}`}>
                <div className="flex-shrink-0 text-center">
                  <div className="font-mono text-2xl font-bold" style={{ color: "#D4A017" }}>{j.year}</div>
                  <div className="text-[10px] uppercase tracking-wider opacity-60">{j.tribunal}</div>
                </div>
                <div className="flex-1">
                  <div className="font-display font-bold text-sm">{j.case_name}</div>
                  <div className="text-[10px] uppercase tracking-wider opacity-60 mb-1">
                    Thème : {j.topic.replace(/_/g, ' ')}
                  </div>
                  <div className="text-xs opacity-80 leading-relaxed">{j.ratio}</div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
