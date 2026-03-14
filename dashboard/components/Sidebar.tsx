'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, Building2, ListTodo, LayoutDashboard } from 'lucide-react'

const navItems = [
  { name: 'People', href: '/people', icon: Users },
  { name: 'Companies', href: '/companies', icon: Building2 },
  { name: 'Lists', href: '/lists', icon: ListTodo },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="w-60 bg-[#111827] border-r border-border flex flex-col h-screen sticky top-0">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-cta rounded-lg flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight">Sales Intel</span>
        </div>
      </div>
      
      <nav className="flex-1 py-6 px-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group ${
                    isActive 
                      ? 'bg-card text-primary border-l-2 border-accent' 
                      : 'text-secondary hover:bg-card hover:text-primary'
                  }`}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? 'text-accent' : 'group-hover:text-primary'}`} />
                  <span className="font-medium">{item.name}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-border">
        <div className="text-xs text-secondary px-3 py-2 uppercase tracking-wider font-semibold">
          Data Source
        </div>
        <div className="px-3 py-2 flex items-center gap-2 text-sm">
          <div className="w-2 h-2 rounded-full bg-success"></div>
          <span>Apollo.io API Active</span>
        </div>
      </div>
    </div>
  )
}
