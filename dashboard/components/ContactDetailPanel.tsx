'use client'

import React from 'react'
import { X, Mail, Phone, Briefcase, MapPin, ChevronRight, User, GraduationCap, Sparkles } from 'lucide-react'
import { Contact } from '@/lib/api'

interface Props {
    contact: Contact | null
    onClose: () => void
}

export default function ContactDetailPanel({ contact, onClose }: Props) {
    if (!contact) return null

    const initials = contact.full_name
        ? contact.full_name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
        : '?'

    return (
        <div className="fixed inset-0 w-full z-50 flex flex-col overflow-hidden bg-[#0A0F1A] text-slate-200">
            {/* Ambient Background Effects */}
            <div className="absolute top-0 left-[-20%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />

            {/* Top Navigation Bar */}
            <div className="relative flex items-center justify-between px-8 py-5 border-b border-white/5 bg-[#0B1220]/80 backdrop-blur-xl z-20 shadow-sm">
                <div className="flex items-center gap-3 text-sm font-medium text-slate-400">
                    <span className="hover:text-white cursor-pointer transition-colors px-3 py-1.5 rounded-md hover:bg-white/5">People</span>
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                    <span className="text-white bg-white/5 px-3 py-1.5 rounded-md">{contact.full_name}</span>
                </div>
                <button 
                    onClick={onClose} 
                    className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full transition-all group border border-white/5 hover:border-white/20"
                >
                    <X className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
                </button>
            </div>

            <div className="relative flex-1 flex overflow-hidden z-10">
                {/* Left Sidebar - Profile & Contact */}
                <div className="w-[420px] bg-[#0E1526]/80 backdrop-blur-md flex flex-col h-full shadow-2xl z-20 overflow-y-auto custom-scrollbar relative">
                    <div className="absolute inset-y-0 right-0 w-px bg-white/5 z-30" />
                    
                    {/* Header Details */}
                    <div className="p-8 pb-4">
                        <div className="flex flex-col gap-6">
                            {/* Avatar with gradient border */}
                            <div className="relative w-24 h-24 rounded-2xl p-[2px] bg-gradient-to-br from-indigo-500 via-blue-500 to-purple-600 shadow-xl shadow-indigo-500/20">
                                <div className="w-full h-full bg-[#1A233A] rounded-2xl flex items-center justify-center text-3xl font-bold text-white overflow-hidden">
                                    {contact.profile_photo_url ? (
                                        <img src={contact.profile_photo_url} alt={contact.full_name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="bg-clip-text text-transparent bg-gradient-to-br from-white to-slate-400">
                                            {initials}
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight text-white mb-2 leading-tight">
                                    {contact.full_name}
                                </h1>
                                <div className="flex flex-col gap-2">
                                    <p className="text-slate-300 text-[15px] font-medium leading-relaxed">
                                        {contact.job_title} at <span className="text-indigo-400 hover:text-indigo-300 cursor-pointer font-semibold underline decoration-indigo-400/30 underline-offset-4">{contact.company}</span>
                                    </p>
                                    {contact.location && (
                                        <div className="mt-2 inline-flex items-center gap-1.5 bg-white/5 border border-white/5 w-fit px-3 py-1.5 rounded-full text-xs font-semibold text-slate-400 tracking-wide">
                                            <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                                            {contact.location}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mx-8 my-4" />

                    {/* Contact Information Cards */}
                    <div className="px-8 pb-8 space-y-6">
                        <h3 className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-2">
                            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)]"></span>
                            Contact Evidence
                        </h3>

                        <div className="space-y-4">
                            {/* Email Card */}
                            <div className="group relative p-4 bg-white/[0.02] border border-white/10 rounded-2xl hover:bg-white/[0.04] hover:border-indigo-500/30 transition-all duration-300 overflow-hidden cursor-default shadow-lg shadow-black/20">
                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="relative flex items-start gap-4">
                                    <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
                                        <Mail className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 overflow-hidden pt-0.5">
                                        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mb-1">Email Address</p>
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-[15px] font-semibold text-white truncate">{contact.email || 'Not Discovered'}</p>
                                            {contact.email && (
                                                <span className="shrink-0 text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-md font-bold uppercase">Valid</span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
                                            Source: <span className="text-slate-400">{contact.email_source || 'Advanced Search'}</span>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Phone Card */}
                            <div className="group relative p-4 bg-white/[0.02] border border-white/10 rounded-2xl hover:bg-white/[0.04] hover:border-blue-500/30 transition-all duration-300 overflow-hidden cursor-default shadow-lg shadow-black/20">
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="relative flex items-start gap-4">
                                    <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
                                        <Phone className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 overflow-hidden pt-0.5">
                                        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mb-1">Phone Number</p>
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-[15px] font-semibold text-white truncate">{contact.phone || 'Not Discovered'}</p>
                                            {contact.phone && (
                                                <span className="shrink-0 text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-md font-bold uppercase">Direct</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Content View */}
                <div className="flex-1 overflow-y-auto relative scroll-smooth p-8 custom-scrollbar">
                    <div className="max-w-4xl mx-auto py-4 pb-20 space-y-8">
                        
                        {/* Summary Section */}
                        <div className="bg-gradient-to-b from-white/[0.03] to-transparent border border-white/5 p-8 rounded-3xl shadow-xl shadow-black/20 hover:border-white/10 transition-colors">
                            <h3 className="text-[13px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2 mb-5">
                                <User className="w-4 h-4" /> Professional Summary
                            </h3>
                            <p className="text-slate-300 text-[15.5px] leading-relaxed whitespace-pre-wrap font-medium">
                                {contact.about || 'No detailed background available for this profile.'}
                            </p>
                        </div>

                        {/* Experience Timeline */}
                        {contact.experience && (
                            <div className="bg-[#121929]/80 backdrop-blur-md border border-white/5 p-8 rounded-3xl shadow-xl shadow-black/20 hover:border-indigo-500/20 transition-all duration-300 group">
                                <h3 className="text-[13px] font-bold text-slate-400 group-hover:text-indigo-400 uppercase tracking-widest flex items-center gap-2 mb-6 transition-colors">
                                    <Briefcase className="w-4 h-4" /> Work Experience
                                </h3>
                                <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap pl-5 border-l-2 border-indigo-500/20 space-y-8">
                                    {contact.experience.split('\n\n').map((block, idx) => (
                                        <div key={idx} className="relative">
                                            <div className="absolute -left-[27px] top-1.5 w-3 h-3 rounded-full bg-indigo-500/50 border-2 border-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.6)]" />
                                            <p className="text-[15px] text-slate-200">{block}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Education Section */}
                        {contact.education && (
                            <div className="bg-[#121929]/80 backdrop-blur-md border border-white/5 p-8 rounded-3xl shadow-xl shadow-black/20 hover:border-blue-500/20 transition-all duration-300 group">
                                <h3 className="text-[13px] font-bold text-slate-400 group-hover:text-blue-400 uppercase tracking-widest flex items-center gap-2 mb-6 transition-colors">
                                    <GraduationCap className="w-5 h-5" /> Education History
                                </h3>
                                <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap pl-5 border-l-2 border-blue-500/20 space-y-8">
                                    {contact.education.split('\n\n').map((block, idx) => (
                                        <div key={idx} className="relative">
                                            <div className="absolute -left-[27px] top-1.5 w-3 h-3 rounded-full bg-blue-500/50 border-2 border-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.6)]" />
                                            <p className="text-[15px] text-slate-200">{block}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Services Section */}
                        {contact.services && (
                            <div className="bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border border-indigo-500/10 p-8 rounded-3xl shadow-xl shadow-black/20">
                                <h3 className="text-[13px] font-bold text-purple-400 uppercase tracking-widest flex items-center gap-2 mb-5">
                                    <Sparkles className="w-4 h-4" /> Featured Services
                                </h3>
                                <div className="text-slate-200 text-[15px] leading-relaxed py-2 font-medium">
                                    {contact.services}
                                </div>
                            </div>
                        )}
                        
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{__html: `
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: rgba(255, 255, 255, 0.1);
                    border-radius: 20px;
                }
                .custom-scrollbar:hover::-webkit-scrollbar-thumb {
                    background-color: rgba(255, 255, 255, 0.2);
                }
            `}} />
        </div>
    )
}
