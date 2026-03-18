import socket
import smtplib
import json
import logging
from http.server import HTTPServer, BaseHTTPRequestHandler
import re
import subprocess

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def get_mx_records(domain):
    """
    Get MX records for a domain using nslookup (Standard library fallback for dns.resolver)
    """
    try:
        # Using nslookup which is available on Windows and Linux
        cmd = ["nslookup", "-type=mx", domain]
        result = subprocess.check_output(cmd, stderr=subprocess.STDOUT, timeout=10).decode()
        
        # Parse output for MX records
        # Example line: domain.com  MX preference = 10, mail exchanger = mx.domain.com
        mx_records = re.findall(r'mail exchanger = ([\w.-]+)', result)
        if not mx_records:
            # Try another common pattern for nslookup
            mx_records = re.findall(r'MX preference = \d+, mail exchanger = ([\w.-]+)', result)
            
        return sorted(mx_records)
    except Exception as e:
        logger.error(f"Error fetching MX records for {domain}: {e}")
        return []

def verify_email_smtp(email):
    """
    Verifies an email address via SMTP RCPT TO
    Returns: 'valid', 'invalid', or 'unknown'
    """
    try:
        domain = email.split('@')[1]
        mx_records = get_mx_records(domain)
        
        if not mx_records:
            # Fallback to A record if no MX
            logger.info(f"No MX records for {domain}, trying A record")
            mx_records = [domain]

        for mx in mx_records:
            try:
                logger.info(f"Connecting to {mx} for {email}...")
                server = smtplib.SMTP(timeout=10)
                server.connect(mx, 25)
                server.ehlo()
                server.mail('verify@gmail.com') # Generic sender
                code, message = server.rcpt(email)
                server.quit()

                logger.info(f"Server response for {email}: {code} {message}")
                
                if code == 250:
                    return 'valid'
                elif code == 550:
                    return 'invalid'
                elif code in [421, 450, 451]:
                    return 'unknown'
                else:
                    continue
            except (socket.timeout, socket.error, smtplib.SMTPException) as e:
                logger.warning(f"Connection to {mx} failed: {e}")
                continue
                
        return 'unknown'
    except Exception as e:
        logger.error(f"SMTP verification error for {email}: {e}")
        return 'unknown'

class SMTPHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        if self.path == '/verify':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                emails = data.get('emails', [])
                
                results = []
                for email in emails:
                    status = verify_email_smtp(email)
                    results.append({
                        "email": email,
                        "status": status
                    })
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                response = {"results": results}
                self.wfile.write(json.dumps(response).encode('utf-8'))
                
            except Exception as e:
                logger.error(f"Handler error: {e}")
                self.send_response(500)
                self.end_headers()

def run(server_class=HTTPServer, handler_class=SMTPHandler, port=8001):
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    logger.info(f"SMTP Verifier running on port {port}...")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        httpd.server_close()

if __name__ == "__main__":
    run()
