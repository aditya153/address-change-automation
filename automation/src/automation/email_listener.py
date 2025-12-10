"""
Email Listener Service for Address Change Automation

This service polls a Gmail inbox for new address change request emails,
extracts PDF attachments, creates cases, and triggers the automation workflow.
"""

import os
import sys
import time
import email
import imaplib
import logging
import requests
from email.header import decode_header
from pathlib import Path
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

# Configuration from environment
EMAIL_ADDRESS = os.getenv("EMAIL_ADDRESS", "")
EMAIL_APP_PASSWORD = os.getenv("EMAIL_APP_PASSWORD", "")
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")
IMAP_SERVER = "imap.gmail.com"
POLL_INTERVAL = 10  # seconds

# Upload directory (must match backend)
UPLOAD_DIR = Path("/app/uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Keywords to detect address change requests (case-insensitive)
# Supports both English and German keywords
KEYWORDS = [
    "address change",
    "address registration",
    "change of address",
    "new address",
    "moving",
    "relocation",
    "umzug",           # German: move
    "anmeldung",       # German: registration
    "ummeldung",       # German: re-registration
    "adressänderung",  # German: address change
    "wohnsitz",        # German: residence
    "meldebescheinigung",  # German: registration certificate
]


def decode_mime_header(header_value):
    """Decode MIME-encoded email header."""
    if not header_value:
        return ""
    decoded_parts = decode_header(header_value)
    result = []
    for part, charset in decoded_parts:
        if isinstance(part, bytes):
            result.append(part.decode(charset or 'utf-8', errors='replace'))
        else:
            result.append(part)
    return ' '.join(result)


def get_email_body(msg):
    """Extract text body from email message."""
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            if content_type == "text/plain":
                try:
                    body = part.get_payload(decode=True).decode('utf-8', errors='replace')
                    break
                except:
                    pass
    else:
        try:
            body = msg.get_payload(decode=True).decode('utf-8', errors='replace')
        except:
            pass
    return body


def is_address_change_email(subject, body):
    """Check if email is about address change using multiple keywords."""
    text = f"{subject} {body}".lower()
    for keyword in KEYWORDS:
        if keyword.lower() in text:
            logger.info(f"Matched keyword: '{keyword}'")
            return True
    return False


def extract_attachments(msg, case_prefix):
    """Extract PDF attachments from email and save to upload directory."""
    attachments = []
    
    for part in msg.walk():
        content_disposition = str(part.get("Content-Disposition", ""))
        
        if "attachment" in content_disposition:
            filename = part.get_filename()
            if filename:
                filename = decode_mime_header(filename)
                
                # Only process PDF files
                if filename.lower().endswith('.pdf'):
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    safe_filename = f"{timestamp}_{case_prefix}_{filename}"
                    filepath = UPLOAD_DIR / safe_filename
                    
                    try:
                        with open(filepath, 'wb') as f:
                            f.write(part.get_payload(decode=True))
                        attachments.append(str(filepath))
                        logger.info(f"Saved attachment: {filepath}")
                    except Exception as e:
                        logger.error(f"Failed to save attachment {filename}: {e}")
    
    return attachments


def send_rejection_email(to_email: str, errors: list, help_text: str):
    """Send rejection email to citizen when documents are invalid."""
    import smtplib
    import socket
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    
    logger.info(f"Attempting to send rejection email to {to_email}...")
    
    try:
        # Create email message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = 'Address Change Request - Documents Invalid'
        msg['From'] = EMAIL_ADDRESS
        msg['To'] = to_email
        
        error_list = "\n".join(f"• {err}" for err in errors)
        
        # Plain text version
        text_body = f"""Dear Citizen,

Thank you for submitting your address change request.

Unfortunately, we could not process your documents because:

{error_list}

{help_text}

What to do next:
1. Ensure you have the correct documents:
   - Wohnungsgeberbestätigung (Landlord Confirmation)
   - Anmeldeformular (Address Registration Form)
2. Reply to this email with the correct documents attached

Need help? Visit our chatbot assistant for guidance.

Best regards,
Address Registration Office
"""
        
        # HTML version
        html_body = f"""
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <h2 style="color: #dc2626;">Documents Could Not Be Processed</h2>
    
    <p>Dear Citizen,</p>
    
    <p>Thank you for submitting your address change request.</p>
    
    <p>Unfortunately, we could not process your documents because:</p>
    
    <ul style="background: #fef2f2; padding: 15px 30px; border-left: 4px solid #dc2626; margin: 20px 0;">
        {"".join(f"<li>{err}</li>" for err in errors)}
    </ul>
    
    <p style="background: #f0f9ff; padding: 15px; border-left: 4px solid #0284c7; margin: 20px 0;">
        {help_text}
    </p>
    
    <h3>What to do next:</h3>
    <ol>
        <li>Ensure you have the correct documents:
            <ul>
                <li><strong>Wohnungsgeberbestätigung</strong> (Landlord Confirmation)</li>
                <li><strong>Anmeldeformular</strong> (Address Registration Form)</li>
            </ul>
        </li>
        <li>Reply to this email with the correct documents attached</li>
    </ol>
    
    <p>Need help? <a href="#">Visit our chatbot assistant</a> for guidance.</p>
    
    <hr style="margin-top: 30px; border: none; border-top: 1px solid #e5e7eb;">
    <p style="color: #6b7280; font-size: 12px;">Address Registration Office</p>
</body>
</html>
"""
        
        msg.attach(MIMEText(text_body, 'plain'))
        msg.attach(MIMEText(html_body, 'html'))
        
        # Set socket timeout
        socket.setdefaulttimeout(30)
        
        # Send via SMTP with STARTTLS (port 587 works better in Docker)
        logger.info(f"Connecting to smtp.gmail.com:587...")
        with smtplib.SMTP('smtp.gmail.com', 587, timeout=30) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            logger.info("SMTP connection established, logging in...")
            smtp.login(EMAIL_ADDRESS, EMAIL_APP_PASSWORD)
            logger.info("Logged in, sending email...")
            smtp.sendmail(EMAIL_ADDRESS, to_email, msg.as_string())
        
        logger.info(f"✅ Successfully sent rejection email to {to_email}")
        return True
        
    except socket.timeout:
        logger.error(f"❌ SMTP timeout when sending to {to_email}")
        return False
    except smtplib.SMTPAuthenticationError as e:
        logger.error(f"❌ SMTP auth failed: {e}")
        return False
    except Exception as e:
        logger.error(f"❌ Failed to send rejection email to {to_email}: {type(e).__name__}: {e}")
        return False


def create_case_from_email(sender_email, attachments):
    """Create a new case via the backend API. Returns (case_id, error_info) tuple."""
    if len(attachments) < 2:
        logger.warning(f"Email from {sender_email} has {len(attachments)} PDFs, need at least 2")
        return None, {"errors": ["Not enough PDF attachments. Please attach 2 documents."]}
    
    # Prepare form data for the submit-case endpoint
    try:
        with open(attachments[0], 'rb') as landlord_file, open(attachments[1], 'rb') as address_file:
            files = {
                'landlord_pdf': ('landlord.pdf', landlord_file, 'application/pdf'),
                'address_pdf': ('address.pdf', address_file, 'application/pdf'),
            }
            data = {
                'email': sender_email,
            }
            
            response = requests.post(
                f"{BACKEND_URL}/submit-case",
                data=data,
                files=files,
                timeout=120  # Increased for OCR + validation
            )
            
            if response.status_code == 200:
                result = response.json()
                case_id = result.get('case_id')
                logger.info(f"Created case {case_id} from email by {sender_email}")
                return case_id, None
            elif response.status_code == 400:
                # Document validation failed
                error_info = response.json()
                logger.warning(f"Document validation failed for {sender_email}: {error_info}")
                return None, error_info
            else:
                logger.error(f"Failed to create case: {response.status_code} - {response.text}")
                return None, {"errors": [f"Server error: {response.status_code}"]}
                
    except Exception as e:
        logger.error(f"Error creating case: {e}")
        return None, {"errors": [f"Connection error: {str(e)}"]}



def process_email(mail, email_id):
    """Process a single email: extract info, validate, create case or send rejection."""
    try:
        # Fetch the email
        _, msg_data = mail.fetch(email_id, '(RFC822)')
        raw_email = msg_data[0][1]
        msg = email.message_from_bytes(raw_email)
        
        # Extract sender
        sender = decode_mime_header(msg.get('From', ''))
        # Extract just the email address
        if '<' in sender and '>' in sender:
            sender_email = sender.split('<')[1].split('>')[0]
        else:
            sender_email = sender.strip()
        
        # Extract subject
        subject = decode_mime_header(msg.get('Subject', ''))
        
        # Extract body
        body = get_email_body(msg)
        
        logger.info(f"Processing email from: {sender_email}, Subject: {subject}")
        
        # Check if it's an address change email
        if not is_address_change_email(subject, body):
            logger.info(f"Email does not match address change keywords, skipping")
            return False
        
        # Extract PDF attachments
        case_prefix = sender_email.split('@')[0][:10]
        attachments = extract_attachments(msg, case_prefix)
        
        if len(attachments) < 2:
            logger.warning(f"Not enough PDF attachments ({len(attachments)}), need at least 2")
            # Send rejection email for missing attachments
            send_rejection_email(
                sender_email,
                ["You did not attach enough PDF documents. We need 2 documents."],
                "Please attach both: 1) Wohnungsgeberbestätigung (Landlord Confirmation) and 2) Anmeldeformular (Address Registration Form)"
            )
            # Mark email as read
            mail.store(email_id, '+FLAGS', '\\Seen')
            return False
        
        # Create case via API (includes document validation)
        case_id, error_info = create_case_from_email(sender_email, attachments)
        
        if case_id:
            # Success - case created and automation started
            mail.store(email_id, '+FLAGS', '\\Seen')
            logger.info(f"Successfully processed email, created {case_id}")
            return True
        elif error_info:
            # Document validation failed - send rejection email
            errors = error_info.get("errors", ["Documents could not be validated"])
            help_text = error_info.get("help", "Please ensure you upload valid address change documents.")
            email_sent = send_rejection_email(sender_email, errors, help_text)
            # Mark email as read so we don't process again
            mail.store(email_id, '+FLAGS', '\\Seen')
            if email_sent:
                logger.info(f"Rejection email sent to {sender_email}")
            else:
                logger.warning(f"Could not send rejection email to {sender_email}")
            return False
        
        return False
        
    except Exception as e:
        logger.error(f"Error processing email {email_id}: {e}")
        return False

def poll_inbox(first_poll=False):
    """Connect to Gmail and check for new emails."""
    if not EMAIL_ADDRESS or not EMAIL_APP_PASSWORD:
        logger.error("Email credentials not configured!")
        return
    
    try:
        # Connect to Gmail IMAP
        mail = imaplib.IMAP4_SSL(IMAP_SERVER)
        mail.login(EMAIL_ADDRESS, EMAIL_APP_PASSWORD)
        
        # Only log connection on first poll
        if first_poll:
            logger.info("✅ Connected to Gmail IMAP successfully")
        
        mail.select('INBOX')
        
        # Search for unread emails
        _, message_numbers = mail.search(None, 'UNSEEN')
        email_ids = message_numbers[0].split()
        
        if email_ids:
            logger.info(f"📧 Found {len(email_ids)} unread email(s)")
            
            for email_id in email_ids:
                process_email(mail, email_id)
        # Don't log "No unread emails" - too noisy
        
        mail.close()
        mail.logout()
        
    except imaplib.IMAP4.error as e:
        logger.error(f"IMAP error: {e}")
    except Exception as e:
        logger.error(f"Error polling inbox: {e}")


def main():
    """Main loop - continuously poll inbox."""
    logger.info("=" * 50)
    logger.info("📬 Email Listener Service Started")
    logger.info(f"Monitoring inbox: {EMAIL_ADDRESS}")
    logger.info(f"Poll interval: {POLL_INTERVAL} seconds")
    logger.info(f"Keywords: {', '.join(KEYWORDS)}")
    logger.info("=" * 50)
    
    # Initial delay to let backend start
    time.sleep(5)
    
    # First poll with connection logging
    first_poll = True
    
    while True:
        try:
            poll_inbox(first_poll=first_poll)
            first_poll = False  # Only log connection once
        except Exception as e:
            logger.error(f"Unexpected error in main loop: {e}")
        
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
