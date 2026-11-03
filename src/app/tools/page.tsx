// A server page: it needs no client JavaScript (the card entrance is CSS, see `reveal` in
// globals.css), so the cards are in the first HTML and visible before anything hydrates.
import Link from "next/link";
import { revealStagger } from "@/lib/reveal";
import { Wrench } from "lucide-react";
import { GAMES } from "@/lib/games";
import { jsonLdScript } from "@/lib/site-metadata";

const BASE_URL = "https://spintra.io";

export default function ToolsPage() {
  const tools = GAMES.filter((game) => !game.createOnly);

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Spintra Quick Tools",
    description: "Free standalone group tools and party games: spinner wheel, team generator, name picker, tournament brackets, dice, and more.",
    url: `${BASE_URL}/tools`,
    numberOfItems: tools.length,
    itemListElement: tools.map((tool, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: tool.label,
      description: tool.desc,
      url: `${BASE_URL}${tool.href}`,
    })),
  };

  return (
    <div className="min-h-screen pt-28 pb-16 px-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(itemListSchema) }}
      />
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <div
          className="text-center space-y-6 reveal reveal-up"
        >
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-orange-500/10 text-orange-500 mb-2">
            <Wrench className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-4xl sm:text-5xl font-black">
              Quick <span className="gradient-text">Tools</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Use any tool on your own, without making a room. Good for when everyone is looking at one screen.
            </p>
          </div>
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tools.map((tool, index) => {
            const Icon = tool.icon;
            return (
              <div key={tool.type} className={`h-full ${revealStagger(index)}`}>
                <Link href={tool.href} className="block h-full rounded-[2rem]">
                  <div className="h-full p-6 group cursor-pointer border border-(--border-hairline) bg-(--surface-panel) hover:border-primary/40 rounded-[2rem] shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all flex flex-col items-start gap-4">
                    <div
                      className={`w-14 h-14 rounded-[1.25rem] border-2 border-(--border-strong) bg-gradient-to-br ${tool.color} flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-transform shadow-inner`}
                    >
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h2 className="font-bold text-foreground text-lg group-hover:text-(--brand-primary-strong) transition-colors">
                        {tool.label}
                      </h2>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {tool.desc}
                      </p>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>

        {/* Callout to multiplayer board game */}
        <div className="text-center pt-8 border-t border-(--border-hairline)">
          <p className="text-muted-foreground text-sm">
            Looking for a multiplayer board game? Play{" "}
            <Link href="/spintra-city" className="font-semibold text-foreground underline hover:text-(--brand-primary-strong) transition-colors">
              Spintra City
            </Link>{" "}
            online with 2 to 8 friends.
          </p>
        </div>
      </div>
    </div>
  );
}
