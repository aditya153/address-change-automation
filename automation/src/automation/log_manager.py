import asyncio
import queue
import json
from datetime import datetime
from typing import List, Set

class LogManager:
    _instance = None
    
    # Queue for receiving logs from sync threads (CrewAI)
    _sync_queue: queue.Queue = queue.Queue()
    
    # Set of async queues for connected SSE clients
    _async_queues: Set[asyncio.Queue] = set()
    
    _is_running = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(LogManager, cls).__new__(cls)
        return cls._instance

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls()
        return cls._instance

    def log(self, message: str, type: str = "info", agent: str = "System"):
        """
        Thread-safe method called by CrewAI agents/tools.
        Pushes to the sync queue.
        """
        payload = {
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "message": message,
            "type": type,
            "agent": agent
        }
        self._sync_queue.put(payload)

    async def stream_logs_to_clients(self):
        """
        Background task: moves logs from sync_queue to all connected async_queues.
        """
        self._is_running = True
        print("🚀 LogManager: Background stream task started")
        
        while self._is_running:
            try:
                # Non-blocking get from sync queue
                try:
                    payload = self._sync_queue.get_nowait()
                    
                    # Format as SSE event
                    sse_message = f"data: {json.dumps(payload)}\n\n"
                    
                    # Broadcast to all connected clients
                    failed_queues = []
                    for q in list(self._async_queues):
                        try:
                            await q.put(sse_message)
                        except Exception:
                            failed_queues.append(q)
                    
                    # Cleanup dead queues
                    for q in failed_queues:
                        self.disconnect(q)
                        
                except queue.Empty:
                    # Sleep briefly to avoid busy loop
                    await asyncio.sleep(0.1)
                    
            except Exception as e:
                print(f"LogManager Error: {e}")
                await asyncio.sleep(1)

    async def connect(self) -> asyncio.Queue:
        """Create a new async queue for a connecting client."""
        q = asyncio.Queue()
        self._async_queues.add(q)
        
        # Send a welcome packet
        await q.put(f"data: {json.dumps({'timestamp': datetime.now().strftime('%H:%M:%S'), 'message': 'Connected to Live Brain 🧠', 'type': 'system', 'agent': 'System'})}\n\n")
        
        return q

    def disconnect(self, q: asyncio.Queue):
        if q in self._async_queues:
            self._async_queues.remove(q)

    def log_agent_step(self, agent_output, agent_name="AI Agent"):
        """
        Parses agent output (AgentAction/ToolResult) and logs data-rich messages.
        Keeps parsing logic out of the main business logic files.
        """
        import ast
        try:
            raw_output = str(agent_output)

            # --- HELPER: Parse Dictionary String ---
            def parse_data(text):
                try:
                    start = text.find("{")
                    end = text.rfind("}")
                    if start != -1 and end != -1:
                        dict_str = text[start:end+1]
                        return ast.literal_eval(dict_str)
                except:
                    return None
                return None

            # --- 1. HANDLE TOOLS (The "Working" Phase) ---
            if "AgentAction" in raw_output or (hasattr(agent_output, 'tool') and agent_output.tool):
                tool_name = getattr(agent_output, 'tool', 'Unknown Tool')
                
                if 'ingest' in tool_name:
                    self.log("📂 Reading & Extracting Case Data...", type="step", agent=agent_name)
                elif 'verify' in tool_name:
                    self.log("🕵️ Verifying Identity against Registry...", type="step", agent=agent_name)
                elif 'assess' in tool_name:
                    self.log("⚖️ Assessing Address Quality...", type="step", agent=agent_name)
                elif 'business' in tool_name:
                    self.log("📋 Validating Business Rules...", type="step", agent=agent_name)
                elif 'registry' in tool_name:
                    self.log("💾 Committing to City Registry...", type="step", agent=agent_name)
                elif 'certificate' in tool_name:
                    self.log("🖨️ Generating PDF Certificate...", type="step", agent=agent_name)
                else:
                    self.log(f"🔧 Starting Tool: {tool_name}", type="step", agent=agent_name)
                return

            # --- 2. HANDLE RESULTS (The "Done" Phase) ---
            if "ToolResult" in raw_output:
                data = parse_data(raw_output)
                
                if data:
                    # -- SCENARIOS --
                    if 'extracted_data' in data:
                        ext = data['extracted_data']
                        name = ext.get('citizen_name', 'Unknown')
                        addr = ext.get('new_address_raw', 'Unknown')
                        self.log(f"📄 Data Extracted: {name}", type="success", agent=agent_name)
                        self.log(f"📍 Raw Address: {addr}", type="info", agent=agent_name)

                    elif 'exists' in data:
                        is_valid = data.get('exists', False)
                        match = "MATCHED" if is_valid else "NOT FOUND"
                        self.log(f"✅ Registry Check: {match}", type="success" if is_valid else "error", agent=agent_name)

                    elif 'canonical_address' in data:
                        canon = data.get('canonical_address')
                        self.log(f"🗺️ Standardized: {canon}", type="success", agent=agent_name)

                    elif 'overall_status' in data:
                        status = data.get('overall_status')
                        issues = data.get('issues', [])
                        if status == 'passed':
                            self.log(f"✅ Quality Score: PERFECT", type="success", agent=agent_name)
                        else:
                            self.log(f"⚠️ Quality Issues: {len(issues)} found", type="warning", agent=agent_name)

                    elif 'citizen_id' in data and 'update_status' in data:
                        cid = data.get('citizen_id')
                        self.log(f"💾 Record Updated: {cid}", type="success", agent=agent_name)

                    elif 'certificate_path' in data:
                        self.log("🖨️ Certificate Generated Successfully", type="success", agent=agent_name)

                    else:
                        self.log("✅ Step Completed", type="success", agent=agent_name)
                else:
                    self.log("✅ Action Completed", type="success", agent=agent_name)
                return

            # --- 3. HANDLE THOUGHTS (The "Thinking" Phase) ---
            if hasattr(agent_output, 'thought') and agent_output.thought:
                # Keep thoughts simple or hidden
                pass

        except Exception as e:
            print(f"Log Parsing Error: {e}")

# Global instance
log_manager = LogManager()
