'use client';

import React from 'react';
import { SocialCloud } from '@/components/ui/footer-section-1-utils/social-cloud';
import { motion, type Variants } from 'motion/react';

export const SolaceUILogo = ({ className }: { className?: string }) => {
  return (
    <svg
      className={className}
      width="64"
      height="38"
      viewBox="0 0 64 38"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M0 20.1032L39.8387 20.1032C44.7808 20.1032 48.7871 24.1095 48.7871 29.0516C48.7871 33.9937 44.7808 38 39.8387 38L1.56459e-06 38L0 20.1032Z"
        fill="currentColor"
      />
      <path
        d="M63.4968 17.8968L23.6581 17.8968C18.716 17.8968 14.7097 13.8904 14.7097 8.94839C14.7097 4.00633 18.716 0 23.6581 0L63.4968 0V17.8968Z"
        fill="currentColor"
      />
    </svg>
  );
};

export function Footer1({
  logo,
  links,
  copyright,
  className = '',
}: {
  logo?: React.ReactNode;
  links?: { label: string; href: string }[];
  copyright?: string;
  className?: string;
} = {}) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 260,
        damping: 20,
      },
    },
  };

  const defaultLinks = [
    { label: 'Products', href: '#preview' },
    { label: 'Solution', href: '#features' },
    { label: 'Company', href: '#agent-fleet' },
    { label: 'About', href: '#how-it-works' },
    { label: 'Blog', href: '#deploy' },
    { label: 'Terms', href: '#' },
  ];

  const navLinks = links ?? defaultLinks;

  return (
    <footer className={`w-full py-12 bg-transparent text-foreground overflow-hidden ${className}`}>
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '0px 0px -100px 0px' }}
        variants={containerVariants}
        className="container mx-auto px-4 flex flex-col items-center gap-10 mb-12"
      >
        <motion.div variants={itemVariants} className="flex justify-center">
          {logo ?? <SolaceUILogo className="h-10 w-auto" />}
        </motion.div>

        <motion.nav
          variants={itemVariants}
          className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-base font-medium relative z-10"
        >
          {navLinks.map((item) => (
            <motion.a
              key={item.label}
              href={item.href}
              className="relative px-2 py-1 group"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="relative z-10 group-hover:text-[#ff6b35] transition-colors duration-300">
                {item.label}
              </span>
              <motion.span
                className="absolute inset-0 bg-[#fff0e8] rounded-md -z-0 origin-center"
                initial={{ scale: 0, opacity: 0 }}
                whileHover={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              />
            </motion.a>
          ))}
        </motion.nav>

        <motion.div variants={itemVariants}>
          <SocialCloud className="text-foreground" />
        </motion.div>
      </motion.div>

      <motion.div
        className="w-full h-12 border-y border-[#111111]/15 opacity-25 bg-[repeating-linear-gradient(315deg,currentColor_0,currentColor_1px,transparent_0,transparent_50%)]"
        style={{ backgroundSize: '10px 10px' }}
        initial={{ backgroundPositionX: '0%' }}
        whileInView={{ backgroundPositionX: '100%' }}
        viewport={{ once: true }}
        transition={{
          ease: 'linear',
          duration: 20,
        }}
      />

      <motion.div
        className="container mx-auto px-4 mt-8 text-center text-sm text-[#77736F]"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={itemVariants}
      >
        <p>{copyright ?? '© 2026 SolaceUI, All rights reserved'}</p>
      </motion.div>
    </footer>
  );
}

export default Footer1;
