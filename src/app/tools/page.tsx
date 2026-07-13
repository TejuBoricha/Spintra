"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Wrench } from "lucide-react";
import { GAMES } from "@/lib/games";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function ToolsPage() {
  const tools = GAMES.filter((game) => !game.createOnly);

  return (
    <div className="min-h-screen pt-28 pb-16 px-4">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6"
        >
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-orange-500/10 text-orange-500 mb-2">
            <Wrench className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-4xl sm:text-5xl font-black">
              Standalone <span className="gradient-text">Tools</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Quickly use any of our built-in tools without creating a full multiplayer room. Perfect for local play or fast decisions.
            </p>
          </div>
        </motion.div>

        {/* Tools Grid */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <motion.div key={tool.type} variants={item} className="h-full">
                <Link href={tool.href} className="block h-full outline-none">
                  <div className="h-full p-6 group cursor-pointer border border-(--border-hairline) bg-(--surface-panel) hover:border-primary/40 rounded-[2rem] shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all flex flex-col items-start gap-4">
                    <div
                      className={`w-14 h-14 rounded-[1.25rem] border-2 border-(--border-strong) bg-gradient-to-br ${tool.color} flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-transform shadow-inner`}
                    >
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-lg group-hover:text-(--brand-primary-strong) transition-colors">
                        {tool.label}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {tool.desc}
                      </p>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
