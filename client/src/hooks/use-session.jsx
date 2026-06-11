import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from "react";
import { useSocket } from "./use-socket";
import { api } from "../services/api";

const SessionContext = createContext(null);

const initialState = {
  topic: "",
  background: "",
  personas: [],
  messages: [],
  mindmap: "",
  status: "idle",
  mode: "human-led",
  round: 0,
  maxRounds: 5,
  thinking: {},
  factCounter: 0,
  allFacts: [],
  config: { providers: [], personas: [], personaOverrides: {} },
  historyList: [],
  currentHistoryId: null,
};

function sessionReducer(state, action) {
  switch (action.type) {
    case "SESSION_INIT":
      return {
        ...state,
        ...action.payload,
        messages: action.payload.messages || [],
        factCounter: 0,
        allFacts: [],
        currentHistoryId: action.payload.currentHistoryId || null,
      };
    case "NEW_MESSAGE":
      return { ...state, messages: [...state.messages, action.payload] };
    case "USER_FACT": {
      const num = state.factCounter + 1;
      return {
        ...state,
        factCounter: num,
        allFacts: [...state.allFacts, { num, content: action.payload.content }],
        messages: [...state.messages, action.payload],
      };
    }
    case "STATUS_CHANGED":
      return { ...state, status: action.payload.status, mode: action.payload.mode ?? state.mode };
    case "ROUND_CHANGED":
      return { ...state, round: action.payload.round, maxRounds: action.payload.maxRounds };
    case "MINDMAP_UPDATED":
      return { ...state, mindmap: action.payload.markdown };
    case "THINKING_START":
      return { ...state, thinking: { ...state.thinking, [action.payload.personaId]: "thinking" } };
    case "THINKING_DONE":
    case "THINKING_ERROR": {
      const next = { ...state.thinking };
      delete next[action.payload.personaId];
      return { ...state, thinking: next };
    }
    case "SET_CONFIG":
      return { ...state, config: action.payload };
    case "SET_HISTORY":
      return { ...state, historyList: action.payload };
    case "RESET":
      return { ...state, ...initialState, connected: state.connected, config: state.config, historyList: state.historyList };
    case "SET_MINDMAP":
      return { ...state, mindmap: action.payload };
    default:
      return state;
  }
}

export function SessionProvider({ children }) {
  const [state, dispatch] = useReducer(sessionReducer, initialState);
  const { connected, emit, on, off } = useSocket();
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const cleanup = on("session_init", (data) => {
      dispatch({ type: "SESSION_INIT", payload: data });
    });

    const cleanup2 = on("new_message", (msg) => {
      dispatch({ type: "NEW_MESSAGE", payload: msg });
    });

    const cleanup3 = on("status_changed", (data) => {
      dispatch({ type: "STATUS_CHANGED", payload: data });
    });

    const cleanup4 = on("round_changed", (data) => {
      dispatch({ type: "ROUND_CHANGED", payload: data });
    });

    const cleanup5 = on("mindmap_updated", (data) => {
      dispatch({ type: "MINDMAP_UPDATED", payload: data });
    });

    const cleanup6 = on("thinking", (data) => {
      if (data.status === "start") {
        dispatch({ type: "THINKING_START", payload: data });
      } else if (data.status === "done") {
        dispatch({ type: "THINKING_DONE", payload: data });
      } else if (data.status === "error") {
        dispatch({ type: "THINKING_ERROR", payload: data });
      }
    });

    const cleanup7 = on("error", (data) => {
      dispatch({
        type: "NEW_MESSAGE",
        payload: { id: "err_" + Date.now(), type: "error", content: data.message, timestamp: Date.now() },
      });
    });

    const cleanup8 = on("history_list_updated", (list) => {
      dispatch({ type: "SET_HISTORY", payload: list });
    });

    return () => {
      cleanup();
      cleanup2();
      cleanup3();
      cleanup4();
      cleanup5();
      cleanup6();
      cleanup7();
      cleanup8();
    };
  }, [on]);

  const sendMessage = useCallback(
    (content, mode = "opinion") => {
      if (!content.trim()) return;
      const msg = {
        id: "msg_" + Date.now(),
        type: mode === "fact" ? "user_fact" : "user",
        content: content.trim(),
        timestamp: Date.now(),
      };

      if (mode === "fact") {
        dispatch({ type: "USER_FACT", payload: msg });
        emit("user_fact", { content: msg.content });
      } else {
        dispatch({ type: "NEW_MESSAGE", payload: msg });
        emit("user_message", { content: msg.content });
      }
    },
    [emit]
  );

  const loadConfig = useCallback(async () => {
    try {
      const config = await api.getConfig();
      dispatch({ type: "SET_CONFIG", payload: config });
      return config;
    } catch (e) {
      console.error("Failed to load config:", e);
    }
  }, []);

  const saveConfig = useCallback(async (config) => {
    await api.saveConfig(config);
    dispatch({ type: "SET_CONFIG", payload: config });
  }, []);

  const initSession = useCallback(async (data) => {
    await api.initSession(data);
  }, []);

  const startAuto = useCallback(async () => {
    await api.startAuto();
  }, []);

  const stopDebate = useCallback(async () => {
    await api.stopDebate();
  }, []);

  const resumeAuto = useCallback(async () => {
    await api.resumeAuto();
  }, []);

  const startHumanRound = useCallback(async () => {
    await api.startHumanRound();
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const list = await api.getHistory();
      dispatch({ type: "SET_HISTORY", payload: list });
    } catch (e) {
      console.error("Failed to load history:", e);
    }
  }, []);

  const viewHistory = useCallback(async (id) => {
    try {
      await api.loadHistory(id);
      // 服务端会通过 socket emit session_init 来同步状态
    } catch (e) {
      console.error("Failed to view history:", e);
    }
  }, []);

  const deleteHistory = useCallback(async (id) => {
    await api.deleteHistory(id);
  }, []);

  const resetSession = useCallback(() => {
    emit("reset_session");
    dispatch({ type: "RESET" });
  }, [emit]);

  const value = {
    ...state,
    connected,
    sendMessage,
    loadConfig,
    saveConfig,
    initSession,
    startAuto,
    stopDebate,
    resumeAuto,
    startHumanRound,
    loadHistory,
    viewHistory,
    deleteHistory,
    resetSession,
    dispatch,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used within SessionProvider");
  return context;
}
