'use client'

import { useEffect, useState } from 'react'
import { getLists, List as ListType } from '@/lib/api'
import { Search, Plus, ListTodo, Users, Calendar, MoreVertical, Trash2, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function ListsPage() {
    const [lists, setLists] = useState<ListType[]>([])
    const [search, setSearch] = useState('')

    useEffect(() => {
        getLists().then(setLists)
    }, [])

    const handleDeleteList = async (name: string) => {
        if (!confirm(`Are you sure you want to delete the list "${name}"? Contacts will not be deleted.`)) return
        
        const res = await fetch(`http://localhost:8000/api/lists/${encodeURIComponent(name)}`, {
            method: 'DELETE'
        })
        if (res.ok) {
            setLists(lists.filter(l => l.name !== name))
        }
    }

    const filteredLists = lists.filter(l => 
        l.name.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="p-8">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Lists</h1>
                    <p className="text-secondary text-sm">Organize your prospects into manageable segments.</p>
                </div>
                <div className="flex gap-4">
                    <div className="relative w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                        <input
                            type="text"
                            placeholder="Search lists..."
                            className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-[#1a2333] border-b border-border text-secondary uppercase text-[10px] font-bold tracking-wider">
                        <tr>
                            <th className="px-6 py-4">List Name</th>
                            <th className="px-6 py-4">Contacts</th>
                            <th className="px-6 py-4">Created At</th>
                            <th className="px-6 py-4">Last Updated</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {filteredLists.length > 0 ? filteredLists.map((list) => (
                            <tr key={list.id} className="hover:bg-[#1a2333] transition-colors group">
                                <td className="px-6 py-4">
                                    <Link 
                                        href={`/people?list=${encodeURIComponent(list.name)}`}
                                        className="flex items-center gap-3 font-semibold text-primary hover:text-accent transition-colors"
                                    >
                                        <div className="w-8 h-8 bg-border rounded flex items-center justify-center text-secondary group-hover:bg-accent/20 group-hover:text-accent transition-colors">
                                            <ListTodo className="w-4 h-4" />
                                        </div>
                                        {list.name}
                                    </Link>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2 text-secondary">
                                        <Users className="w-4 h-4" />
                                        {list.contacts?.length || 0} contacts
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-secondary">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4" />
                                        {new Date(list.created_at).toLocaleDateString()}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-secondary">
                                    {new Date(list.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button 
                                        onClick={() => handleDeleteList(list.name)}
                                        className="p-2 text-secondary hover:text-error hover:bg-error/10 rounded-lg transition-all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-secondary italic">
                                    No lists found. Add contacts from LinkedIn to create a list.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
