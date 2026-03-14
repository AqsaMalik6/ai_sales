'use client'

import { useEffect, useState } from 'react'
import { getCompanies, Company } from '@/lib/api'
import { Search, Building2, Users, MapPin, ExternalLink, ArrowRight, Globe } from 'lucide-react'
import Link from 'next/link'

export default function CompaniesPage() {
    const [companies, setCompanies] = useState<Company[]>([])
    const [search, setSearch] = useState('')

    useEffect(() => {
        getCompanies().then(setCompanies)
    }, [])

    const filteredCompanies = companies.filter(c => 
        c.name.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="p-0 bg-[#111827] min-h-screen text-primary">
            {/* Header Area */}
            <div className="p-8 border-b border-border bg-[#111827] sticky top-0 z-10">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold">Companies</h1>
                        <nav className="flex text-xs text-secondary mt-1">
                            <span>Total tracked companies: {companies.length}</span>
                        </nav>
                    </div>
                    <div className="flex gap-4">
                        <div className="relative w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                            <input
                                type="text"
                                placeholder="Search companies..."
                                className="w-full bg-[#1F2937] border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none ring-1 ring-inset ring-transparent focus:ring-accent/50"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Grid Area */}
            <div className="px-8 py-8">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredCompanies.map((company) => (
                        <Link 
                            key={company.name} 
                            href={`/companies/${encodeURIComponent(company.name)}`}
                            className="bg-[#1F2937] border border-border rounded-2xl p-6 hover:border-accent transition-all group flex flex-col shadow-lg"
                        >
                            <div className="flex items-start justify-between mb-6">
                                <div className="w-14 h-14 bg-[#374151] rounded-2xl flex items-center justify-center text-secondary group-hover:bg-accent/20 group-hover:text-accent transition-all ring-1 ring-border group-hover:ring-accent/30 shadow-inner">
                                    <Building2 className="w-7 h-7" />
                                </div>
                                <div className="p-2 rounded-lg bg-border/20 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0">
                                    <ArrowRight className="w-4 h-4 text-accent" />
                                </div>
                            </div>
                            
                            <h3 className="text-xl font-bold mb-1 truncate text-white">{company.name}</h3>
                            <div className="flex items-center gap-1.5 text-xs text-secondary mb-6">
                                <span className="bg-success/20 text-success px-1.5 py-0.5 rounded font-bold">TRACKED</span>
                                <span>Software & Services</span>
                            </div>

                            <div className="space-y-3 mt-auto pt-6 border-t border-border/50">
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2 text-secondary">
                                        <Users className="w-4 h-4 opacity-50" />
                                        <span>Saved Prospects</span>
                                    </div>
                                    <span className="font-bold text-accent">{company.contact_count}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2 text-secondary">
                                        <MapPin className="w-4 h-4 opacity-50" />
                                        <span>Location</span>
                                    </div>
                                    <span className="font-medium">{company.location || 'Maharashtra, India'}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2 text-secondary">
                                        <Globe className="w-4 h-4 opacity-50" />
                                        <span>Website</span>
                                    </div>
                                    <span className="font-medium text-accent/80 hover:underline truncate max-w-[150px]">{company.website || company.name.toLowerCase() + '.com'}</span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
                {filteredCompanies.length === 0 && (
                    <div className="py-40 text-center text-secondary">
                        <Building2 className="w-16 h-16 mx-auto mb-4 opacity-10" />
                        <p className="text-xl font-medium">No companies found.</p>
                        <p className="text-sm opacity-50 mt-1">Start saving prospects to populate this list.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
