"use client"
import { motion } from 'framer-motion'
import { ReactNode } from 'react'

export default function SectionWrapper({ id, children, className = '' }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <motion.section
      id={id}
      className={`py-20 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.5 }}
    >
      {children}
    </motion.section>
  )
}

