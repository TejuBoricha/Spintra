"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, LucideIcon } from "lucide-react";

interface FeatureCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  gradient: string;
  stats: string;
  index: number;
}

export function FeatureCard({ title, description, icon: Icon, href, gradient, stats, index }: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      viewport={{ once: true }}
      whileHover={{ y: -6, scale: 1.02 }}
    >
      <Link href={href}>
        <div className="glass-card p-8 h-full group cursor-pointer relative overflow-hidden">
          {/* Hover gradient glow */}
          <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />

          <div className="relative z-10">
            {/* Icon */}
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
              <Icon className="w-7 h-7 text-white" />
            </div>

            {/* Content */}
            <h3 className="text-2xl font-bold mb-3 group-hover:text-white transition-colors">
              {title}
            </h3>
            <p className="text-muted-foreground mb-4 leading-relaxed">
              {description}
            </p>

            {/* Stats + CTA */}
            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              <span className="text-sm text-muted-foreground">{stats}</span>
              <span className="flex items-center gap-1 text-sm font-medium text-purple-400 group-hover:text-purple-300 transition-colors">
                Try it <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
