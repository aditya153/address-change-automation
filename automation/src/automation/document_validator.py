"""
Document Validator Service

Validates uploaded documents before automation starts:
1. Document Type Classification - Are these the correct documents?
2. Data Completeness Check - Are all required fields present?
"""

import os
import json
from typing import Dict, Tuple, List
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Required fields for a complete case
REQUIRED_FIELDS = [
    "citizen_name",
    "dob",
    "old_address_raw",
    "new_address_raw",
    "move_in_date_raw",
    "landlord_name"
]


def classify_document_type(ocr_text: str) -> Dict:
    """
    Use GPT to classify if the document is a valid address change document.
    
    Returns:
        {
            "is_valid": True/False,
            "document_type": "landlord_confirmation" | "address_form" | "unknown",
            "confidence": "high" | "medium" | "low",
            "reason": "Explanation"
        }
    """
    prompt = f"""
You are a document classification assistant for German public administration.

Analyze the following OCR text and determine if it's a valid document for address registration:

--- OCR TEXT ---
{ocr_text[:3000]}
--- END ---

Valid document types:
1. "landlord_confirmation" - Wohnungsgeberbestätigung (contains: landlord name, tenant info, property address, signature areas)
2. "address_form" - Anmeldeformular/Meldeformular (contains: personal data fields, old/new address, registration date)

Return ONLY a valid JSON object:
{{
    "is_valid": true/false,
    "document_type": "landlord_confirmation" | "address_form" | "unknown",
    "confidence": "high" | "medium" | "low",
    "reason": "Brief explanation of why this is or isn't a valid document"
}}

If the document appears to be completely unrelated (like a random PDF, invoice, or other document), set is_valid to false.
"""
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a document classifier. Return only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.0,
            max_tokens=300
        )
        
        result_text = response.choices[0].message.content.strip()
        
        # Remove markdown code blocks if present
        if result_text.startswith("```json"):
            result_text = result_text[7:]
        if result_text.startswith("```"):
            result_text = result_text[3:]
        if result_text.endswith("```"):
            result_text = result_text[:-3]
        
        return json.loads(result_text.strip())
        
    except Exception as e:
        print(f"Document classification error: {e}")
        return {
            "is_valid": False,
            "document_type": "unknown",
            "confidence": "low",
            "reason": f"Classification failed: {str(e)}"
        }


def validate_documents(landlord_text: str, address_text: str) -> Dict:
    """
    Validate both documents for type correctness.
    
    Returns:
        {
            "valid": True/False,
            "landlord_doc": {...classification result...},
            "address_doc": {...classification result...},
            "errors": ["list of error messages"]
        }
    """
    errors = []
    
    # Classify landlord document
    landlord_result = classify_document_type(landlord_text)
    if not landlord_result.get("is_valid"):
        errors.append(f"Landlord document invalid: {landlord_result.get('reason', 'Unknown error')}")
    elif landlord_result.get("document_type") not in ["landlord_confirmation", "address_form"]:
        errors.append(f"First document is not a recognized address change document")
    
    # Classify address form
    address_result = classify_document_type(address_text)
    if not address_result.get("is_valid"):
        errors.append(f"Address form invalid: {address_result.get('reason', 'Unknown error')}")
    elif address_result.get("document_type") not in ["landlord_confirmation", "address_form"]:
        errors.append(f"Second document is not a recognized address change document")
    
    # Check if we have both document types
    doc_types = {landlord_result.get("document_type"), address_result.get("document_type")}
    if landlord_result.get("is_valid") and address_result.get("is_valid"):
        if "unknown" in doc_types:
            errors.append("One or more documents could not be identified")
    
    return {
        "valid": len(errors) == 0,
        "landlord_doc": landlord_result,
        "address_doc": address_result,
        "errors": errors
    }


def check_data_completeness(parsed_data: Dict) -> Dict:
    """
    Check if all required fields are present and valid in the parsed OCR data.
    
    Returns:
        {
            "complete": True/False,
            "missing_fields": ["list of missing field names"],
            "invalid_fields": ["list of fields with invalid values"]
        }
    """
    missing_fields = []
    invalid_fields = []
    
    for field in REQUIRED_FIELDS:
        value = parsed_data.get(field)
        
        # Check if field exists
        if not value:
            missing_fields.append(field)
            continue
        
        # Check for placeholder/fallback values
        value_lower = str(value).lower()
        if any(placeholder in value_lower for placeholder in ["unknown", "fallback", "n/a", "not found"]):
            invalid_fields.append(field)
    
    # Validate date formats
    for date_field in ["dob", "move_in_date_raw"]:
        value = parsed_data.get(date_field, "")
        if value and not _is_valid_date(value):
            invalid_fields.append(f"{date_field} (invalid format)")
    
    return {
        "complete": len(missing_fields) == 0 and len(invalid_fields) == 0,
        "missing_fields": missing_fields,
        "invalid_fields": invalid_fields
    }


def _is_valid_date(date_str: str) -> bool:
    """Check if a date string is in a valid format."""
    import re
    # Accept YYYY-MM-DD or DD.MM.YYYY
    patterns = [
        r'^\d{4}-\d{2}-\d{2}$',  # YYYY-MM-DD
        r'^\d{2}\.\d{2}\.\d{4}$',  # DD.MM.YYYY
    ]
    return any(re.match(pattern, str(date_str)) for pattern in patterns)


def validate_case_data(landlord_text: str, address_text: str, parsed_data: Dict) -> Dict:
    """
    Complete validation: document types + data completeness.
    
    Returns:
        {
            "valid": True/False,
            "can_auto_process": True/False,  # If True, can proceed without human
            "needs_review": True/False,      # If True, needs human review
            "document_validation": {...},
            "data_validation": {...},
            "errors": ["list of all errors"],
            "warnings": ["list of warnings for human review"]
        }
    """
    # Step 1: Validate document types
    doc_validation = validate_documents(landlord_text, address_text)
    
    # Step 2: Check data completeness
    data_validation = check_data_completeness(parsed_data)
    
    # Compile results
    all_errors = list(doc_validation.get("errors", []))
    warnings = []
    
    # Add data completeness issues
    if data_validation.get("missing_fields"):
        warnings.append(f"Missing fields: {', '.join(data_validation['missing_fields'])}")
    if data_validation.get("invalid_fields"):
        warnings.append(f"Invalid fields: {', '.join(data_validation['invalid_fields'])}")
    
    # Determine processing path
    documents_valid = doc_validation.get("valid", False)
    data_complete = data_validation.get("complete", False)
    
    return {
        "valid": documents_valid,
        "can_auto_process": documents_valid and data_complete,
        "needs_review": documents_valid and not data_complete,
        "document_validation": doc_validation,
        "data_validation": data_validation,
        "errors": all_errors,
        "warnings": warnings
    }
