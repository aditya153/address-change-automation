from typing import List, Callable, Any
from crewai import Agent, Crew, Process, Task, LLM
from crewai.project import CrewBase, agent, crew, task
from crewai.agents.agent_builder.base_agent import BaseAgent
from dotenv import load_dotenv

from dotenv import load_dotenv

# Import all tools
from src.automation.tools.crewai_tools import (
    ingest_case_tool,
    verify_identity_tool,
    assess_quality_tool,
    check_business_rules_tool,
    update_registry_tool,
    generate_certificate_tool,
    get_audit_log_tool,
    # Memory system tools
    lookup_similar_cases_tool,
)

load_dotenv()  # load OPENAI_API_KEY etc. from .env if present


# ===== CONDITIONAL EXECUTION HELPER =====
def create_hitl_check_condition() -> Callable:
    """
    Creates a condition function that checks if the case is waiting for HITL.
    Tasks with this condition will be skipped if the case is in WAITING_FOR_HUMAN status.
    """
    def check_hitl_status(context: Any) -> bool:
        """
        Check if the case is NOT waiting for HITL.
        Returns True if task should execute, False if it should be skipped.
        """
        try:
            from src.automation.db import fetch_case_by_id, add_audit_entry
            
            # Try to extract case_id from context
            case_id = None
            if hasattr(context, 'get'):
                citizen_data = context.get('citizen_data', {})
                case_id = citizen_data.get('case_id')
            elif isinstance(context, str):
                # Try to parse case_id from string context
                import re
                match = re.search(r'Case ID:?\s*(\d+)', str(context))
                if match:
                    case_id = f"Case ID: {match.group(1)}"
            
            if case_id:
                case_row = fetch_case_by_id(case_id)
                if case_row and case_row.get("status") == "WAITING_FOR_HUMAN":
                    add_audit_entry(case_id, "Task conditionally skipped - case waiting for HITL")
                    print(f"⏭️ Task skipped for {case_id} - HITL pending")
                    return False  # Skip task
                    
            return True  # Execute task
            
        except Exception as e:
            print(f"Condition check error (executing anyway): {e}")
            return True  # Execute on error to avoid blocking
    
    return check_hitl_status


@CrewBase
class AddressChangeMain:

    agents: List[BaseAgent]
    tasks: List[Task]

    agents_config = "config/agents.yaml"
    tasks_config = "config/tasks.yaml"

    llm = LLM(
        model="gpt-4o-mini",
        temperature=0.1,  # Lower temperature for more deterministic outputs
    )

    @agent
    def ingest_case_agent(self) -> Agent:
        return Agent(
            config=self.agents_config["ingest_case_agent"],
            llm=self.llm,
            verbose=True,  # Enable to see agent activity
            tools=[ingest_case_tool],
        )

    @agent
    def verification_officer(self) -> Agent:
        return Agent(
            config=self.agents_config["verification_officer"],
            llm=self.llm,
            verbose=True,
            tools=[verify_identity_tool],
        )

    @agent
    def quality_confidence_officer(self) -> Agent:
        return Agent(
            config=self.agents_config["quality_confidence_officer"],
            llm=self.llm,
            verbose=True,
            tools=[assess_quality_tool, lookup_similar_cases_tool],  # Added memory lookup tool
        )

    @agent
    def business_rules_officer(self) -> Agent:
        return Agent(
            config=self.agents_config["business_rules_officer"],
            llm=self.llm,
            verbose=True,
            tools=[check_business_rules_tool],
        )

    @agent
    def registry_update_officer(self) -> Agent:
        return Agent(
            config=self.agents_config["registry_update_officer"],
            llm=self.llm,
            verbose=True,
            tools=[update_registry_tool],
        )

    @agent
    def certificate_officer(self) -> Agent:
        return Agent(
            config=self.agents_config["certificate_officer"],
            llm=self.llm,
            verbose=True,
            tools=[generate_certificate_tool],
        )

    @agent
    def audit_officer(self) -> Agent:
        return Agent(
            config=self.agents_config["audit_officer"],
            llm=self.llm,
            verbose=True,
            tools=[get_audit_log_tool],
        )

    @task
    def ingest_case_task(self) -> Task:
        return Task(
            config=self.tasks_config["ingest_case_task"],
        )

    @task
    def verify_identity_task(self) -> Task:
        return Task(
            config=self.tasks_config["verify_identity_task"],
        )

    @task
    def assess_quality_task(self) -> Task:
        cfg = self.tasks_config["assess_quality_task"]
        return Task(
            config=cfg,
            # Note: This task determines if HITL is needed
            # Downstream tasks will check status before executing
        )

    @task
    def check_business_rules_task(self) -> Task:
        """
        Business rules task with conditional execution.
        Will be skipped if case is waiting for HITL.
        """
        return Task(
            config=self.tasks_config["check_business_rules_task"],
            # Note: The MCP tool itself checks HITL status and returns early if needed
        )

    @task
    def update_registry_task(self) -> Task:
        """
        Registry update task with conditional execution.
        Will be skipped if case is waiting for HITL.
        """
        return Task(
            config=self.tasks_config["update_registry_task"],
            # Note: The MCP tool itself checks HITL status and returns early if needed
        )

    @task
    def generate_certificate_task(self) -> Task:
        """
        Certificate generation task with conditional execution.
        Will be skipped if case is waiting for HITL.
        """
        return Task(
            config=self.tasks_config["generate_certificate_task"],
            output_file="output/address_change_summary.md",
            # Note: The MCP tool itself checks HITL status and returns early if needed
        )

    @task
    def generate_audit_log_task(self) -> Task:
        """
        Audit log task always runs to capture the full workflow state.
        """
        return Task(
            config=self.tasks_config["generate_audit_log_task"],
            output_file="output/audit_log.md",
        )

    @crew
    def crew(self) -> Crew:
        """
        Creates the AddressChange crew with conditional task execution.
        Tasks after assess_quality will check HITL status before executing.
        """
        from .log_manager import log_manager

        def step_callback(agent_output: Any, *args, **kwargs):
            """Callback for every agent step"""
            try:
                log_manager.log_agent_step(agent_output)
            except Exception as e:
                print(f"Logging Error: {e}")

        def task_callback(task_output: Any, *args, **kwargs):
             """Callback for task completion"""
             # We can keep this one simple or mute it entirely
             pass

        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
            verbose=False,  # Disable CrewAI's verbose output
            step_callback=step_callback,
            task_callback=task_callback
        )
