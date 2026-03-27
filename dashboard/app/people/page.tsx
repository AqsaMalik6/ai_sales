'use client'

import { useEffect, useState, useMemo } from 'react'
import { getContacts, Contact } from '@/lib/api'
import { Search, ChevronDown, ChevronUp, Linkedin, MoreHorizontal, Mail, Phone, MapPin } from 'lucide-react'
import ContactDetailPanel from '@/components/ContactDetailPanel'
import { useSearchParams } from 'next/navigation'

export default function PeoplePage() {
    const [contacts, setContacts] = useState<Contact[]>([])
    const [search, setSearch] = useState('')
    const [sortField, setSortField] = useState<keyof Contact>('full_name')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
    const searchParams = useSearchParams()
    const listFilter = searchParams.get('list')

    useEffect(() => {
        const fetchContacts = () => getContacts().then(setContacts);
        fetchContacts();
        
        window.addEventListener('contacts-updated', fetchContacts);
        return () => window.removeEventListener('contacts-updated', fetchContacts);
    }, [])

    const handleSort = (field: keyof Contact) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortOrder('asc')
        }
    }

    const filteredAndSortedContacts = useMemo(() => {
        return contacts
            .filter(c => {
                const matchesSearch = 
                    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
                    c.job_title?.toLowerCase().includes(search.toLowerCase()) ||
                    c.company?.toLowerCase().includes(search.toLowerCase());
                
                const matchesList = !listFilter || c.lists?.some(l => l.name === listFilter);
                
                return matchesSearch && matchesList;
            })
            .sort((a, b) => {
                const aVal = (a[sortField] || '').toString().toLowerCase()
                const bVal = (b[sortField] || '').toString().toLowerCase()
                if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
                if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
                return 0
            })
    }, [contacts, search, sortField, sortOrder, listFilter])

    return (
        <div className="p-0 bg-[#111827] min-h-screen text-primary">
            {/* Header Area */}
            <div className="p-8 border-b border-border bg-[#111827] sticky top-0 z-10">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold">People</h1>
                        <nav className="flex text-xs text-secondary mt-1">
                            <span>Total contacts: {contacts.length}</span>
                        </nav>
                    </div>
                    <div className="flex gap-4">
                        <div className="relative w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                            <input
                                type="text"
                                placeholder="Search by name, title, or company..."
                                className="w-full bg-[#1F2937] border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none ring-1 ring-inset ring-transparent focus:ring-accent/50"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <button className="bg-cta hover:bg-cta/90 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                            Export
                        </button>
                    </div>
                </div>
            </div>

            {/* Table Area */}
            <div className="px-8 py-6">
                <div className="bg-[#1F2937] border border-border rounded-xl shadow-xl overflow-hidden">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-[#111827] border-b border-border text-secondary uppercase text-[11px] font-bold tracking-wider">
                            <tr>
                                <th className="px-6 py-4 w-10">#</th>
                                <th className="px-6 py-4 cursor-pointer hover:text-primary transition-colors min-w-[200px]" onClick={() => handleSort('full_name')}>
                                    <div className="flex items-center gap-2">
                                        👤 Name {sortField === 'full_name' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                                    </div>
                                </th>
                                <th className="px-6 py-4 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('company')}>
                                    <div className="flex items-center gap-2">
                                        🏢 Company {sortField === 'company' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                                    </div>
                                </th>
                                <th className="px-6 py-4">
                                    <div className="flex items-center gap-2">📧 Emails</div>
                                </th>
                                <th className="px-6 py-4">
                                    <div className="flex items-center gap-2">📞 Phone Numbers</div>
                                </th>
                                <th className="px-6 py-4">
                                    <div className="flex items-center gap-2">📍 Location</div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredAndSortedContacts.map((contact, idx) => (
                                <tr
                                    key={contact.id}
                                    className="hover:bg-[#111827] cursor-pointer transition-colors group"
                                    onClick={() => setSelectedContact(contact)}
                                >
                                    <td className="px-6 py-4 text-secondary text-xs">{idx + 1}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-[#374151] rounded-full flex items-center justify-center text-primary text-sm font-bold shrink-0 border border-border">
                                                {contact.profile_photo_url ? (
                                                    <img src={contact.profile_photo_url} alt="" className="w-full h-full rounded-full object-cover" />
                                                ) : contact.full_name[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-bold flex items-center gap-1.5 hover:text-accent transition-colors">
                                                    {contact.full_name}
                                                    <a
                                                        href={contact.linkedin_url}
                                                        target="_blank"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="text-secondary hover:text-[#0077b5]"
                                                    >
                                                        <Linkedin className="w-3 h-3" />
                                                    </a>
                                                </div>
                                                <div className="text-[10px] text-secondary/50 mt-0.5 px-1.5 py-0.5 bg-border/30 rounded w-fit">VERIFIED</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 bg-border rounded flex items-center justify-center shrink-0">
                                                <span className="text-[10px]">{contact.company?.[0]}</span>
                                            </div>
                                            <span className="font-semibold">{contact.company}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {contact.email ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 h-4 bg-success/20 rounded-full flex items-center justify-center">
                                                    <Mail className="w-2.5 h-2.5 text-success" />
                                                </div>
                                                <span className="text-secondary hover:text-primary truncate block max-w-[200px] font-medium">{contact.email}</span>
                                            </div>
                                        ) : (
                                            <span className="text-error/40 italic text-xs">Not found</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {contact.phone ? (
                                            <div className="flex items-center gap-2">
                                                <Phone className="w-3.5 h-3.5 text-secondary" />
                                                <span className="text-secondary font-medium">{contact.phone}</span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-secondary/30 italic">No phone</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-secondary/80">
                                            <MapPin className="w-3.5 h-3.5" />
                                            {contact.location || 'Not specified'}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredAndSortedContacts.length === 0 && (
                        <div className="p-20 text-center text-secondary">
                            <Search className="w-12 h-12 mx-auto mb-4 opacity-10" />
                            <p className="text-lg">No prospects found matching your search.</p>
                        </div>
                    )}
                </div>
            </div>

            <ContactDetailPanel
                contact={selectedContact}
                onClose={() => setSelectedContact(null)}
            />
        </div>
    )
}