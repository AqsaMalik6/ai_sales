'use client'

import React, { useState } from 'react'
import { X, Mail, Phone, Linkedin, Globe, Calendar, Briefcase, MapPin, ExternalLink, Plus, Send, MoreHorizontal, ChevronDown, Users } from 'lucide-react'
import { Contact } from '@/lib/api'

interface Props {
    contact: Contact | null
    onClose: () => void
}

export default function ContactDetailPanel({ contact, onClose }: Props) {
    const [activeTab, setActiveTab] = useState<'About' | 'New prospects' | 'Existing contacts'>('About')

    if (!contact) return null

    const initials = contact.full_name
        ? contact.full_name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
        : '?'

    return (
        <div className="fixed inset-y-0 right-0 w-[1000px] bg-[#111827] shadow-2xl z-50 transform border-l border-border transition-transform duration-300 ease-in-out flex flex-col overflow-hidden">
            {/* Top Header Barra */}
            <div className="flex items-center justify-between p-6 bg-[#111827] border-b border-border">
                <div className="flex items-center gap-2 text-xs text-secondary font-bold">
                    <span className="hover:text-primary cursor-pointer">People</span>
                    <span>&gt;</span>
                    <span className="text-secondary/60">{contact.full_name}</span>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-border rounded-full transition-colors">
                    <X className="w-5 h-5 text-secondary" />
                </button>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Left Side Info Panel (Apollo Style) */}
                <div className="w-[380px] border-r border-border p-8 overflow-y-auto space-y-8 bg-[#111827]">
                    <div className="space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="w-16 h-16 bg-[#374151] rounded-lg flex items-center justify-center text-primary text-2xl font-bold border border-border overflow-hidden">
                                {contact.profile_photo_url ? (
                                    <img src={contact.profile_photo_url} alt="" className="w-full h-full object-cover" />
                                ) : initials}
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    {contact.full_name}
                                    <Briefcase className="w-4 h-4 text-secondary/60" />
                                </h2>
                                <p className="text-secondary text-sm font-medium mt-1 leading-snug">
                                    {contact.job_title} at <span className="text-accent underline cursor-pointer">{contact.company}</span>
                                </p>
                                <p className="text-secondary/60 text-xs mt-2 flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> {contact.location || 'Not specified'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 pt-4 border-t border-border/10">
                            <button className="p-2 border border-border rounded-lg text-secondary hover:text-primary transition-colors">
                                <MoreHorizontal className="w-4 h-4" />
                            </button>
                            <button className="p-2 border border-border rounded-lg text-secondary hover:text-primary transition-colors">
                                <Phone className="w-4 h-4" />
                            </button>
                            <button className="p-2 border border-border rounded-lg text-secondary hover:text-primary transition-colors">
                                <Mail className="w-4 h-4" />
                            </button>
                            <button className="flex-1 bg-[#1F2937] border border-border hover:bg-border px-3 py-2 rounded-lg text-[11px] font-bold text-secondary uppercase tracking-wider flex items-center justify-center gap-2">
                                <Plus className="w-3 h-3" /> Add to list
                            </button>
                            <button className="flex-1 bg-[#FACC15] hover:bg-[#EAB308] px-3 py-2 rounded-lg text-[11px] font-bold text-black uppercase tracking-wider flex items-center justify-center gap-2">
                                <Send className="w-3 h-3" /> Add to sequence
                            </button>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <div className="flex items-center justify-between group cursor-pointer">
                                <h3 className="text-[11px] font-bold text-secondary uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-1 h-1 bg-accent rounded-full"></span> Contact information
                                </h3>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Plus className="w-3 h-3 text-secondary" />
                                    <ChevronDown className="w-3 h-3 text-secondary" />
                                </div>
                            </div>

                            <div className="mt-4 space-y-4">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] text-secondary/50 font-bold uppercase">Email</span>
                                    <div className="flex items-center justify-between p-3 bg-[#1F2937] border border-border rounded-xl">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="w-2 h-2 rounded-full bg-success"></div>
                                            <span className="text-sm font-medium truncate">{contact.email || 'N/A'}</span>
                                        </div>
                                        <span className="text-[10px] bg-border px-1.5 py-0.5 rounded text-secondary/70 font-bold uppercase">Primary</span>
                                    </div>
                                    <span className="text-[10px] text-secondary/40 mt-1">Source: {contact.email_source || 'Advanced Scraper'}</span>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] text-secondary/50 font-bold uppercase">Phone numbers</span>
                                    <div className="flex items-center justify-between p-3 bg-[#1F2937] border border-border rounded-xl">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="w-2.5 h-2.5 text-secondary/40"><Phone className="w-full h-full" /></div>
                                            <span className="text-sm font-medium">{contact.phone || 'N/A'}</span>
                                        </div>
                                        <span className="text-[10px] bg-border px-1.5 py-0.5 rounded text-secondary/70 font-bold uppercase">Default</span>
                                    </div>
                                    <span className="text-[10px] text-secondary/40 mt-1">Source: Advanced Scraper</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-[11px] font-bold text-secondary uppercase tracking-widest flex items-center gap-2">
                                <MapPin className="w-3 h-3" /> Location
                            </h3>
                            <div className="p-4 border border-border rounded-xl bg-card/10">
                                <span className="text-sm font-medium">{contact.location || 'Not specified'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side Content Panel */}
                <div className="flex-1 flex flex-col bg-[#111827] overflow-hidden">
                    {/* Tabs */}
                    <div className="px-8 pt-6 border-b border-border flex gap-8 whitespace-nowrap overflow-x-auto">
                        {['About', 'New prospects', 'Existing contacts'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={`pb-4 text-[13px] font-bold transition-all relative ${activeTab === tab ? 'text-accent' : 'text-secondary/60 hover:text-primary'}`}
                            >
                                {tab}
                                {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent"></div>}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 p-8 overflow-y-auto space-y-8 max-w-3xl">
                        <section className="space-y-6">
                            <div>
                                <h3 className="text-[11px] font-bold text-secondary uppercase tracking-widest mb-4">About</h3>
                                <p className="text-secondary/80 text-sm leading-relaxed whitespace-pre-wrap">
                                    {contact.about || 'No description available'}
                                </p>
                            </div>

                            {contact.experience && (
                                <div>
                                    <h3 className="text-[11px] font-bold text-secondary uppercase tracking-widest mb-4">Experience</h3>
                                    <div className="text-secondary/80 text-sm leading-relaxed whitespace-pre-wrap bg-border/10 p-4 rounded-xl border border-border/20">
                                        {contact.experience}
                                    </div>
                                </div>
                            )}

                            {contact.education && (
                                <div>
                                    <h3 className="text-[11px] font-bold text-secondary uppercase tracking-widest mb-4">Education</h3>
                                    <div className="text-secondary/80 text-sm leading-relaxed whitespace-pre-wrap bg-border/10 p-4 rounded-xl border border-border/20">
                                        {contact.education}
                                    </div>
                                </div>
                            )}

                            {contact.services && (
                                <div>
                                    <h3 className="text-[11px] font-bold text-secondary uppercase tracking-widest mb-4">Services</h3>
                                    <div className="text-secondary/80 text-sm leading-relaxed bg-accent/5 p-4 rounded-xl border border-accent/20">
                                        {contact.services}
                                    </div>
                                </div>
                            )}
                        </section>
                    </div>
                </div>
            </div>
        </div>
    )
}
