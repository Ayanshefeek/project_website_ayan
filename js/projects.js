/*
 * projects.js — the single source of truth for every locker on the site.
 *
 * Projects are written here in the order they were built (oldest -> newest),
 * the same way they were originally listed. The UI reverses this list at
 * render time so the newest project always sits in the first locker.
 * To add a new project: append it to the END of this array — nothing else
 * needs to change.
 *
 * `tags` drive the topic filter above the project index.
 *
 * Each project carries its own `theme` (colours + display font) and an `art`
 * key that selects a hand-drawn SVG poster from art.js, which is what gives
 * every locker a different personality.
 */
window.PROJECTS = [
  {
    id: "ott-revenue",
    tags: ["Deep Learning", "Explainable AI"],
    title: "OTT Revenue Predictor",
    tagline: "Forecasting box-office & streaming revenue with deep learning",
    period: "Jan 2025 – Apr 2025",
    art: "ott",
    theme: {
      accent: "#ff5a4e",
      accent2: "#ffc46b",
      wall: "#1d1617",
      light: "#ffd9c9",
      font: "'Bebas Neue', sans-serif",
    },
    about:
      "An AI-powered OTT revenue prediction system using Deep Neural Networks to forecast movie and streaming revenue from production details, audience engagement and content attributes.",
    mission:
      "Turn 300K+ IMDB-TMDB records into explainable revenue forecasts that stakeholders can actually act on.",
    highlights: [
      "Large-scale IMDB-TMDB dataset — 300,000+ processed records",
      "Tokenization, padding, normalization & feature engineering pipeline",
      "Deep neural network in TensorFlow/Keras, tuned with Keras Tuner",
      "SHAP & LIME explainability — directors, keywords, studios and genres as revenue drivers",
      "Responsive web interface for real-time prediction and visualization",
    ],
    stack: ["TensorFlow", "Keras", "Keras Tuner", "SHAP", "LIME", "Python"],
    repo: null,
  },
  {
    id: "cinesearch",
    tags: ["RAG"],
    title: "CineSearch AI",
    tagline: "Conversational movie search built on RAG — from scratch",
    period: "Apr 2026 – May 2026",
    art: "cine",
    theme: {
      accent: "#f2c14e",
      accent2: "#e2483d",
      wall: "#1c1714",
      light: "#ffe6a8",
      font: "'Permanent Marker', cursive",
    },
    about:
      "An end-to-end conversational movie search app. A complete RAG pipeline — loading, chunking, embedding, hybrid vector search, query rewriting and chat memory — over 16,000+ IMDB movies.",
    mission:
      "Let you ask for a movie the way you'd ask a friend, and remember what you said three questions ago.",
    highlights: [
      "Hybrid search: FAISS semantic + BM25 keyword, merged via Reciprocal Rank Fusion",
      "Query rewriting for sharper retrieval",
      "Conversational memory for context-aware answers",
      "16,000+ IMDB movies indexed and searchable",
      "Deployed publicly on Streamlit Cloud",
    ],
    stack: ["LangChain", "SentenceTransformers", "FAISS", "BM25", "Groq", "LLaMA 3.3 70B", "Streamlit", "Python"],
    repo: "https://github.com/Ayanshefeek/movie-rag-chatbot",
  },
  {
    id: "ai-tool-recommendator",
    tags: ["Agents", "RAG"],
    title: "AI Tool Recommendator",
    tagline: "A four-agent pipeline that finds the right AI tool for any task",
    period: "May 2026",
    art: "tools",
    theme: {
      accent: "#b28cff",
      accent2: "#5ce1e6",
      wall: "#17151f",
      light: "#e3d6ff",
      font: "'Space Grotesk', sans-serif",
    },
    about:
      "Describe a task in plain language and a four-stage multi-agent pipeline — Intent Parser, Web Search Agent, RAG Agent, Ranking Agent — returns the best AI tool, a justification and alternatives.",
    mission:
      "Cut through the noise of thousands of AI tools and hand you one confident, explained recommendation.",
    highlights: [
      "Intent Parser extracts structured user goals",
      "Web Search Agent fetches live tool data",
      "RAG over a curated knowledge base of 500+ AI tools",
      "Hybrid FAISS + BM25 retrieval fused with RRF, plus category filtering",
      "Pydantic-structured agent outputs orchestrated with LangChain",
      "Lovable frontend, FastAPI backend, deployed on Railway",
    ],
    stack: ["LangChain", "GPT-4o-mini", "FAISS", "BM25", "Pydantic", "FastAPI", "Lovable", "Railway"],
    repo: "https://github.com/Ayanshefeek/AI_tool_recommendator",
  },
  {
    id: "coding-assistant",
    tags: ["Agents", "RAG"],
    title: "Multi-Agent Coding Assistant",
    tagline: "A local, private pair-programmer that knows your codebase",
    period: "May 2026 – Jun 2026",
    art: "coder",
    theme: {
      accent: "#4ef0a0",
      accent2: "#f5d76e",
      wall: "#111916",
      light: "#c9ffe4",
      font: "'VT323', monospace",
    },
    about:
      "A local AI coding assistant that helps developers write, review and document code over multi-turn conversations — producing code that follows the project's own conventions while staying private through local indexing.",
    mission:
      "Write code that looks like it was written by the team that owns the repo — without the repo ever leaving the machine.",
    highlights: [
      "AST-based code chunking",
      "Semantic retrieval with CodeBERT + FAISS",
      "Multi-agent orchestration with LangGraph",
      "Automated code review agent",
      "Memory tracking for generated symbols",
      "Local repository indexing for privacy",
    ],
    stack: ["LangGraph", "CodeBERT", "FAISS", "AST", "RAG", "Python"],
    repo: "https://github.com/Ayanshefeek/multi-agent-coding-assistant",
  },
  {
    id: "email-assistant",
    tags: ["Agents", "Automation"],
    title: "Email Productivity Assistant",
    tagline: "Reads your inbox, books your meetings, ignores the noise",
    period: "Jun 2026 – Jul 2026",
    art: "email",
    theme: {
      accent: "#6cc7ff",
      accent2: "#ffb86b",
      wall: "#141a20",
      light: "#d6efff",
      font: "'Caveat', cursive",
    },
    about:
      "Automates email management: reads Gmail, classifies messages into meetings, tasks, reminders or noise with GPT-4o-mini, and creates Google Calendar events from extracted meeting details.",
    mission:
      "Make the inbox something that manages itself — reliably, without double-booking or duplicating anything.",
    highlights: [
      "GPT-4o-mini classification: meeting · task · reminder · noise",
      "Automatic Google Calendar event creation",
      "Conflict detection on the calendar",
      "Idempotent processing to prevent duplicates",
      "LangGraph workflow routes low-confidence results for review",
    ],
    stack: ["Python", "GPT-4o-mini", "LangGraph", "Gmail API", "Calendar API", "FastAPI", "Streamlit", "SQLite", "Pydantic"],
    repo: "https://github.com/Ayanshefeek/productivity_assistant",
  },
  {
    id: "brand-guardian",
    tags: ["LLMOps", "Agents", "RAG"],
    title: "Brand Guardian AI",
    tagline: "LLMOps-driven video compliance auditing",
    period: "Aug 2026 – Sep 2026",
    art: "brand",
    theme: {
      accent: "#ff4d6d",
      accent2: "#4da3ff",
      wall: "#1a1419",
      light: "#ffd1db",
      font: "'Bebas Neue', sans-serif",
    },
    about:
      "An end-to-end pipeline that audits video for brand violations using LangGraph, Azure OpenAI and Azure AI Video Indexer, with full observability in production.",
    mission:
      "Watch every frame and every spoken word so a brand never ships a video that breaks its own rules.",
    highlights: [
      "Two-node LangGraph agent workflow",
      "Transcript + OCR extraction via Azure AI Video Indexer",
      "RAG retrieval of brand rules with Azure AI Search",
      "Structured compliance reasoning with Azure OpenAI",
      "Observability through Azure Monitor and LangSmith",
    ],
    stack: ["LangGraph", "Azure OpenAI", "Video Indexer", "Azure AI Search", "Azure Monitor", "LangSmith"],
    repo: "https://github.com/Ayanshefeek/complianceQAPipeline",
  },
  {
    id: "eval-judge-mcp",
    tags: ["Evaluation", "MCP"],
    title: "Eval Judge MCP",
    tagline: "A local judge for agent & RAG outputs — no second LLM call",
    period: "Sep 2026 – Oct 2026",
    art: "judge",
    theme: {
      accent: "#e8c77a",
      accent2: "#9fd6c2",
      wall: "#161514",
      light: "#fff1cc",
      font: "'Playfair Display', serif",
    },
    about:
      "An open-source Python library and MCP server that judges AI agent and RAG outputs for relevance, hallucination, accuracy, routing decisions and prompt injection — using Laya, a small typed-decision model that runs locally.",
    mission:
      "Give every pipeline a fast, free, local verdict — in a few hundred milliseconds on CPU, with no per-call API cost.",
    highlights: [
      "Judges relevance, hallucination, accuracy, routing & prompt injection",
      "Powered by Laya — a small local typed-decision model",
      "Runs as an MCP server or a plain Python library",
      "Calibrated per-dimension thresholds",
      "SQLite logging & reporting (opt-out), env-var configuration",
      "Published on PyPI as eval-judge-mcp",
    ],
    stack: ["Python", "MCP", "Laya", "SQLite", "PyPI"],
    repo: "https://github.com/Ayanshefeek/eval_laya_mcp",
  },
  {
    id: "react-copilot",
    tags: ["Agents", "RAG", "Evaluation"],
    title: "ReAct Copilot",
    tagline: "Grounded Q&A where every answer must prove its source",
    period: "Aug 2026 – Oct 2026",
    art: "react",
    theme: {
      accent: "#f0a35e",
      accent2: "#8fb8ff",
      wall: "#191613",
      light: "#ffe4c4",
      font: "'Playfair Display', serif",
    },
    about:
      "A single-agent ReAct system (LangChain + LangGraph) that answers questions from a local PDF/Markdown corpus. Every answer carries a [file:page] citation backed by a verbatim quote the agent actually read.",
    mission:
      "No citation, no answer. Prove grounded agents beat a plain LLM — and measure exactly by how much.",
    highlights: [
      "Hybrid retrieval: semantic + BM25 fused with RRF, then cross-encoder reranking",
      "Two agent tools: search and read_chunk",
      "Citation-validity guardrail checks every quote before answering",
      "Hard limits on reasoning steps, wall-clock time and tool retries",
      "Prompt-injection guardrail against instruction overrides",
      "Eval harness vs. LLM-only baseline across embeddings (OpenAI vs. HF) and LLMs",
      "FastAPI backend + Streamlit UI for live Q&A",
    ],
    stack: ["LangChain", "LangGraph", "BM25", "Cross-Encoder", "OpenAI", "Hugging Face", "FastAPI", "Streamlit"],
    repo: "https://github.com/Ayanshefeek/react_copilot",
  },
];
