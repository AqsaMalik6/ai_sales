'use client'

import { useEffect, useState } from 'react'
import { getCompanyContacts, Contact } from '@/lib/api'
import { Building2, Users, MapPin, ExternalLink, Linkedin, ArrowLeft, Mail, Phone } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

export default function CompanyDetailPage() {
    const params = useParams()
    const name = decodeURIComponent(params.name as string)
    const [contacts, setContacts] = useState<Contact[]>([])
    const [activeTab, setActiveTab] = useState<'overview' | 'people'>('people')

    useEffect(() => {
        getCompanyContacts(name).then(setContacts)
    }, [name])

    return (
        <div className="p-8">
            <Link href="/companies" className="flex items-center gap-2 text-secondary hover:text-primary mb-6 transition-colors w-fit">
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Companies</span>
            </Link>

            <div className="flex gap-8">
                {/* Left Panel */}
                <div className="w-[300px] shrink-0 space-y-6">
                    <div className="bg-card border border-border rounded-xl p-6">
                        <div className="w-16 h-16 bg-border rounded-xl flex items-center justify-center text-secondary mb-4">
                            <Building2 className="w-8 h-8" />
                        </div>
                        <h1 className="text-2xl font-bold mb-2">{name}</h1>
                        <p className="text-secondary text-sm mb-6">Industry information not available.</p>
                        
                        <div className="space-y-4 pt-6 border-t border-border">
                            <div className="flex items-center gap-3 text-sm">
                                <Users className="w-4 h-4 text-secondary" />
                                <span className="text-secondary">Employees saved:</span>
                                <span className="font-semibold">{contacts.length}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <MapPin className="w-4 h-4 text-secondary" />
                                <span className="text-secondary">Location:</span>
                                <span className="font-semibold">{contacts[0]?.location || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel */}
                <div className="flex-1">
                    <div className="border-b border-border mb-6">
                        <div className="flex gap-8">
                            <button 
                                onClick={() => setActiveTab('overview')}
                                className={`pb-4 text-sm font-semibold transition-colors relative ${activeTab === 'overview' ? 'text-accent' : 'text-secondary hover:text-primary'}`}
                            >
                                Overview
                                {activeTab === 'overview' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />}
                            </button>
                            <button 
                                onClick={() => setActiveTab('people')}
                                className={`pb-4 text-sm font-semibold transition-colors relative ${activeTab === 'people' ? 'text-accent' : 'text-secondary hover:text-primary'}`}
                            >
                                People
                                {activeTab === 'people' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />}
                            </button>
                        </div>
                    </div>

                    {activeTab === 'overview' ? (
                        <div className="bg-card border border-border rounded-xl p-8 text-center">
                            <p className="text-secondary">Detailed company overview and insights will be listed here in v2.</p>
                        </div>
                    ) : (
                        <div className="bg-card border border-border rounded-xl overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-[#1a2333] border-b border-border text-secondary uppercase text-[10px] font-bold tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3">Name</th>
                                        <th className="px-4 py-3">Title</th>
                                        <th className="px-4 py-3">Contact</th>
                                        <th className="px-4 py-3">LinkedIn</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {contacts.map((contact) => (
                                        <tr key={contact.id} className="hover:bg-[#1a2333] transition-colors">
                                            <td className="px-4 py-4">
                                                <div className="font-medium">{contact.full_name}</div>
                                            </td>
                                            <td className="px-4 py-4 text-secondary">{contact.job_title}</td>
                                            <td className="px-4 py-4">
                                                <div className="space-y-1">
                                                    {contact.email && <div className="flex items-center gap-2 text-xs text-secondary"><Mail className="w-3 h-3" /> {contact.email}</div>}
                                                    {contact.phone && <div className="flex items-center gap-2 text-xs text-secondary"><Phone className="w-3 h-3" /> {contact.phone}</div>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <a href={contact.linkedin_url} target="_blank" className="text-secondary hover:text-accent inline-block">
                                                    <Linkedin className="w-4 h-4" />
                                                </a>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
