import React, { useState, useEffect, useRef } from 'react';
import './TerminalWidget.css';

import API_URL from '../utils/api';

export default function TerminalWidget() {
    const [logs, setLogs] = useState([]);
    const bottomRef = useRef(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        // Connect to SSE stream
        const eventSource = new EventSource(`${API_URL}/stream-logs`);

        eventSource.onopen = () => {
            setConnected(true);
            addLog({ timestamp: getNow(), message: 'System connected. Listening for agents...', type: 'system', agent: 'System' });
        };

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                addLog(data);
            } catch (e) {
                console.error('Error parsing log:', e);
            }
        };

        eventSource.onerror = (e) => {
            if (connected) {
                setConnected(false);
                addLog({ timestamp: getNow(), message: 'Connection lost. Reconnecting...', type: 'error', agent: 'System' });
            }
        };

        return () => {
            eventSource.close();
        };
    }, []);

    const addLog = (log) => {
        setLogs(prev => {
            const newLogs = [...prev, log];
            if (newLogs.length > 100) return newLogs.slice(newLogs.length - 100); // Keep last 100
            return newLogs;
        });
    };

    // Auto-scroll
    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    const getNow = () => {
        return new Date().toLocaleTimeString('en-US', { hour12: false });
    };

    const getAgentColor = (agent) => {
        if (agent === 'System') return '#6c757d';
        if (agent === 'Coordinator') return '#ffc107';
        return '#00ff00';
    };

    return (
        <div className="terminal-widget">
            <div className="terminal-header">
                <div className="terminal-title">
                    <span className={`status-dot ${connected ? 'online' : 'offline'}`}></span>
                    AI AGENT LIVE FEED
                </div>
                <div className="terminal-controls">
                    <div className="ctrl-btn red"></div>
                    <div className="ctrl-btn yellow"></div>
                    <div className="ctrl-btn green"></div>
                </div>
            </div>
            <div className="terminal-body">
                {logs.length === 0 && <div className="terminal-placeholder">Waiting for activity...</div>}

                {logs.map((log, index) => (
                    <div key={index} className="terminal-line">
                        <span className="log-time">[{log.timestamp}]</span>
                        <span className="log-agent" style={{ color: getAgentColor(log.agent) }}>
                            {log.agent}:
                        </span>
                        <span className={`log-message ${log.type}`}>
                            {log.message}
                        </span>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
        </div>
    );
}
