from typing import List
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
)

load_dotenv()  # load OPENAI_API_KEY etc. from .env if present


@CrewBase
class AddressChangeMain:

    agents: List[BaseAgent]
    tasks: List[Task]

    agents_config = "config/agents.yaml"
    tasks_config = "config/tasks.yaml"

    llm = LLM(
        model="gpt-4o-mini",
        temperature=0.1,  # Lower temperature for more deterministic outputs  # Increased to allow complete responses
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
            tools=[assess_quality_tool],
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
            #human_input=True,
        )

    @task
    def check_business_rules_task(self) -> Task:
        return Task(
            config=self.tasks_config["check_business_rules_task"],
        )

    @task
    def update_registry_task(self) -> Task:
        return Task(
            config=self.tasks_config["update_registry_task"],
        )

    @task
    def generate_certificate_task(self) -> Task:
        return Task(
            config=self.tasks_config["generate_certificate_task"],
            output_file="output/address_change_summary.md",
        )

    @task
    def generate_audit_log_task(self) -> Task:
        return Task(
            config=self.tasks_config["generate_audit_log_task"],
            output_file="output/audit_log.md",
        )

    @crew
    def crew(self) -> Crew:

        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
            verbose=False,  # Disable verbose logs
        )

