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
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px;">
                        Address Change Confirmation
                    </h2>
                    
                    <p style="margin-top: 20px;">Dear {citizen_name},</p>
                    
                    <p>We are pleased to inform you that your address change request (Reference: <strong>{case_id}</strong>) has been successfully processed and registered in our official records.</p>
                    
                    <p>Your official <strong>Address Change Certificate</strong> is attached to this email for your records. Please keep this document safe as it serves as proof of your updated residential information.</p>
                    
                    <div style="background-color: #f8f9fa; border-left: 4px solid #3498db; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0;"><strong>What happens next?</strong></p>
                        <p style="margin: 5px 0 0 0;">Your new address has been updated in the citizen registry. No further action is required from your side.</p>
                    </div>
                    
                    <p>If you have any questions or require additional assistance, please do not hesitate to contact us.</p>
                    
                    <p style="margin-top: 30px;">Best regards,</p>
                    <p style="margin: 5px 0;">
                        <strong>German Public Administration</strong><br>
                        <span style="color: #7f8c8d; font-size: 0.9em;">Citizen Services Department</span>
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
                    <p style="font-size: 0.85em; color: #7f8c8d; text-align: center;">
                        This is an automated message. Please do not reply to this email.
                    </p>
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
