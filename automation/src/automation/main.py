from .crew import AddressChangeMain


def run_address_change_workflow(citizen_data: dict):
    """
    Runs the full address-change workflow for one citizen.
    This function is what FastAPI will call later.
    """
    crew_instance = AddressChangeMain()

    # pass citizen_data into the crew as input context
    result = crew_instance.crew().kickoff(
        inputs={"citizen_data": citizen_data}
    )
    return result


if __name__ == "__main__":
    # demo payload for local testing – this is your temporary "mock data"
    demo_data = {
        "citizen_name": "Aditya Nirgude",
        "dob": "2001-02-03",
        "email": "aditya@example.com",
        "old_address_raw": "Villenstrasse 10, 67657 Kaiserslautern",
        "new_address_raw": "Mustestr 12a, 67264 KL",
        "move_in_date_raw": "2025-01-15",
        "landlord_name": "Max Vermieter",
    }

    final = run_address_change_workflow(demo_data)
    print("\n=== FINAL RESULT ===")
    print(final)
