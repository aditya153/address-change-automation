"""
CrewAI-compatible MCP tool wrappers.
These tools call MCP server functions directly (bypassing stdio for Docker compatibility).
The MCP server structure is maintained for future HTTP-based deployment.
"""
from crewai.tools import tool
from typing import Dict, Optional

# Import MCP server tool implementations directly
from src.automation.tools.mcp_server import (
    ingest_case,
    verify_identity,
    assess_quality,
    check_business_rules,
    update_registry,
    generate_certificate,
    get_audit_log,
    IngestCaseInput,
    VerifyIdentityInput,
    AssessQualityInput,
    BusinessRulesInput,
    UpdateRegistryInput,
    GenerateCertificateInput,
    GetAuditLogInput,
)


@tool("ingest_case")
def ingest_case_tool(
    citizen_name: str,
    dob: str,
    email: str,
    old_address_raw: str,
    new_address_raw: str,
    move_in_date_raw: str,
    landlord_name: Optional[str] = None,
    case_id: Optional[str] = None
) -> Dict:
    """Create a new case row in the database via MCP server function.
    
    Args:
        citizen_name: Full name of the citizen
        dob: Date of birth in YYYY-MM-DD format
        email: Email address
        old_address_raw: Previous address (raw format)
        new_address_raw: New address (raw format)
        move_in_date_raw: Move-in date in YYYY-MM-DD format
        landlord_name: Name of the landlord (optional)
        case_id: Existing Case ID if available (optional)
    
    Returns:
        Dictionary with case_id, extracted_data, and status
    """
    print(f"DEBUG: ingest_case_tool called with case_id={case_id}")
    input_data = IngestCaseInput(
        citizen_name=citizen_name,
        dob=dob,
        email=email,
        old_address_raw=old_address_raw,
        new_address_raw=new_address_raw,
        move_in_date_raw=move_in_date_raw,
        landlord_name=landlord_name,
        case_id=case_id,
    )
    try:
        result = ingest_case(input_data)
        print(f"DEBUG: ingest_case result: {result}")
        return result.model_dump()
    except Exception as e:
        print(f"DEBUG: ingest_case error: {e}")
        raise e


@tool("verify_identity")
def verify_identity_tool(
    case_id: str,
    citizen_name: str,
    dob: str
) -> Dict:
    """Verify citizen identity against the registry via MCP server function.
    
    Args:
        case_id: The case ID to verify
        citizen_name: Full name of the citizen
        dob: Date of birth
    
    Returns:
        Dictionary with exists flag and reasons
    """
    input_data = VerifyIdentityInput(
        case_id=case_id,
        citizen_name=citizen_name,
        dob=dob,
    )
    result = verify_identity(input_data)
    return result.model_dump()


@tool("assess_quality")
def assess_quality_tool(
    case_id: str,
    new_address_raw: str
) -> Dict:
    """Assess the quality of the extracted address via MCP server function.
    
    Args:
        case_id: The case ID to assess
        new_address_raw: Raw new address string
    
    Returns:
        Dictionary with canonical_address, confidence, and HITL info
    """
    input_data = AssessQualityInput(
        case_id=case_id,
        new_address_raw=new_address_raw,
    )
    result = assess_quality(input_data)
    return result.model_dump()


@tool("check_business_rules")
def check_business_rules_tool(
    case_id: str,
    move_in_date_raw: str,
    canonical_address: str,
    documents_ok: bool = True
) -> Dict:
    """Check business rules for address change compliance via MCP server function.
    
    Args:
        case_id: The case ID to check
        move_in_date_raw: Move-in date string
        canonical_address: Canonical address format
        documents_ok: Whether documents are valid
    
    Returns:
        Dictionary with overall_status, needs_hitl, and rule_results
    """
    input_data = BusinessRulesInput(
        case_id=case_id,
        move_in_date_raw=move_in_date_raw,
        canonical_address=canonical_address,
        documents_ok=documents_ok,
    )
    result = check_business_rules(input_data)
    return result.model_dump()


@tool("update_registry")
def update_registry_tool(
    case_id: str,
    new_address: str,
    citizen_id: str = "CIT-DEMO-001"
) -> Dict:
    """Update the official registry with the new address via MCP server function.
    
    Args:
        case_id: The case ID to update
        new_address: The canonical new address
        citizen_id: Citizen identifier
    
    Returns:
        Dictionary with update status and message
    """
    input_data = UpdateRegistryInput(
        case_id=case_id,
        citizen_id=citizen_id,
        new_address=new_address,
    )
    result = update_registry(input_data)
    return result.model_dump()


@tool("generate_certificate")
def generate_certificate_tool(
    case_id: str,
    email: str,
    citizen_name: str,
    dob: str,
    move_in_date: str,
    new_address: str
) -> Dict:
    """Generate address change certificate and send via email through MCP server function.
    
    Args:
        case_id: The case ID
        email: Email address to send certificate to
        citizen_name: Full name of the citizen
        dob: Date of birth in YYYY-MM-DD format
        move_in_date: Move-in date in YYYY-MM-DD format
        new_address: The new canonical address
    
    Returns:
        Dictionary with certificate path, email status, and case status
    """
    input_data = GenerateCertificateInput(
        case_id=case_id,
        email=email,
        citizen_name=citizen_name,
        dob=dob,
        move_in_date=move_in_date,
        new_address=new_address,
    )
    result = generate_certificate(input_data)
    return result.model_dump()


@tool("get_audit_log")
def get_audit_log_tool(case_id: str) -> Dict:
    """Retrieve the complete audit log for a case via MCP server function.
    
    Args:
        case_id: The case ID
    
    Returns:
        Dictionary with case_id and list of audit entries
    """
    input_data = GetAuditLogInput(case_id=case_id)
    result = get_audit_log(input_data)
    return result.model_dump()
