# src/automation/chatbot_service.py
"""
LLM-powered chatbot service for address change assistance.
Uses OpenAI to answer questions about the German address change process.
"""

import os
from openai import OpenAI

# System prompt that restricts chatbot to address change topics only
SYSTEM_PROMPT = """You are a helpful support assistant for the German Address Change System.

CRITICAL LANGUAGE RULE: You MUST respond in the EXACT SAME language the user writes in.
- If user writes in ENGLISH → respond in ENGLISH only
- If user writes in GERMAN → respond in GERMAN only
- Do NOT mix languages. Do NOT use German words when user writes in English.

You ONLY answer questions about:
- Address change process and steps in Germany
- Required documents (landlord certificate, address change form)
- How to fill out forms
- Processing timeline and status
- Common issues and troubleshooting
- What information is needed for address change

If asked about anything unrelated to address changes, politely redirect:
"I can only help with address change related questions. Is there anything about your address change I can assist with?"

Keep responses concise, friendly, and helpful. Use emojis sparingly.

Key information to share when relevant:
1. Required documents: Landlord Certificate and Address Change Form
2. The landlord certificate must be signed by your landlord
3. You need to register within 14 days of moving
4. Processing typically takes 1-3 business days
5. You will receive a confirmation email when complete
"""

# Keywords that trigger document preview - VERY FLEXIBLE MATCHING
DOCUMENT_KEYWORDS = [
    # English - show/display variants
    "show", "see", "view", "display", "preview", "example", "sample", "template",
    # English - appearance variants  
    "look like", "looks like", "look", "how does", "what does", "how do",
    # English - document actions
    "filled out", "format", "need to upload", "have to upload", "upload",
    # German variants
    "aussehen", "zeig", "ansehen", "anzeigen", "beispiel", "vorlage"
]

# Landlord document keywords
LANDLORD_KEYWORDS = [
    "landlord", "wohnungsgeberbestätigung", "landlord certificate", 
    "confirmation", "vermieter", "wohnungsgeber"
]

# Address form keywords  
ADDRESS_FORM_KEYWORDS = [
    "address change", "address form", "anmeldung", "registration", 
    "formular", "change form"
]

# Generic document keywords - triggers showing BOTH documents
GENERIC_DOC_KEYWORDS = [
    "document", "documents", "docs", "dokumente", "unterlagen", "both",
    "papers", "files", "forms", "which", "what"
]


class ChatbotService:
    def __init__(self):
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set")
        self.client = OpenAI(api_key=api_key)
        self.conversation_history = []
    
    def detect_document_request(self, message: str) -> dict:
        """
        Detect if user is asking to see a document preview.
        Returns document type if detected, None otherwise.
        """
        message_lower = message.lower()
        
        # Check if asking to see/show a document
        is_document_request = any(keyword in message_lower for keyword in DOCUMENT_KEYWORDS)
        
        if is_document_request:
            # Check which document type
            is_landlord = any(keyword in message_lower for keyword in LANDLORD_KEYWORDS)
            is_address_form = any(keyword in message_lower for keyword in ADDRESS_FORM_KEYWORDS)
            is_generic = any(keyword in message_lower for keyword in GENERIC_DOC_KEYWORDS)
            
            if is_landlord and not is_address_form:
                return {
                    "type": "landlord",
                    "name": "Landlord Certificate (Wohnungsgeberbestätigung)",
                    "url": "/static/sample_landlord_certificate.png"
                }
            elif is_address_form and not is_landlord:
                return {
                    "type": "address_form",
                    "name": "Address Change Form (Anmeldung)",
                    "url": "/static/sample_address_form.png"
                }
            elif is_generic or (not is_landlord and not is_address_form):
                # Show both documents when asking generically
                return {
                    "type": "both",
                    "name": "Required Documents",
                    "url": "/static/sample_landlord_certificate.png",
                    "url2": "/static/sample_address_form.png"
                }
        
        return None
    
    def get_response(self, user_message: str) -> dict:
        """
        Get a response from the chatbot.
        Returns dict with reply text and optional document preview info.
        """
        # Check for document preview request first
        document_info = self.detect_document_request(user_message)
        
        if document_info:
            if document_info["type"] == "both":
                return {
                    "reply": "Here are the two required documents for your address change. Click on each to view in detail:",
                    "has_document_preview": True,
                    "document_type": document_info["type"],
                    "document_name": document_info["name"],
                    "document_url": document_info["url"],
                    "document_url2": document_info.get("url2")
                }
            else:
                return {
                    "reply": f"Here's an example of the {document_info['name']}. This shows you what the document should look like:",
                    "has_document_preview": True,
                    "document_type": document_info["type"],
                    "document_name": document_info["name"],
                    "document_url": document_info["url"]
                }
        
        # Add user message to history
        self.conversation_history.append({
            "role": "user",
            "content": user_message
        })
        
        # Keep only last 10 messages to prevent token overflow
        if len(self.conversation_history) > 10:
            self.conversation_history = self.conversation_history[-10:]
        
        try:
            # Call OpenAI API
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    *self.conversation_history
                ],
                max_tokens=300,
                temperature=0.7
            )
            
            assistant_message = response.choices[0].message.content
            
            # Add assistant response to history
            self.conversation_history.append({
                "role": "assistant",
                "content": assistant_message
            })
            
            return {
                "reply": assistant_message,
                "has_document_preview": False
            }
            
        except Exception as e:
            print(f"OpenAI API error: {e}")
            return {
                "reply": "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.",
                "has_document_preview": False,
                "error": str(e)
            }
    
    def reset_conversation(self):
        """Reset the conversation history."""
        self.conversation_history = []


# Singleton instance for the API to use
_chatbot_instance = None

def get_chatbot() -> ChatbotService:
    global _chatbot_instance
    if _chatbot_instance is None:
        _chatbot_instance = ChatbotService()
    return _chatbot_instance
