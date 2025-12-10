"""
Email service using SendGrid
"""
import os
import base64
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Attachment, FileContent, FileName, FileType, Disposition


def send_certificate_email(to_email: str, pdf_path: str, case_id: str, citizen_name: str) -> bool:
    """
    Send certificate email with PDF attachment using SendGrid
    """
    sendgrid_api_key = os.getenv("SENDGRID_API_KEY")
    sender_email = os.getenv("SENDER_EMAIL", "noreply@addresschange.com")
    
    if not sendgrid_api_key:
        print("CRITICAL ERROR: SENDGRID_API_KEY not set in environment variables. Email cannot be sent.")
        return False
    
    try:
        message = Mail(
            from_email=sender_email,
            to_emails=to_email,
            subject=f'Address Change Confirmation - {case_id}',
            html_content=f'''
            <html>
            <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f3f4f6; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                    
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #0052b5 0%, #1565c0 100%); padding: 30px 40px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Amtliche Bestätigung</h1>
                        <p style="color: #e0e7ff; margin: 5px 0 0 0; font-size: 14px;">Address Change Success</p>
                    </div>

                    <!-- Content -->
                    <div style="padding: 40px;">
                        <p style="font-size: 16px; margin-bottom: 20px;">Dear {citizen_name},</p>
                        
                        <p>We are pleased to inform you that your address change request has been <strong>successfully processed</strong> and officially registered.</p>

                        <div style="background-color: #eff6ff; border-left: 4px solid #1e40af; padding: 20px; margin: 25px 0; border-radius: 4px;">
                            <p style="margin: 0; font-size: 14px; text-transform: uppercase; color: #1e40af; font-weight: bold; letter-spacing: 0.5px;">Reference Number</p>
                            <p style="margin: 5px 0 0 0; font-size: 18px; color: #111; font-family: monospace;">{case_id}</p>
                        </div>
                        
                        <p>Your official <strong>Address Change Certificate</strong> (Meldebescheinigung) is attached to this email. This document serves as legal proof of your new residence.</p>
                        
                        <div style="border-top: 1px solid #e5e7eb; margin: 30px 0;"></div>
                        
                        <h3 style="color: #111; font-size: 16px;">What happens next?</h3>
                        <p style="color: #4b5563; font-size: 14px;">Your data has been securely updated in the central citizen registry. No further action is required from your side.</p>
                    </div>
                    
                    <!-- Footer -->
                    <div style="background-color: #f9fafb; padding: 20px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
                        <p style="margin: 0; font-weight: bold; color: #374151;">German Public Administration</p>
                        <p style="margin: 5px 0; color: #6b7280; font-size: 12px;">Amt für Meldewesen und Bürgerservice</p>
                        <p style="margin-top: 15px; color: #9ca3af; font-size: 11px;">
                            This is an automated message. Please do not reply directly to this email.<br>
                            &copy; 2025 Bundesrepublik Deutschland
                        </p>
                    </div>
                </div>
            </body>
            </html>
            '''
        )
        
        # Attach PDF
        with open(pdf_path, 'rb') as f:
            pdf_data = f.read()
            encoded_file = base64.b64encode(pdf_data).decode()
            
            attached_file = Attachment(
                FileContent(encoded_file),
                FileName(f'{case_id}_certificate.pdf'),
                FileType('application/pdf'),
                Disposition('attachment')
            )
            message.attachment = attached_file
        
        # Send email
        sg = SendGridAPIClient(sendgrid_api_key)
        response = sg.send(message)
        
        if response.status_code in [200, 201, 202]:
            print(f"Email successfully sent to {to_email}! Status code: {response.status_code}")
            return True
        else:
            print(f"Failed to send email. Status code: {response.status_code}, Body: {response.body}")
            return False
        
    except Exception as e:
        print(f"CRITICAL: Email sending exception: {str(e)}")
        # Check for common SendGrid errors
        if "The from address does not match a verified Sender Identity" in str(e):
             print(f"HINT: The sender email '{sender_email}' is not verified in SendGrid. Please verify it or update SENDER_EMAIL in .env.")
        return False
