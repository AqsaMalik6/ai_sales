/**
 * smtpClient.ts
 * Client for interacting with the local SMTP verifier server
 */

export interface VerificationResult {
    email: string;
    status: 'valid' | 'invalid' | 'unknown';
}

export const verifyEmailsBatch = async (emails: string[]): Promise<VerificationResult[]> => {
    try {
        const response = await fetch('http://localhost:8001/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ emails })
        });

        if (!response.ok) {
            throw new Error('SMTP server offline');
        }

        const data = await response.json();
        return data.results;
    } catch (e) {
        console.warn("SMTP verification failed or server offline:", e);
        throw new Error('SMTP_OFFLINE');
    }
};
