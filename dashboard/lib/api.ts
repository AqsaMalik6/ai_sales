export interface Contact {
    id: string
    linkedin_url: string
    full_name: string
    first_name?: string
    last_name?: string
    job_title?: string
    company?: string
    company_website?: string
    email?: string
    email_source: string
    phone?: string
    phone_type?: string
    profile_photo_url?: string
    headline?: string
    about?: string
    location?: string
    experience?: string
    education?: string
    services?: string
    date_added: string
    list_name?: string
    lists: { name: string }[]
}

export interface List {
    id: string
    name: string
    created_at: string
    contacts: Contact[]
}

export interface Company {
    name: string
    contact_count: number
    location?: string
}

// Function to handle data sync from extension
if (typeof window !== 'undefined') {
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SYNC_FROM_EXTENSION') {
            console.log('--- DASHBOARD SYNC RECEIVED ---', event.data.data.length, 'contacts');
            try {
                localStorage.setItem('local_contacts', JSON.stringify(event.data.data));
                window.dispatchEvent(new Event('contacts-updated'));
            } catch (e) {
                console.error('Failed to update dashboard storage:', e);
            }
        }
    });
}

export async function getContacts(): Promise<Contact[]> {
    if (typeof window === 'undefined') return [];
    try {
        const stored = localStorage.getItem('local_contacts');
        if (!stored) return [];
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.error("Dashboard Storage Error:", e);
        return [];
    }
}

export async function getLists(): Promise<List[]> {
    const contacts = await getContacts();
    const listsMap = new Map<string, Contact[]>();
    
    contacts.forEach(contact => {
        contact.lists.forEach(l => {
            if (!listsMap.has(l.name)) listsMap.set(l.name, []);
            listsMap.get(l.name)?.push(contact);
        });
    });

    return Array.from(listsMap.entries()).map(([name, listContacts]) => ({
        id: name,
        name: name,
        created_at: new Date().toISOString(),
        contacts: listContacts
    }));
}

export async function getCompanies(): Promise<Company[]> {
    const contacts = await getContacts();
    const companyMap = new Map<string, { count: number, location: string }>();
    
    contacts.forEach(c => {
        if (c.company) {
            const existing = companyMap.get(c.company) || { count: 0, location: '' };
            companyMap.set(c.company, { 
                count: existing.count + 1, 
                location: c.location || existing.location 
            });
        }
    });

    return Array.from(companyMap.entries()).map(([name, data]) => ({
        name,
        contact_count: data.count,
        location: data.location
    }));
}

export async function getCompanyContacts(name: string): Promise<Contact[]> {
    const contacts = await getContacts();
    return contacts.filter(c => c.company === name);
}

export async function deleteList(name: string): Promise<void> {
    const contacts = await getContacts();
    const updated = contacts.map(c => ({
        ...c,
        lists: c.lists.filter(l => l.name !== name)
    })).filter(c => c.lists.length > 0 || c.list_name !== name);
    
    localStorage.setItem('local_contacts', JSON.stringify(updated));
    window.dispatchEvent(new Event('contacts-updated'));
}