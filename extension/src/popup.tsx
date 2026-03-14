import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

export default function Popup() {
    return (
        <div style={{ 
            width: '320px', 
            padding: '24px', 
            background: '#0F172A', 
            color: 'white', 
            fontFamily: 'Inter, system-ui, sans-serif' 
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                <div style={{ width: '8px', height: '8px', background: '#38BDF8', borderRadius: '50%' }}></div>
                <h1 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Sales Intelligence</h1>
            </div>

            <p style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '8px' }}>PROSPECTING STATUS</p>
            <div style={{ 
                background: '#1E293B', 
                padding: '16px', 
                borderRadius: '12px', 
                border: '1px solid #334155',
                marginBottom: '24px'
            }}>
                <p style={{ fontSize: '14px', margin: 0, color: '#F8FAFC' }}>
                    Extension is active on LinkedIn. Open any profile to start extracting.
                </p>
            </div>

            <button 
                onClick={() => window.open('http://localhost:3000')}
                style={{ 
                    width: '100%', 
                    padding: '12px', 
                    background: '#2563EB', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '8px', 
                    fontWeight: '600', 
                    cursor: 'pointer',
                    fontSize: '14px',
                    marginBottom: '16px'
                }}
            >
                Open Sales Dashboard →
            </button>

            <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>
                    Linked to: Local Database
                </p>
            </div>
        </div>
    );
}

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<Popup />);
}